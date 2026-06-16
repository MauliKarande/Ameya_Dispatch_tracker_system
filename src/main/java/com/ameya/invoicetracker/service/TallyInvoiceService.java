package com.ameya.invoicetracker.service;

import com.ameya.invoicetracker.dto.TallyCreateRequest;
import com.ameya.invoicetracker.dto.TallyPartDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class TallyInvoiceService {

    @Value("${app.tally.url:http://localhost:9000}")
    private String tallyUrl;

    @Value("${app.tally.company-name:AMEYA PRECISION ENGINEERS LIMITED  25-26}")
    private String companyName;

    @Value("${app.tally.sales-ledger:EXPORT LUT BOND}")
    private String salesLedger;

    private final TallyCustomDataService customData;

    // ── Send XML to Tally ─────────────────────────────────────────────────
    public String sendToTally(TallyCreateRequest req) {
        List<TallyPartDTO> parts = req.getParts();
        if (parts == null || parts.isEmpty()) return "ERROR: No parts in request";

        Map<String, Object> addr = customData.getAddress(req.getPartyTally());
        List<String> addrLines = addr != null ? (List<String>) addr.get("address_lines") : List.of();
        String mailingName = addr != null ? (String) addr.getOrDefault("mailing_name", req.getPartyTally()) : req.getPartyTally();

        String xml = buildXml(parts, req, addrLines, mailingName);
        log.info("Sending invoice XML to Tally for party={} voucher={}", req.getPartyTally(), req.getVoucherNumber());

        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(15)).build();
            HttpRequest httpReq = HttpRequest.newBuilder()
                    .uri(URI.create(tallyUrl))
                    .header("Content-Type", "application/xml")
                    .POST(HttpRequest.BodyPublishers.ofString(xml, StandardCharsets.UTF_8))
                    .timeout(Duration.ofSeconds(30)).build();
            HttpResponse<String> resp = client.send(httpReq, HttpResponse.BodyHandlers.ofString());
            String body = resp.body();
            log.info("Tally response: {}", body.length() > 200 ? body.substring(0, 200) : body);
            // Save last voucher number on success
            if (body.contains("<CREATED>1</CREATED>") || body.contains("<ALTERED>1</ALTERED>")) {
                customData.saveLastVoucherNo(req.getVoucherNumber());
            }
            return body;
        } catch (Exception e) {
            log.error("Tally connection error: {}", e.getMessage());
            return "ERROR: " + e.getMessage();
        }
    }

    // ── Ping Tally server ─────────────────────────────────────────────────
    public Map<String, String> pingTally() {
        Map<String, String> result = new LinkedHashMap<>();
        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(5)).build();
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(tallyUrl))
                    .GET()
                    .timeout(Duration.ofSeconds(5)).build();
            client.send(req, HttpResponse.BodyHandlers.ofString());
            result.put("status", "UP");
        } catch (Exception e) {
            result.put("status", "DOWN");
            result.put("error", e.getMessage());
        }
        return result;
    }

    // ── Check part numbers against Tally stock items ─────────────────────
    /**
     * Queries Tally HTTP server for all stock items, then returns which of the
     * given part numbers exist in Tally and which do not.
     * Equivalent to the Python script's ODBC stock-item lookup via pyodbc.
     */
    public Map<String, Object> checkPartsInTally(List<String> partNumbers) {
        String xml = """
                <ENVELOPE>
                  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
                  <BODY>
                    <EXPORTDATA>
                      <REQUESTDESC>
                        <REPORTNAME>List of Accounts</REPORTNAME>
                        <STATICVARIABLES>
                          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                          <ACCOUNTTYPE>Stock Items</ACCOUNTTYPE>
                        </STATICVARIABLES>
                      </REQUESTDESC>
                    </EXPORTDATA>
                  </BODY>
                </ENVELOPE>""";
        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(10)).build();
            HttpRequest httpReq = HttpRequest.newBuilder()
                    .uri(URI.create(tallyUrl))
                    .header("Content-Type", "application/xml")
                    .POST(HttpRequest.BodyPublishers.ofString(xml, StandardCharsets.UTF_8))
                    .timeout(Duration.ofSeconds(20)).build();
            String body = client.send(httpReq, HttpResponse.BodyHandlers.ofString()).body();

            // Parse stock item names from Tally XML response
            Set<String> tallyItems = new HashSet<>();
            Matcher m1 = Pattern.compile("NAME=\"([^\"]+)\"", Pattern.CASE_INSENSITIVE).matcher(body);
            while (m1.find()) tallyItems.add(m1.group(1).toUpperCase().strip());
            Matcher m2 = Pattern.compile("<NAME>([^<]+)</NAME>", Pattern.CASE_INSENSITIVE).matcher(body);
            while (m2.find()) tallyItems.add(m2.group(1).toUpperCase().strip());
            log.info("Tally stock item check: {} items in database", tallyItems.size());

            List<String> found = new ArrayList<>(), notFound = new ArrayList<>();
            for (String part : partNumbers) {
                (tallyItems.contains(part.toUpperCase().strip()) ? found : notFound).add(part);
            }
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("found", found);
            result.put("notFound", notFound);
            result.put("totalInTally", tallyItems.size());
            return result;
        } catch (Exception e) {
            log.error("Tally stock check failed: {}", e.getMessage());
            throw new RuntimeException("Cannot connect to Tally at " + tallyUrl + ": " + e.getMessage());
        }
    }

    // ── Create invoice folder + blank PDFs ───────────────────────────────
    public String createFolders(String voucherNumber, String partyTally, String airSea, String mainFolder) {
        String party = partyTally.toUpperCase().replaceAll("[\\\\/:*?\"<>|]", "_");
        String mode  = (airSea != null ? airSea : "AIR").toUpperCase();
        String base  = voucherNumber + " " + party + " " + mode;
        String folderName = "INV " + base;

        Path folderPath = Paths.get(mainFolder, folderName);
        try {
            Files.createDirectories(folderPath);
            String[] pdfs = {
                "INV " + base + ".pdf",
                "PACKAGING LIST INV " + base + ".pdf",
                "TAX INV " + base + ".pdf"
            };
            for (String pdf : pdfs) {
                Path pdfPath = folderPath.resolve(pdf);
                if (!Files.exists(pdfPath)) Files.write(pdfPath, blankPdfBytes());
            }
            log.info("Created invoice folder: {}", folderPath);
            return "OK:" + folderPath.toAbsolutePath();
        } catch (IOException e) {
            log.error("Folder creation error: {}", e.getMessage());
            return "ERROR: " + e.getMessage();
        }
    }

    // ── XML builder (mirrors Python build_xml) ───────────────────────────
    private String buildXml(List<TallyPartDTO> parts, TallyCreateRequest req,
                             List<String> addrLines, String mailingName) {
        double ex = req.getExchangeRate() > 0 ? req.getExchangeRate() : 1.0;
        String rawCurr = req.getCurrency() != null ? req.getCurrency().strip() : "DOLLAR";
        String curr = resolveCurrency(rawCurr);

        String party = req.getPartyTally();
        String vn    = req.getVoucherNumber();
        String vd    = req.getVoucherDate() != null ? req.getVoucherDate().replace("-", "") : "";
        String mode  = req.getAirSea() != null ? req.getAirSea() : "AIR";

        double tf = parts.stream().mapToDouble(TallyPartDTO::getAmount).sum();
        tf = round2(tf);
        double ti = round2(tf * ex);

        // Sulzer / Valve HSN logic
        boolean isSulzer = party.toUpperCase().startsWith("SULZER");
        String hsnCode = isSulzer ? "84139120" : "84819090";
        String hsnDesc = isSulzer ? "PARTS OF PUMPS" : "PARTS OF VALVE";
        String drawback = isSulzer ? "UNDER DRAWBACK SR.NO.8413" : "UNDER DRAWBACK SR.NO.848199B";
        String hsnSel   = isSulzer ? "Yes" : "";

        String buyerName = nvl(req.getBuyerName());
        String buyerAddr = nvl(req.getBuyerAddress());
        String basicBuyerName = !buyerName.isEmpty() ? buyerName : party;

        String addrBlock = addrListXml("ADDRESS", addrLines);
        String dispAddrBlock = addrListXml("DISPATCHFROMADDRESS", List.of(
                "GAT NO. 345, VILLAGE KASURDI (KB),",
                "PUNE-SATARA ROAD, TAL. BHOR, PUNE-412205,",
                "MAHARASHTRA, INDIA"));
        String buyerAddrBlock = addrListXml("BASICBUYERADDRESS",
                !buyerAddr.isEmpty() ? List.of(buyerAddr) : addrLines);

        // Inventory entries
        StringBuilder invXml = new StringBuilder();
        for (TallyPartDTO p : parts) {
            double f   = p.getAmount();
            double inr = round2(f * ex);
            int qty    = Math.max(1, p.getQty());
            double ratePc    = p.getRatePc() > 0 ? p.getRatePc() : round2(f / qty);
            double ratePcInr = round2(ratePc * ex);
            String poNo   = nvl(p.getPoNo());
            String poSrNo = nvl(p.getPoSrNo());
            invXml.append(String.format("""
                       <ALLINVENTORYENTRIES.LIST>
                        <STOCKITEMNAME>%s</STOCKITEMNAME>
                        <GSTOVRDNISREVCHARGEAPPL>&#4; Not Applicable</GSTOVRDNISREVCHARGEAPPL>
                        <GSTOVRDNTAXABILITY>Exempt</GSTOVRDNTAXABILITY>
                        <GSTSOURCETYPE>Ledger</GSTSOURCETYPE><GSTLEDGERSOURCE>%s</GSTLEDGERSOURCE>
                        <HSNSOURCETYPE>Stock Group</HSNSOURCETYPE>
                        <HSNSTOCKGROUPSOURCE>FINISHED GOODS</HSNSTOCKGROUPSOURCE>
                        <GSTOVRDNSTOREDNATURE>Exports - LUT/Bond</GSTOVRDNSTOREDNATURE>
                        <GSTOVRDNTYPEOFSUPPLY>Goods</GSTOVRDNTYPEOFSUPPLY>
                        <GSTHSNNAME>%s</GSTHSNNAME><GSTHSNDESCRIPTION>%s</GSTHSNDESCRIPTION>
                        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                        <RATE>%s %.2f = ₹ %.2f/NOS</RATE>
                        <AMOUNT>%s %s @ ₹ %.2f/%s = ₹ %.2f</AMOUNT>
                        <ACTUALQTY>%d NOS</ACTUALQTY><BILLEDQTY>%d NOS</BILLEDQTY>
                        <BATCHALLOCATIONS.LIST>
                         <GODOWNNAME>Main Location</GODOWNNAME><BATCHNAME>Primary Batch</BATCHNAME>
                         <DESTINATIONGODOWNNAME>Main Location</DESTINATIONGODOWNNAME>
                         <AMOUNT>%s %s @ ₹ %.2f/%s = ₹ %.2f</AMOUNT>
                         <ACTUALQTY>%d NOS</ACTUALQTY><BILLEDQTY>%d NOS</BILLEDQTY>
                        </BATCHALLOCATIONS.LIST>
                        <ACCOUNTINGALLOCATIONS.LIST>
                         <LEDGERNAME>%s</LEDGERNAME>
                         <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><ISPARTYLEDGER>No</ISPARTYLEDGER>
                         <AMOUNT>%s %s @ ₹ %.2f/%s = ₹ %.2f</AMOUNT>
                        </ACCOUNTINGALLOCATIONS.LIST>
                        <RATEDETAILS.LIST><GSTRATEDUTYHEAD>CGST</GSTRATEDUTYHEAD><GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE></RATEDETAILS.LIST>
                        <RATEDETAILS.LIST><GSTRATEDUTYHEAD>SGST/UTGST</GSTRATEDUTYHEAD><GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE></RATEDETAILS.LIST>
                        <RATEDETAILS.LIST><GSTRATEDUTYHEAD>IGST</GSTRATEDUTYHEAD><GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE></RATEDETAILS.LIST>
                        <UDF:STOVCHSTKITEMHSNCODE.LIST DESC="`Sto VCHStkItemHsNCode`" ISLIST="YES" TYPE="String" INDEX="8250">
                         <UDF:STOVCHSTKITEMHSNCODE DESC="`Sto VCHStkItemHsNCode`">%s</UDF:STOVCHSTKITEMHSNCODE>
                        </UDF:STOVCHSTKITEMHSNCODE.LIST>
                        <UDF:AMEYAINVDESCSTO.LIST DESC="`AmeyaInvDescSto`" ISLIST="YES" TYPE="String" INDEX="8257">
                         <UDF:AMEYAINVDESCSTO DESC="`AmeyaInvDescSto`">%s</UDF:AMEYAINVDESCSTO>
                        </UDF:AMEYAINVDESCSTO.LIST>
                        <UDF:AMEYAINVDETAILSTO.LIST DESC="`AmeyaInvDetailSto`" ISLIST="YES" TYPE="String" INDEX="8258">
                         <UDF:AMEYAINVDETAILSTO DESC="`AmeyaInvDetailSto`">%s</UDF:AMEYAINVDETAILSTO>
                        </UDF:AMEYAINVDETAILSTO.LIST>
                        <UDF:AMEYAINVHSNSTO.LIST DESC="`AmeyaInvHSNSto`" ISLIST="YES" TYPE="String" INDEX="8259">
                         <UDF:AMEYAINVHSNSTO DESC="`AmeyaInvHSNSto`">%s</UDF:AMEYAINVHSNSTO>
                        </UDF:AMEYAINVHSNSTO.LIST>
                        <UDF:AMEYAITEMPONOSTO.LIST DESC="`AmeyaItemPONoSto`" ISLIST="YES" TYPE="String" INDEX="8260">
                         <UDF:AMEYAITEMPONOSTO DESC="`AmeyaItemPONoSto`">%s</UDF:AMEYAITEMPONOSTO>
                        </UDF:AMEYAITEMPONOSTO.LIST>
                        <UDF:AMEYAITEMPOSOSRNOSTO.LIST DESC="`AmeyaItemPOSrNoSto`" ISLIST="YES" TYPE="String" INDEX="8261">
                         <UDF:AMEYAITEMPOSOSRNOSTO DESC="`AmeyaItemPOSrNoSto`">%s</UDF:AMEYAITEMPOSOSRNOSTO>
                        </UDF:AMEYAITEMPOSOSRNOSTO.LIST>
                        <UDF:EIAMSALESDETWEEKNOSTO.LIST DESC="`EIAMSalesDetWeekNoSto`" ISLIST="YES" TYPE="String" INDEX="7666">
                         <UDF:EIAMSALESDETWEEKNOSTO DESC="`EIAMSalesDetWeekNoSto`">%s</UDF:EIAMSALESDETWEEKNOSTO>
                        </UDF:EIAMSALESDETWEEKNOSTO.LIST>
                        <UDF:AMEYAITEMRATEPCSTO.LIST DESC="`AmeyaItemRatePcSto`" ISLIST="YES" TYPE="Number" INDEX="8262">
                         <UDF:AMEYAITEMRATEPCSTO DESC="`AmeyaItemRatePcSto`">%.2f</UDF:AMEYAITEMRATEPCSTO>
                        </UDF:AMEYAITEMRATEPCSTO.LIST>
                       </ALLINVENTORYENTRIES.LIST>
                    """,
                    escXml(p.getPartNo()), salesLedger, hsnCode, hsnDesc,
                    curr, ratePc, ratePcInr,
                    curr, f, ex, curr, inr, qty, qty,
                    curr, f, ex, curr, inr, qty, qty,
                    salesLedger,
                    curr, f, ex, curr, inr,
                    hsnSel, hsnDesc, drawback, hsnCode,
                    poNo, poSrNo, poSrNo, ratePc));
        }

        String partyCountry = nvl(req.getPartyCountry());
        return String.format("""
                <ENVELOPE>
                 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
                 <BODY><IMPORTDATA>
                  <REQUESTDESC>
                   <REPORTNAME>Vouchers</REPORTNAME>
                   <STATICVARIABLES><SVCURRENTCOMPANY>%s</SVCURRENTCOMPANY></STATICVARIABLES>
                  </REQUESTDESC>
                  <REQUESTDATA><TALLYMESSAGE xmlns:UDF="TallyUDF">
                   <VOUCHER VCHTYPE="SALES EXPORT" ACTION="Create" OBJVIEW="Invoice Voucher View">
                %s
                %s
                %s
                    <DATE>%s</DATE><REFERENCEDATE>%s</REFERENCEDATE>
                    <COUNTRYOFRESIDENCE>%s</COUNTRYOFRESIDENCE>
                    <PARTYNAME>%s</PARTYNAME>
                    <VOUCHERTYPENAME>SALES EXPORT</VOUCHERTYPENAME>
                    <PARTYLEDGERNAME>%s</PARTYLEDGERNAME>
                    <VOUCHERNUMBER>%s</VOUCHERNUMBER>
                    <BASICBUYERNAME>%s</BASICBUYERNAME>
                    <REFERENCE>%s</REFERENCE>
                    <PARTYMAILINGNAME>%s</PARTYMAILINGNAME>
                    <DISPATCHFROMNAME>AMEYA PRECISION ENGINEERS LIMITED</DISPATCHFROMNAME>
                    <DISPATCHFROMSTATENAME>Maharashtra</DISPATCHFROMSTATENAME>
                    <DISPATCHFROMPINCODE>412205</DISPATCHFROMPINCODE>
                    <DISPATCHFROMPLACE>PUNE</DISPATCHFROMPLACE>
                    <BILLTOPLACE>%s</BILLTOPLACE>
                    <SHIPTOPLACE>MUMBAI</SHIPTOPLACE>
                    <CMPGSTIN>27AALCA1679D1ZM</CMPGSTIN>
                    <CMPGSTREGISTRATIONTYPE>Regular</CMPGSTREGISTRATIONTYPE>
                    <CMPGSTSTATE>Maharashtra</CMPGSTSTATE>
                    <GSTREGISTRATIONTYPE>&#4; Unknown</GSTREGISTRATIONTYPE>
                    <PARTYCOUNTRY>%s</PARTYCOUNTRY>
                    <BASICDUEDATEOFPYMT>60 Days</BASICDUEDATEOFPYMT>
                    <ISINVOICE>Yes</ISINVOICE><PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
                    <VCHENTRYMODE>Item Invoice</VCHENTRYMODE>
                    <ISELIGIBLEFORITC>Yes</ISELIGIBLEFORITC>
                    <DIFFACTUALQTY>No</DIFFACTUALQTY>
                    <ISDELETED>No</ISDELETED><ISCANCELLED>No</ISCANCELLED><ISONHOLD>No</ISONHOLD>
                %s
                    <LEDGERENTRIES.LIST>
                     <LEDGERNAME>%s</LEDGERNAME>
                     <ISPARTYLEDGER>Yes</ISPARTYLEDGER><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                     <AMOUNT>-%s %.2f @ ₹ %.2f/%s = -₹ %.2f</AMOUNT>
                     <BILLALLOCATIONS.LIST>
                      <NAME>%s</NAME><BILLTYPE>New Ref</BILLTYPE>
                      <AMOUNT>-%s %.2f @ ₹ %.2f/%s = -₹ %.2f</AMOUNT>
                     </BILLALLOCATIONS.LIST>
                    </LEDGERENTRIES.LIST>
                    <UDF:AATPLRATELINE.LIST DESC="`AATPLRate Line`" ISLIST="YES" TYPE="Number" INDEX="9000">
                     <UDF:AATPLRATELINE DESC="`AATPLRate Line`">%.2f</UDF:AATPLRATELINE>
                    </UDF:AATPLRATELINE.LIST>
                    <UDF:AATPLRATELINEAB.LIST DESC="`AATPLRate LineAB`" ISLIST="YES" TYPE="String" INDEX="9002">
                     <UDF:AATPLRATELINEAB DESC="`AATPLRate LineAB`">%s</UDF:AATPLRATELINEAB>
                    </UDF:AATPLRATELINEAB.LIST>
                    <UDF:PROFINVSELTERMS.LIST DESC="`PROFINVSelTerms`" ISLIST="YES" TYPE="String" INDEX="8001">
                     <UDF:PROFINVSELTERMS DESC="`PROFINVSelTerms`">%s</UDF:PROFINVSELTERMS>
                    </UDF:PROFINVSELTERMS.LIST>
                    <UDF:PROFINVBUYNAMESTO.LIST DESC="`PROFINVBUYNAMESTO`" ISLIST="YES" TYPE="String" INDEX="8004">
                     <UDF:PROFINVBUYNAMESTO DESC="`PROFINVBUYNAMESTO`">%s</UDF:PROFINVBUYNAMESTO>
                    </UDF:PROFINVBUYNAMESTO.LIST>
                    <UDF:PROFINVBUYADDSTO.LIST DESC="`PROFINVBUYAddSTO`" ISLIST="YES" TYPE="String" INDEX="8005">
                     <UDF:PROFINVBUYADDSTO DESC="`PROFINVBUYAddSTO`">%s</UDF:PROFINVBUYADDSTO>
                    </UDF:PROFINVBUYADDSTO.LIST>
                    <UDF:PROPOSTSHIPVESSELNAME.LIST DESC="`PROpostShipVesselName`" ISLIST="YES" TYPE="String" INDEX="8013">
                     <UDF:PROPOSTSHIPVESSELNAME DESC="`PROpostShipVesselName`">%s</UDF:PROPOSTSHIPVESSELNAME>
                    </UDF:PROPOSTSHIPVESSELNAME.LIST>
                    <UDF:PROPOSTSHIPPROVPORTLOADING.LIST DESC="`PROpostShipProvPortLoading`" ISLIST="YES" TYPE="String" INDEX="8014">
                     <UDF:PROPOSTSHIPPROVPORTLOADING DESC="`PROpostShipProvPortLoading`">%s</UDF:PROPOSTSHIPPROVPORTLOADING>
                    </UDF:PROPOSTSHIPPROVPORTLOADING.LIST>
                    <UDF:PROPOSTSHIPPORTOFDISC.LIST DESC="`PROpostShipPortofDisc`" ISLIST="YES" TYPE="String" INDEX="8015">
                     <UDF:PROPOSTSHIPPORTOFDISC DESC="`PROpostShipPortofDisc`">%s</UDF:PROPOSTSHIPPORTOFDISC>
                    </UDF:PROPOSTSHIPPORTOFDISC.LIST>
                    <UDF:PROPOSTSHIPPROVFINALDEST.LIST DESC="`PROpostShipProvFinalDest`" ISLIST="YES" TYPE="String" INDEX="8016">
                     <UDF:PROPOSTSHIPPROVFINALDEST DESC="`PROpostShipProvFinalDest`">%s</UDF:PROPOSTSHIPPROVFINALDEST>
                    </UDF:PROPOSTSHIPPROVFINALDEST.LIST>
                    <UDF:PROPOSTSHIPCOUNTRYNAME.LIST DESC="`PROpostShipCountryName`" ISLIST="YES" TYPE="String" INDEX="8017">
                     <UDF:PROPOSTSHIPCOUNTRYNAME DESC="`PROpostShipCountryName`">%s</UDF:PROPOSTSHIPCOUNTRYNAME>
                    </UDF:PROPOSTSHIPCOUNTRYNAME.LIST>
                    <UDF:STOBTCHDETNETWT.LIST DESC="`StoBtchDetNetWt`" ISLIST="YES" TYPE="String" INDEX="8220">
                     <UDF:STOBTCHDETNETWT DESC="`StoBtchDetNetWt`">%s</UDF:STOBTCHDETNETWT>
                    </UDF:STOBTCHDETNETWT.LIST>
                    <UDF:STOBTCHDETGROSSWT.LIST DESC="`StoBtchDetGrossWt`" ISLIST="YES" TYPE="String" INDEX="8221">
                     <UDF:STOBTCHDETGROSSWT DESC="`StoBtchDetGrossWt`">%s</UDF:STOBTCHDETGROSSWT>
                    </UDF:STOBTCHDETGROSSWT.LIST>
                    <UDF:STOBOXSIZE.LIST DESC="`StoBoxSize`" ISLIST="YES" TYPE="String" INDEX="8228">
                     <UDF:STOBOXSIZE DESC="`StoBoxSize`">%s</UDF:STOBOXSIZE>
                    </UDF:STOBOXSIZE.LIST>
                    <UDF:SPPLEXSALESBOXTYPESTO.LIST DESC="`SPPLExSalesBoxTypeSto`" ISLIST="YES" TYPE="String" INDEX="8232">
                     <UDF:SPPLEXSALESBOXTYPESTO DESC="`SPPLExSalesBoxTypeSto`">%s</UDF:SPPLEXSALESBOXTYPESTO>
                    </UDF:SPPLEXSALESBOXTYPESTO.LIST>
                    <UDF:STOAREONENUMBERSTO.LIST DESC="`StoAREOneNumberSto`" ISLIST="YES" TYPE="String" INDEX="8233">
                     <UDF:STOAREONENUMBERSTO DESC="`StoAREOneNumberSto`">%s</UDF:STOAREONENUMBERSTO>
                    </UDF:STOAREONENUMBERSTO.LIST>
                    <UDF:AATPLAMEYAAUTHSINGSTO.LIST DESC="`AATPlAmeyaAuthsingSto`" ISLIST="YES" TYPE="String" INDEX="8239">
                     <UDF:AATPLAMEYAAUTHSINGSTO DESC="`AATPlAmeyaAuthsingSto`">MR. SHIRISH PANDE</UDF:AATPLAMEYAAUTHSINGSTO>
                    </UDF:AATPLAMEYAAUTHSINGSTO.LIST>
                   </VOUCHER>
                  </TALLYMESSAGE></REQUESTDATA>
                 </IMPORTDATA></BODY>
                </ENVELOPE>""",
                companyName,
                addrBlock, dispAddrBlock, buyerAddrBlock,
                vd, vd, partyCountry, party, party, vn,
                escXml(basicBuyerName), vn, escXml(mailingName),
                nvl(req.getCountryDest()), partyCountry,
                invXml,
                party, curr, tf, ex, curr, ti, vn, curr, tf, ex, curr, ti,
                ex, curr,
                escXml(nvl(req.getTerms())),
                escXml(basicBuyerName),
                escXml(!buyerAddr.isEmpty() ? buyerAddr : String.join("; ", addrLines)),
                mode,
                nvl(req.getPortLoading()), nvl(req.getPortDischarge()),
                nvl(req.getFinalDest()), nvl(req.getCountryDest()),
                nvl(req.getNetWeight()), nvl(req.getGrossWeight()),
                nvl(req.getBoxSize()),
                nvl(req.getBoxType()).isEmpty() ? "01 WOODEN BOX" : nvl(req.getBoxType()),
                vn);
    }

    // ── Helpers ──────────────────────────────────────────────────────────
    private String resolveCurrency(String c) {
        if (c.equals("€") || c.equals("€") || c.equalsIgnoreCase("EUR") || c.equalsIgnoreCase("EURO"))
            return "&#8364;";
        if (c.equalsIgnoreCase("POUND") || c.equalsIgnoreCase("GBP")) return "POUND";
        return "DOLLAR";
    }

    private String addrListXml(String tag, List<String> lines) {
        if (lines == null || lines.isEmpty()) return "";
        StringBuilder sb = new StringBuilder("      <").append(tag).append(".LIST TYPE=\"String\">\n");
        for (String l : lines) sb.append("       <").append(tag).append(">").append(escXml(l)).append("</").append(tag).append(">\n");
        sb.append("      </").append(tag).append(".LIST>");
        return sb.toString();
    }

    private static String escXml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }

    private static String nvl(String s) { return s == null ? "" : s.strip(); }

    private static double round2(double v) { return Math.round(v * 100.0) / 100.0; }

    private static byte[] blankPdfBytes() {
        return ("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
                "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
                "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> >>\nendobj\n" +
                "xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n" +
                "0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n204\n%%EOF")
                .getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }
}
