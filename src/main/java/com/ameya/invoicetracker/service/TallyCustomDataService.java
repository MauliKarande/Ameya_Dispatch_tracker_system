package com.ameya.invoicetracker.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Paths;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class TallyCustomDataService {

    @Value("${app.tally.custom-data-path:./ameya_custom_data.json}")
    private String customDataPath;

    private final ObjectMapper mapper = new ObjectMapper();
    private JsonNode root;

    // Static party mapping (keyword → {tallyName, currency, country})
    private static final Map<String, String[]> PARTY_MAP = new LinkedHashMap<>();
    static {
        PARTY_MAP.put("trillium flow technologies france sas", new String[]{"TRILLIUM Flow Technologies France SAS","EUR","FRANCE"});
        PARTY_MAP.put("trillium france",   new String[]{"TRILLIUM Flow Technologies France SAS","EUR","FRANCE"});
        PARTY_MAP.put("trillium uk",       new String[]{"TRILLIUM FLOW TECHNOLOGIES UK","POUND","UNITED KINGDOM"});
        PARTY_MAP.put("trillium flow technologies uk", new String[]{"TRILLIUM FLOW TECHNOLOGIES UK","POUND","UNITED KINGDOM"});
        PARTY_MAP.put("trillium valves usa", new String[]{"TRILLIUM VALVES USA","DOLLAR","UNITED STATES"});
        PARTY_MAP.put("crane slovenija",   new String[]{"ARMATURE D.O.O (SLOVENIJA)","EUR","SLOVENIA"});
        PARTY_MAP.put("crene slovenija",   new String[]{"ARMATURE D.O.O (SLOVENIJA)","EUR","SLOVENIA"});
        PARTY_MAP.put("armature d.o.o",    new String[]{"ARMATURE D.O.O (SLOVENIJA)","EUR","SLOVENIA"});
        PARTY_MAP.put("armature",          new String[]{"ARMATURE D.O.O (SLOVENIJA)","EUR","SLOVENIA"});
        PARTY_MAP.put("flowserve do brasil ltda sao caetano do sul", new String[]{"Flowserve do Brasil LTD","DOLLAR","BRAZIL"});
        PARTY_MAP.put("flowserve do brasil ltda sao", new String[]{"Flowserve do Brasil LTD","DOLLAR","BRAZIL"});
        PARTY_MAP.put("flowserve do brasil ltd",       new String[]{"Flowserve do Brasil LTD","DOLLAR","BRAZIL"});
        PARTY_MAP.put("flowserve brasil",  new String[]{"Flowserve do Brasil LTD","DOLLAR","BRAZIL"});
        PARTY_MAP.put("sulzer leeds pmc",  new String[]{"SULZER LEEDS PMC - UK","POUND","UNITED KINGDOM"});
        PARTY_MAP.put("sulzer leeds",      new String[]{"SULZER LEEDS PMC - UK","POUND","UNITED KINGDOM"});
        PARTY_MAP.put("sulzer pumps (canada) inc", new String[]{"SULZER PUMPS (CANADA) INC","DOLLAR","CANADA"});
        PARTY_MAP.put("sulzer canada",     new String[]{"SULZER PUMPS (CANADA) INC","DOLLAR","CANADA"});
        PARTY_MAP.put("flowserve singapore", new String[]{"FLOWSERVE PTE LTD. - Singapore","DOLLAR","SINGAPORE"});
        PARTY_MAP.put("flowserve pte ltd", new String[]{"FLOWSERVE PTE LTD. - Singapore","DOLLAR","SINGAPORE"});
        PARTY_MAP.put("sulzer pumps (us) inc", new String[]{"SULZER PUMPS (US) INC","DOLLAR","UNITED STATES"});
        PARTY_MAP.put("sulzer us",         new String[]{"SULZER PUMPS (US) INC","DOLLAR","UNITED STATES"});
        PARTY_MAP.put("fcd springville",   new String[]{"FLOWSERVE CORPORATION (FCD) SPRINGVILLE OPERATION","DOLLAR","UNITED STATES"});
        PARTY_MAP.put("flowserve springville", new String[]{"FLOWSERVE CORPORATION (FCD) SPRINGVILLE OPERATION","DOLLAR","UNITED STATES"});
        PARTY_MAP.put("adams armaturen gmbh", new String[]{"ADAMS ARMATUREN GmbH","DOLLAR","GERMANY"});
        PARTY_MAP.put("adams armaturen",   new String[]{"ADAMS ARMATUREN GmbH","DOLLAR","GERMANY"});
        PARTY_MAP.put("baf valves",        new String[]{"BAF VALVES","EUR","UNITED ARAB EMIRATES"});
        PARTY_MAP.put("sulzer pumps (uk) ltd", new String[]{"SULZER PUMPS (UK) LTD.","POUND","UNITED KINGDOM"});
        PARTY_MAP.put("sulzer pumps uk",   new String[]{"SULZER PUMPS (UK) LTD.","POUND","UNITED KINGDOM"});
        PARTY_MAP.put("sulzer uk",         new String[]{"SULZER PUMPS (UK) LTD.","POUND","UNITED KINGDOM"});
        PARTY_MAP.put("flowserve raleigh", new String[]{"FLOWSERVE FLOW CONTROL DIVISION, RALEIGH","DOLLAR","UNITED STATES"});
        PARTY_MAP.put("flowserve flow control", new String[]{"FLOWSERVE FLOW CONTROL DIVISION, RALEIGH","DOLLAR","UNITED STATES"});
        PARTY_MAP.put("sulzer pumps mexico, sa de cv", new String[]{"SULZER PUMPS MEXICO, SA de CV","DOLLAR","MEXICO"});
        PARTY_MAP.put("sulzer pumps mexico", new String[]{"SULZER PUMPS MEXICO, SA de CV","DOLLAR","MEXICO"});
        PARTY_MAP.put("sulzer mexico",     new String[]{"SULZER PUMPS MEXICO, SA de CV","DOLLAR","MEXICO"});
        PARTY_MAP.put("koso kent introl",  new String[]{"KOSO KENT INTROL LIMITED","POUND","UNITED KINGDOM"});
        PARTY_MAP.put("sulzer pumpen deutschland", new String[]{"SULZER PUMPEN (DEUTSCHLAND) GMBH","EUR","GERMANY"});
        PARTY_MAP.put("sulzer deutschland", new String[]{"SULZER PUMPEN (DEUTSCHLAND) GMBH","EUR","GERMANY"});
        PARTY_MAP.put("flowserve nadc",    new String[]{"Flowserve US Company - NADC","DOLLAR","UNITED STATES"});
        PARTY_MAP.put("flowserve us company - nadc", new String[]{"Flowserve US Company - NADC","DOLLAR","UNITED STATES"});
        PARTY_MAP.put("flowserve fco pasadena", new String[]{"Flowserve US Company-Flowserve FCO Pasadena","DOLLAR","UNITED STATES"});
        PARTY_MAP.put("flowserve essen",   new String[]{"Flowserve Essen GmbH","DOLLAR","GERMANY"});
        PARTY_MAP.put("flowserve austria", new String[]{"FLOWSERVE CONTROL VALVES GMBH - AUSTRIA","DOLLAR","AUSTRIA"});
        PARTY_MAP.put("flowserve control valves gmbh", new String[]{"FLOWSERVE CONTROL VALVES GMBH - AUSTRIA","DOLLAR","AUSTRIA"});
        PARTY_MAP.put("flowserve control valves gmbh - austria", new String[]{"FLOWSERVE CONTROL VALVES GMBH - AUSTRIA","DOLLAR","AUSTRIA"});
        PARTY_MAP.put("sulzer pompes france", new String[]{"Sulzer Pompes France","EUR","FRANCE"});
        PARTY_MAP.put("sulzer brasil",     new String[]{"Sulzer Brasil S.A.","DOLLAR","BRAZIL"});
        PARTY_MAP.put("sulzer brasil s.a", new String[]{"Sulzer Brasil S.A.","DOLLAR","BRAZIL"});
        PARTY_MAP.put("sulzer pumps mexico", new String[]{"SULZER PUMPS MEXICO, SA de CV","DOLLAR","MEXICO"});
    }

    // ── Hardcoded export details (mirrors Python script's EXPORT_DETAILS) ───
    private static final Map<String, Map<String, String>> EXPORT_MAP = new LinkedHashMap<>();
    static {
        e("FLOWSERVE CORPORATION (FCD) SPRINGVILLE OPERATION","SEA","EX-WORKS PUNE","JNPT - MUMBAI","LOS - ANGELES","UNITED STATES","UNITED STATES","","");
        e("FLOWSERVE CORPORATION (FCD) SPRINGVILLE OPERATION","AIR","EX-WORKS PUNE","MUMBAI","LOS - ANGELES","UNITED STATES","UNITED STATES","FLOWSERVE US COMPANY.","5215 N. O Connor Blvd., Ste. 700, Irving, TX, 75039, USA");
        e("TRILLIUM FLOW TECHNOLOGIES FRANCE SAS","SEA","EX-WORKS PUNE","JNPT-MUMBAI","ANTWERP","FRANCE","FRANCE","","");
        e("TRILLIUM FLOW TECHNOLOGIES FRANCE SAS","AIR","EX-WORKS PUNE","MUMBAI","LILLE (FRILL)","FRANCE","FRANCE","","");
        e("SULZER PUMPS (CANADA) INC","AIR","EX-WORKS PUNE","MUMBAI","VANCOUVER","CANADA","CANADA","","");
        e("SULZER PUMPS (CANADA) INC","SEA","EX-WORKS PUNE","JNPT-MUMBAI","VANCOUVER","CANADA","CANADA","","");
        e("TRILLIUM FLOW TECHNOLOGIES UK","AIR","CIF - MANCHESTER","MUMBAI","MANCHESTER","UNITED KINGDOM","UNITED KINGDOM","","");
        e("TRILLIUM FLOW TECHNOLOGIES UK","SEA","CIF - LONDON","JNPT - MUMBAI","FELIXSTOWE / LONDON GATEWAY","UNITED KINGDOM","UNITED KINGDOM","","");
        e("SULZER PUMPS (US) INC","AIR","EX-WORKS PUNE","MUMBAI","NEW YORK","UNITED STATES","UNITED STATES","","");
        e("SULZER PUMPS (US) INC","SEA","EX-WORKS PUNE","JNPT-MUMBAI","NEW YORK","UNITED STATES","UNITED STATES","","");
        e("ADAMS ARMATUREN GMBH","AIR","EX-WORKS PUNE","MUMBAI","FRANKFURT","GERMANY","GERMANY","","");
        e("ADAMS ARMATUREN GMBH","SEA","CIF HAMBURG","JNPT MUMBAI","HAMBURG","GERMANY","GERMANY","","");
        e("SULZER LEEDS PMC - UK","AIR","EX-WORKS PUNE","MUMBAI","MANCHESTER","UNITED KINGDOM","UNITED KINGDOM","","");
        e("SULZER LEEDS PMC - UK","SEA","EX-WORKS PUNE","JNPT-MUMBAI","MANCHESTER","UNITED KINGDOM","UNITED KINGDOM","","");
        e("SULZER PUMPEN (DEUTSCHLAND) GMBH","AIR","EX-WORKS PUNE","MUMBAI","FRANKFURT","GERMANY","GERMANY","","");
        e("SULZER PUMPEN (DEUTSCHLAND) GMBH","SEA","EX-WORKS PUNE","JNPT-MUMBAI","FRANKFURT","GERMANY","GERMANY","","");
        e("SULZER PUMPS MEXICO, SA DE CV","AIR","EX-WORKS PUNE","MUMBAI","MEXICO CITY","MEXICO","MEXICO","","");
        e("SULZER PUMPS MEXICO, SA DE CV","SEA","EX-WORKS PUNE","JNPT-MUMBAI","MEXICO CITY","MEXICO","MEXICO","","");
        e("KOSO KENT INTROL LIMITED","AIR","EX-WORKS PUNE","MUMBAI","MANCHESTER","UNITED KINGDOM","UNITED KINGDOM","","");
        e("KOSO KENT INTROL LIMITED","SEA","EX-WORKS PUNE","JNPT-MUMBAI","FELIXSTOWE","UNITED KINGDOM","UNITED KINGDOM","","");
        e("BAF VALVES","AIR","EX-WORKS PUNE","MUMBAI","NAD AL SHEBA","UAE","UNITED ARAB EMIRATES","","");
        e("BAF VALVES","SEA","EX-WORKS PUNE","JNPT - MUMBAI","JEBEL ALI","UAE","UNITED ARAB EMIRATES","","");
        e("FLOWSERVE PTE LTD. - SINGAPORE","AIR","EX-WORKS PUNE","MUMBAI","SINGAPORE","SINGAPORE","SINGAPORE","FLOWSERVE US COMPANY.","");
        e("FLOWSERVE PTE LTD. - SINGAPORE","SEA","EX-WORKS PUNE","JNPT-MUMBAI","SINGAPORE","SINGAPORE","SINGAPORE","FLOWSERVE US COMPANY.","");
        e("FLOWSERVE FLOW CONTROL DIVISION, RALEIGH","AIR","EX-WORKS PUNE","MUMBAI","RALEIGH","UNITED STATES","UNITED STATES","FLOWSERVE US COMPANY.","");
        e("FLOWSERVE FLOW CONTROL DIVISION, RALEIGH","SEA","EX-WORKS PUNE","JNPT-MUMBAI","RALEIGH","UNITED STATES","UNITED STATES","FLOWSERVE US COMPANY.","");
        e("FLOWSERVE DO BRASIL LTDA (TAX ID 33.273.681/0001-10)","AIR","EX-WORKS PUNE","MUMBAI","RIO DE JANEIRO","BRAZIL","BRAZIL","","");
        e("FLOWSERVE DO BRASIL LTDA (TAX ID 33.273.681/0001-10)","SEA","EX-WORKS PUNE","JNPT-MUMBAI","RIO DE JANEIRO","BRAZIL","BRAZIL","","");
        e("FLOWSERVE DO BRASIL LTD","AIR","EX-WORKS PUNE","MUMBAI","SAO PAULO","BRAZIL","BRAZIL","","");
        e("FLOWSERVE DO BRASIL LTD","SEA","EX-WORKS PUNE","JNPT-MUMBAI","SAO PAULO","BRAZIL","BRAZIL","","");
        e("SULZER PUMPS (UK) LTD.","AIR","EX-WORKS PUNE","MUMBAI","MANCHESTER","UNITED KINGDOM","UNITED KINGDOM","","");
        e("SULZER PUMPS (UK) LTD.","SEA","EX-WORKS PUNE","JNPT-MUMBAI","MANCHESTER","UNITED KINGDOM","UNITED KINGDOM","","");
        e("TRILLIUM VALVES USA","SEA","CIF - NEW YORK","JNPT - MUMBAI","NEW YORK","UNITED STATES","UNITED STATES","","");
        e("TRILLIUM VALVES USA","AIR","EX-WORKS PUNE","MUMBAI","NEW YORK","UNITED STATES","UNITED STATES","","");
        e("ARMATURE D.O.O (SLOVENIJA)","AIR","EX-WORKS PUNE","MUMBAI","LJUBLJANA","SLOVENIA","SLOVENIA","","");
        e("ARMATURE D.O.O (SLOVENIJA)","SEA","EX-WORKS PUNE","JNPT-MUMBAI","LJUBLJANA","SLOVENIA","SLOVENIA","","");
    }
    private static void e(String p, String md, String terms, String pl, String pd,
                          String fin, String ctr, String bn, String ba) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("terms", terms); m.put("port_loading", pl); m.put("port_discharge", pd);
        m.put("final_dest", fin); m.put("country_dest", ctr);
        m.put("buyer_name", bn); m.put("buyer_address", ba);
        EXPORT_MAP.put(p.toUpperCase() + "|" + md.toUpperCase(), m);
    }

    @PostConstruct
    public void load() {
        try {
            File f = Paths.get(customDataPath).toFile();
            if (f.exists()) {
                root = mapper.readTree(f);
                log.info("TallyCustomData loaded from {}", f.getAbsolutePath());
            } else {
                root = mapper.createObjectNode();
                log.warn("ameya_custom_data.json not found at {}", f.getAbsolutePath());
            }
        } catch (Exception e) {
            root = mapper.createObjectNode();
            log.error("Failed to load ameya_custom_data.json: {}", e.getMessage());
        }
    }

    public void reload() { load(); }

    /** Returns {tallyName, currency, country} or null. */
    public String[] matchParty(String customerName) {
        if (customerName == null || customerName.isBlank()) return null;
        String key = customerName.toLowerCase().strip();

        // 1. Exact match in static map
        if (PARTY_MAP.containsKey(key)) return PARTY_MAP.get(key);
        // 2. Substring match in static map
        for (Map.Entry<String, String[]> e : PARTY_MAP.entrySet()) {
            if (key.contains(e.getKey()) || e.getKey().contains(key)) return e.getValue();
        }
        // 3. Word match (>= 2 words of length > 3)
        Set<String> words = wordSet(key);
        String[] best = null; int bestN = 0;
        for (Map.Entry<String, String[]> e : PARTY_MAP.entrySet()) {
            int n = countCommonWords(words, wordSet(e.getKey()));
            if (n >= 2 && n > bestN) { bestN = n; best = e.getValue(); }
        }
        if (best != null) return best;
        // 4. JSON parties section
        JsonNode parties = root.path("parties");
        if (!parties.isMissingNode()) {
            Iterator<Map.Entry<String, JsonNode>> it = parties.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> entry = it.next();
                if (normalise(entry.getKey()).contains(normalise(customerName))
                        || normalise(customerName).contains(normalise(entry.getKey()))) {
                    JsonNode v = entry.getValue();
                    return new String[]{ v.path("tally_name").asText(""), v.path("currency").asText("DOLLAR"), "" };
                }
            }
        }
        return null;
    }

    /** Returns export details map or null. JSON takes priority over hardcoded defaults. */
    public Map<String, String> getExportDetails(String tallyName, String mode) {
        if (tallyName == null || mode == null) return null;
        String keyUpper = tallyName.toUpperCase() + "|" + mode.toUpperCase();

        // 1. JSON exact match (user-saved → highest priority)
        JsonNode expNode = root.path("export_details").path(keyUpper);
        if (!expNode.isMissingNode()) return jsonToMap(expNode);

        // 2. JSON fuzzy match
        JsonNode expRoot = root.path("export_details");
        if (!expRoot.isMissingNode()) {
            Iterator<Map.Entry<String, JsonNode>> it = expRoot.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> entry = it.next();
                String[] kp = entry.getKey().split("\\|");
                if (kp.length == 2 && kp[1].equalsIgnoreCase(mode)
                        && (normalise(kp[0]).contains(normalise(tallyName))
                            || normalise(tallyName).contains(normalise(kp[0])))) {
                    return jsonToMap(entry.getValue());
                }
            }
        }

        // 3. Hardcoded EXPORT_MAP exact match
        Map<String, String> hard = EXPORT_MAP.get(keyUpper);
        if (hard != null) return new LinkedHashMap<>(hard);

        // 4. Hardcoded EXPORT_MAP fuzzy match
        for (Map.Entry<String, Map<String, String>> entry : EXPORT_MAP.entrySet()) {
            String[] kp = entry.getKey().split("\\|");
            if (kp.length == 2 && kp[1].equalsIgnoreCase(mode)
                    && (normalise(kp[0]).contains(normalise(tallyName))
                        || normalise(tallyName).contains(normalise(kp[0])))) {
                return new LinkedHashMap<>(entry.getValue());
            }
        }

        return null;
    }

    /** Returns saved address data or null. */
    public Map<String, Object> getAddress(String partyName) {
        if (partyName == null) return null;
        JsonNode node = root.path("addresses").path(partyName);
        if (!node.isMissingNode()) {
            Map<String, Object> result = new HashMap<>();
            result.put("mailing_name", node.path("mailing_name").asText(partyName));
            List<String> lines = new ArrayList<>();
            node.path("address_lines").forEach(n -> lines.add(n.asText()));
            result.put("address_lines", lines);
            result.put("country", node.path("country").asText(""));
            result.put("state", node.path("state").asText(""));
            result.put("pincode", node.path("pincode").asText(""));
            result.put("gstin", node.path("gstin").asText(""));
            return result;
        }
        // Fuzzy
        Iterator<Map.Entry<String, JsonNode>> it = root.path("addresses").fields();
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> entry = it.next();
            if (normalise(entry.getKey()).equals(normalise(partyName))) {
                JsonNode n = entry.getValue();
                Map<String, Object> result = new HashMap<>();
                result.put("mailing_name", n.path("mailing_name").asText(partyName));
                List<String> lines = new ArrayList<>();
                n.path("address_lines").forEach(l -> lines.add(l.asText()));
                result.put("address_lines", lines);
                result.put("country", n.path("country").asText(""));
                result.put("gstin", n.path("gstin").asText(""));
                return result;
            }
        }
        return null;
    }

    /**
     * Caches an address fetched live from Tally's own ledger master (see
     * TallyInvoiceService.fetchLedgerAddressFromTally) so future invoices for this
     * party don't need to re-query Tally. Best-effort: failures are logged, not thrown,
     * since this is only a cache write and must never block invoice creation.
     */
    public void cacheAddress(String partyName, String mailingName, List<String> addressLines, String country) {
        if (partyName == null || partyName.isBlank() || addressLines == null || addressLines.isEmpty()) return;
        try {
            File f = Paths.get(customDataPath).toFile();
            ObjectNode root = (ObjectNode) (f.exists() ? mapper.readTree(f) : mapper.createObjectNode());
            if (!root.has("addresses") || !root.get("addresses").isObject())
                root.set("addresses", mapper.createObjectNode());
            ObjectNode addrRoot = (ObjectNode) root.get("addresses");
            ObjectNode entry = mapper.createObjectNode();
            entry.put("mailing_name", mailingName != null && !mailingName.isBlank() ? mailingName : partyName);
            entry.put("country", country != null ? country : "");
            var linesArr = mapper.createArrayNode();
            addressLines.forEach(linesArr::add);
            entry.set("address_lines", linesArr);
            addrRoot.set(partyName, entry);

            mapper.writerWithDefaultPrettyPrinter().writeValue(f, root);
            this.root = root;
            log.info("Cached ledger address for '{}' fetched live from Tally", partyName);
        } catch (Exception e) {
            log.warn("Failed to cache ledger address for '{}': {}", partyName, e.getMessage());
        }
    }

    public Map<String, String> getDualAddress(String partyName) {
        if (partyName == null) return null;
        JsonNode node = root.path("party_dual_address").path(partyName);
        if (!node.isMissingNode() && node.path("has_both").asBoolean(false)) {
            Map<String, String> m = new HashMap<>();
            m.put("buyer_name", node.path("buyer_name").asText(""));
            m.put("buyer_address", node.path("buyer_address").asText(""));
            return m;
        }
        return null;
    }

    public String getLastVoucherNo() { return root.path("last_voucher_no").asText(""); }

    public String getMainInvoiceFolder() { return root.path("main_invoice_folder").asText(""); }

    public String incrementVoucherNo(String vn) {
        if (vn == null || vn.isBlank()) return "";
        Matcher m = Pattern.compile("(\\d+)(\\D*)$").matcher(vn);
        if (m.find()) {
            String digits = m.group(1);
            String suffix = m.group(2);
            String next = String.valueOf(Long.parseLong(digits) + 1);
            while (next.length() < digits.length()) next = "0" + next;
            return vn.substring(0, m.start(1)) + next + suffix;
        }
        return vn;
    }

    /**
     * Saves/updates party export details and address into ameya_custom_data.json.
     * Creates entries under export_details (PARTY|MODE key) and addresses sections.
     */
    public void savePartyDetails(String partyName, String currency, String country,
                                  String airSea, String terms, String portLoading,
                                  String portDischarge, String finalDest, String countryDest,
                                  String buyerName, String buyerAddress) {
        try {
            File f = Paths.get(customDataPath).toFile();
            ObjectNode root = (ObjectNode) (f.exists() ? mapper.readTree(f) : mapper.createObjectNode());

            // Save export_details
            if (!root.has("export_details") || !root.get("export_details").isObject())
                root.set("export_details", mapper.createObjectNode());
            ObjectNode expRoot = (ObjectNode) root.get("export_details");
            String expKey = partyName.toUpperCase() + "|" + airSea.toUpperCase();
            ObjectNode expEntry = mapper.createObjectNode();
            expEntry.put("terms",          terms          != null ? terms          : "");
            expEntry.put("port_loading",   portLoading    != null ? portLoading    : "");
            expEntry.put("port_discharge", portDischarge  != null ? portDischarge  : "");
            expEntry.put("final_dest",     finalDest      != null ? finalDest      : "");
            expEntry.put("country_dest",   countryDest    != null ? countryDest    : "");
            expEntry.put("buyer_name",     buyerName      != null ? buyerName      : "");
            expEntry.put("buyer_address",  buyerAddress   != null ? buyerAddress   : "");
            expRoot.set(expKey, expEntry);

            // Save parties section
            if (!root.has("parties") || !root.get("parties").isObject())
                root.set("parties", mapper.createObjectNode());
            ObjectNode partiesRoot = (ObjectNode) root.get("parties");
            ObjectNode partyEntry = mapper.createObjectNode();
            partyEntry.put("tally_name", partyName);
            partyEntry.put("currency",   currency != null ? currency : "DOLLAR");
            partyEntry.put("country",    country  != null ? country  : "");
            partiesRoot.set(partyName.toLowerCase(), partyEntry);

            mapper.writerWithDefaultPrettyPrinter().writeValue(f, root);
            this.root = root;
            log.info("Saved party details for '{}' ({})", partyName, expKey);
        } catch (Exception e) {
            log.error("Could not save party details: {}", e.getMessage());
            throw new RuntimeException("Failed to save: " + e.getMessage());
        }
    }

    /**
     * Creates/updates a party's core identity: parties section (tally name,
     * currency, country — what matchParty() resolves) and addresses section
     * (mailing name + address lines — what goes into the Tally XML ADDRESS.LIST).
     * Export details (terms/ports per AIR/SEA) are saved separately via savePartyDetails.
     */
    public void createParty(String partyName, String currency, String country,
                            String mailingName, List<String> addressLines) {
        if (partyName == null || partyName.isBlank())
            throw new IllegalArgumentException("Party name is required");
        try {
            File f = Paths.get(customDataPath).toFile();
            ObjectNode root = (ObjectNode) (f.exists() ? mapper.readTree(f) : mapper.createObjectNode());

            if (!root.has("parties") || !root.get("parties").isObject())
                root.set("parties", mapper.createObjectNode());
            ObjectNode partiesRoot = (ObjectNode) root.get("parties");
            ObjectNode partyEntry = mapper.createObjectNode();
            partyEntry.put("tally_name", partyName);
            partyEntry.put("currency",   currency != null && !currency.isBlank() ? currency : "DOLLAR");
            partyEntry.put("country",    country  != null ? country  : "");
            partiesRoot.set(partyName.toLowerCase(), partyEntry);

            if (!root.has("addresses") || !root.get("addresses").isObject())
                root.set("addresses", mapper.createObjectNode());
            ObjectNode addrRoot = (ObjectNode) root.get("addresses");
            ObjectNode addrEntry = mapper.createObjectNode();
            addrEntry.put("mailing_name", mailingName != null && !mailingName.isBlank() ? mailingName : partyName);
            addrEntry.put("country", country != null ? country : "");
            var linesArr = mapper.createArrayNode();
            if (addressLines != null) {
                addressLines.stream()
                        .filter(l -> l != null && !l.isBlank())
                        .forEach(l -> linesArr.add(l.strip()));
            }
            addrEntry.set("address_lines", linesArr);
            addrRoot.set(partyName, addrEntry);

            mapper.writerWithDefaultPrettyPrinter().writeValue(f, root);
            this.root = root;
            log.info("Created/updated party '{}' with {} address lines", partyName, linesArr.size());
        } catch (Exception e) {
            log.error("Could not create party: {}", e.getMessage());
            throw new RuntimeException("Failed to create party: " + e.getMessage());
        }
    }

    public void saveLastVoucherNo(String vn) {
        try {
            File f = Paths.get(customDataPath).toFile();
            JsonNode node = f.exists() ? mapper.readTree(f) : mapper.createObjectNode();
            ((ObjectNode) node).put("last_voucher_no", vn);
            mapper.writerWithDefaultPrettyPrinter().writeValue(f, node);
            root = node;
        } catch (Exception e) {
            log.warn("Could not save last_voucher_no: {}", e.getMessage());
        }
    }

    private static String normalise(String s) {
        return s == null ? "" : s.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    private static Set<String> wordSet(String s) {
        Set<String> result = new HashSet<>();
        for (String w : s.split("[^a-z]+")) { if (w.length() > 3) result.add(w); }
        return result;
    }

    private static int countCommonWords(Set<String> a, Set<String> b) {
        int count = 0;
        for (String w : a) { if (b.contains(w)) count++; }
        return count;
    }

    private static Map<String, String> jsonToMap(JsonNode n) {
        Map<String, String> m = new HashMap<>();
        n.fields().forEachRemaining(e -> m.put(e.getKey(), e.getValue().asText("")));
        return m;
    }
}
