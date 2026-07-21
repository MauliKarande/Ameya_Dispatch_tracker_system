package com.ameya.invoicetracker.service;

import com.ameya.invoicetracker.entity.DailyExchangeRate;
import com.ameya.invoicetracker.entity.FileStorage;
import com.ameya.invoicetracker.entity.WorkOrder;
import com.ameya.invoicetracker.repository.DailyExchangeRateRepository;
import com.ameya.invoicetracker.repository.FileStorageRepository;
import com.ameya.invoicetracker.repository.WorkOrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class DispatchExportService {

    private final WorkOrderRepository workOrderRepository;
    private final DailyExchangeRateRepository rateRepository;
    private final FileStorageRepository fileStorageRepository;
    private final TallyCustomDataService customData;
    private final ExchangeRateService exchangeRateService;

    private static final DateTimeFormatter INVOICE_DATE_FMT = DateTimeFormatter.ofPattern("dd-MMM-yy", Locale.ENGLISH);

    private static final String[] HEADERS = {
        "brc DOUCMENT", "COMMISSION ENTRY", "HSN CODE", "BANK REFERENCE NO",
        "INVOICE NUMBER", "INVOICE DATE", "CUSTOMER'S NAME", "MODE OF SHIPMENT",
        "INVOICE VALUE IN CURR.", "CURRENCY", "CURRENCY RATE", "INVOICE VALUE IN INR",
        "FINAL DESTINATION", "PORT OF DISCHARGE", "DELIVERY TERMS", "PAYMENT TERMS",
        "FORWARDER", "TRACKING NO.", "VESSLE", "PORT CODE",
        "SHIPPING BILL NO.", "S.B. DATE", "EGM.NO", "EGM.DATE",
        "BILL OF LADING/AIR WAY BILL NO.", "BL/AWB DATE", "PORT NAME - JNPT/SAHAR",
        "INVOICE. VALUE IN INR PER S/B", "FOB VALUE IN Rs. PER S/B", "FOB VALUE IN CURRENCY",
        "SB. CURRENCY RATE", "INSURANCE AMOUNT IN CURRENCY VALUE",
        "FREIGHT AMOUNT IN CURRENCY VALUE", "DUTY DRAWBACK AMOUNT PER S.B.", "RODTEP AMT"
    };

    public record MissingRatePair(String date, String currency) {}

    // ── Step 1: check whether the range is ready to export ───────────────
    // Currency is NEVER a user choice — it's always derived per-party (same
    // lookup the Tally invoice-creation screen already uses), so a date only
    // ever needs a rate for the specific currencies its invoices actually use.
    public List<MissingRatePair> findMissingRatePairs(LocalDate startDate, LocalDate endDate) {
        List<WorkOrder> rows = workOrderRepository.findExportableInvoices(
                startDate, endDate, WorkOrder.StepStatus.DONE);
        Set<MissingRatePair> missing = new TreeSet<>(
                Comparator.comparing(MissingRatePair::date).thenComparing(MissingRatePair::currency));
        for (WorkOrder w : rows) {
            if (w.getInvoiceDate() == null) continue;
            if (w.getInvoiceCurrency() != null && w.getCurrencyExchangeRate() != null) continue; // already captured for real
            String currency = resolveCurrency(w.getCustomerName());
            boolean hasCalendarRate = rateRepository
                    .findByRateDateAndCurrency(w.getInvoiceDate(), currency).isPresent();
            if (!hasCalendarRate) {
                missing.add(new MissingRatePair(w.getInvoiceDate().toString(), currency));
            }
        }
        return new ArrayList<>(missing);
    }

    // ── Step 2: save user-entered rates — just the shared exchange-rate calendar ──
    public void saveBackfillRates(List<ExchangeRateService.RateEntry> rates, String username) {
        exchangeRateService.saveRates(rates, username);
    }

    // ── Step 3: build the workbook ─────────────────────────────────────────
    public byte[] buildWorkbook(LocalDate startDate, LocalDate endDate) throws IOException {
        List<WorkOrder> rows = workOrderRepository.findExportableInvoices(
                startDate, endDate, WorkOrder.StepStatus.DONE);

        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            XSSFSheet sheet = wb.createSheet("Export Dispatch Data");

            Font boldFont = wb.createFont();
            boldFont.setBold(true);
            CellStyle headerStyle = wb.createCellStyle();
            headerStyle.setFont(boldFont);

            Row header = sheet.createRow(0);
            for (int c = 0; c < HEADERS.length; c++) {
                Cell cell = header.createCell(c);
                cell.setCellValue(HEADERS[c]);
                cell.setCellStyle(headerStyle);
            }

            int rowIdx = 1;
            for (WorkOrder w : rows) {
                Row row = sheet.createRow(rowIdx++);
                fillRow(row, w);
            }

            for (int c = 0; c < HEADERS.length; c++) sheet.autoSizeColumn(c);

            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            wb.write(bos);
            return bos.toByteArray();
        }
    }

    private void fillRow(Row row, WorkOrder w) {
        String customerName = nvl(w.getCustomerName());
        String mode = resolveMode(w.getShipmentMode());
        boolean isSea = mode.equals("SEA");

        // C — HSN Code (Sulzer = pump parts, else valve parts — mirrors TallyInvoiceService)
        boolean isSulzer = customerName.toUpperCase(Locale.ROOT).startsWith("SULZER");
        String hsnCode = isSulzer ? "84139120" : "84819090";

        // M/N/O — export details looked up the same way the Tally invoice-creation prefill does
        String finalDest = "", portDischarge = "", deliveryTerms = "";
        String[] partyMatch = customData.matchParty(customerName);
        String tallyName = partyMatch != null ? partyMatch[0] : customerName;
        Map<String, String> exp = customData.getExportDetails(tallyName, mode);
        if (exp != null) {
            finalDest = exp.getOrDefault("final_dest", "");
            portDischarge = exp.getOrDefault("port_discharge", "");
            deliveryTerms = exp.getOrDefault("terms", "");
        }

        // J/K — currency is always derived per-party; the rate is either the real one
        // captured at invoice-creation time, or looked up from the shared exchange-rate
        // calendar for that invoice's date. Never blanket-assigned across parties.
        String currency = w.getInvoiceCurrency() != null ? w.getInvoiceCurrency() : resolveCurrency(customerName);
        Double rate = w.getCurrencyExchangeRate();
        if (rate == null && w.getInvoiceDate() != null) {
            rate = rateRepository.findByRateDateAndCurrency(w.getInvoiceDate(), currency)
                    .map(DailyExchangeRate::getRate).orElse(null);
        }

        // I — invoice value in party currency: real Tally-captured value when present,
        // else the total amount the Invoice Creator already sees/verifies in Invoice View
        // (amount_total on the latest work-order Excel).
        Double valueInCurr = w.getInvoiceValueInCurrency();
        if (valueInCurr == null) {
            valueInCurr = fileStorageRepository
                    .findTopActiveByWorkOrderIdAndFileType(w.getId(), FileStorage.FileType.EXCEL)
                    .map(FileStorage::getAmountTotal).orElse(null);
        }

        // L — INR value = I × K, computed whenever both parts are known
        Double valueInr = w.getInvoiceValueInINR();
        if (valueInr == null && valueInCurr != null && rate != null) {
            valueInr = Math.round(valueInCurr * rate * 100.0) / 100.0;
        }

        int c = 0;
        setStr(row, c++, "");                                  // A brc DOUCMENT
        setStr(row, c++, "");                                  // B COMMISSION ENTRY
        setStr(row, c++, hsnCode);                              // C HSN CODE
        setStr(row, c++, "");                                  // D BANK REFERENCE NO
        setStr(row, c++, nvl(w.getInvoiceNumber()));            // E INVOICE NUMBER
        setStr(row, c++, w.getInvoiceDate() != null ? INVOICE_DATE_FMT.format(w.getInvoiceDate()) : ""); // F
        setStr(row, c++, customerName);                         // G CUSTOMER'S NAME
        setStr(row, c++, nvl(w.getShipmentMode()));             // H MODE OF SHIPMENT
        setNum(row, c++, valueInCurr);                          // I INVOICE VALUE IN CURR.
        setStr(row, c++, currency);                             // J CURRENCY
        setNum(row, c++, rate);                                 // K CURRENCY RATE
        setNum(row, c++, valueInr);                             // L INVOICE VALUE IN INR
        setStr(row, c++, finalDest);                            // M FINAL DESTINATION
        setStr(row, c++, portDischarge);                        // N PORT OF DISCHARGE
        setStr(row, c++, deliveryTerms);                        // O DELIVERY TERMS
        setStr(row, c++, "");                                  // P PAYMENT TERMS (no data source)
        setStr(row, c++, "");                                  // Q FORWARDER
        setStr(row, c++, "");                                  // R TRACKING NO.
        setStr(row, c++, "");                                  // S VESSLE
        setStr(row, c++, isSea ? "INNSA1" : "");                // T PORT CODE
        setStr(row, c++, "");                                  // U SHIPPING BILL NO.
        setStr(row, c++, "");                                  // V S.B. DATE
        setStr(row, c++, "");                                  // W EGM.NO
        setStr(row, c++, "");                                  // X EGM.DATE
        setStr(row, c++, "");                                  // Y BILL OF LADING/AWB NO.
        setStr(row, c++, "");                                  // Z BL/AWB DATE
        setStr(row, c++, isSea ? "JNPT" : "");                  // AA PORT NAME - JNPT/SAHAR
        setStr(row, c++, "");                                  // AB
        setStr(row, c++, "");                                  // AC
        setStr(row, c++, "");                                  // AD
        setStr(row, c++, "");                                  // AE
        setStr(row, c++, "");                                  // AF
        setStr(row, c++, "");                                  // AG
        setStr(row, c++, "");                                  // AH
        setStr(row, c, "");                                    // AI
    }

    // Same party -> currency lookup the Tally invoice-creation prefill uses, converted
    // from Tally's internal ledger vocabulary (DOLLAR/POUND/EURO) to the sheet's own
    // convention (USD/GBP/EURO).
    private String resolveCurrency(String customerName) {
        String[] partyMatch = customData.matchParty(customerName);
        String raw = (partyMatch != null && partyMatch.length > 1 && partyMatch[1] != null)
                ? partyMatch[1] : "DOLLAR";
        return switch (raw.toUpperCase(Locale.ROOT)) {
            case "POUND", "GBP" -> "GBP";
            case "EURO", "EUR" -> "EURO";
            default -> "USD";
        };
    }

    private String resolveMode(String shipmentMode) {
        if (shipmentMode == null) return "AIR";
        String m = shipmentMode.toUpperCase(Locale.ROOT);
        if (m.contains("SEA") || m.contains("OCEAN") || m.contains("FCL") || m.contains("LCL")) return "SEA";
        return "AIR";
    }

    private static void setStr(Row row, int col, String value) {
        row.createCell(col).setCellValue(value != null ? value : "");
    }

    private static void setNum(Row row, int col, Double value) {
        if (value != null) row.createCell(col).setCellValue(value);
    }

    private static String nvl(String s) { return s == null ? "" : s; }
}
