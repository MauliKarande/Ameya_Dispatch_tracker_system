package com.ameya.invoicetracker.controller;

import com.ameya.invoicetracker.dto.*;
import com.ameya.invoicetracker.entity.FileStorage;
import com.ameya.invoicetracker.entity.WorkOrder;
import com.ameya.invoicetracker.exception.ResourceNotFoundException;
import com.ameya.invoicetracker.repository.FileStorageRepository;
import com.ameya.invoicetracker.repository.WorkOrderRepository;
import com.ameya.invoicetracker.service.ExcelParserService;
import com.ameya.invoicetracker.service.TallyCustomDataService;
import com.ameya.invoicetracker.service.TallyInvoiceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/tally")
@RequiredArgsConstructor
@Slf4j
public class TallyInvoiceController {

    private final WorkOrderRepository workOrderRepository;
    private final FileStorageRepository fileStorageRepository;
    private final TallyCustomDataService customData;
    private final ExcelParserService excelParser;
    private final TallyInvoiceService tallyService;

    /**
     * GET /api/tally/prefill/{workOrderId}
     * Returns all pre-filled data for the Create Invoice modal.
     */
    @GetMapping("/prefill/{workOrderId}")
    public ResponseEntity<ApiResponse<TallyPrefillDTO>> prefill(
            @PathVariable Long workOrderId,
            @RequestParam(defaultValue = "v374") String method) {
        WorkOrder wo = workOrderRepository.findById(workOrderId)
                .orElseThrow(() -> new ResourceNotFoundException("WorkOrder not found: " + workOrderId));

        TallyPrefillDTO dto = new TallyPrefillDTO();

        // --- Party matching ---
        String customerName = wo.getCustomerName();
        String[] partyMatch = customData.matchParty(customerName);
        String tallyName = partyMatch != null ? partyMatch[0] : customerName;
        String currency  = partyMatch != null ? partyMatch[1] : "DOLLAR";
        String country   = partyMatch != null && partyMatch.length > 2 ? partyMatch[2] : "";

        dto.setPartyTally(tallyName);
        dto.setCurrency(currency);
        dto.setPartyCountry(country);

        // --- Shipment mode mapping ---
        String mode = resolveMode(wo.getShipmentMode());
        dto.setAirSea(mode);

        // --- Export details ---
        Map<String, String> exp = customData.getExportDetails(tallyName, mode);
        if (exp != null) {
            dto.setTerms(exp.getOrDefault("terms", ""));
            dto.setPortLoading(exp.getOrDefault("port_loading", ""));
            dto.setPortDischarge(exp.getOrDefault("port_discharge", ""));
            dto.setFinalDest(exp.getOrDefault("final_dest", ""));
            dto.setCountryDest(exp.getOrDefault("country_dest", ""));
            dto.setBuyerName(exp.getOrDefault("buyer_name", ""));
            dto.setBuyerAddress(exp.getOrDefault("buyer_address", ""));
        }
        // Dual address override
        Map<String, String> dual = customData.getDualAddress(tallyName);
        if (dual != null) {
            if (!dual.getOrDefault("buyer_name", "").isBlank())
                dto.setBuyerName(dual.get("buyer_name"));
            if (!dual.getOrDefault("buyer_address", "").isBlank())
                dto.setBuyerAddress(dual.get("buyer_address"));
        }

        // --- Address ---
        Map<String, Object> addr = customData.getAddress(tallyName);
        if (addr != null) {
            dto.setMailingName((String) addr.getOrDefault("mailing_name", tallyName));
            @SuppressWarnings("unchecked")
            List<String> lines = (List<String>) addr.getOrDefault("address_lines", List.of());
            dto.setAddressLines(lines);
        } else {
            dto.setMailingName(tallyName);
            dto.setAddressLines(List.of());
        }

        // --- Voucher number ---
        String last = customData.getLastVoucherNo();
        dto.setLastVoucherNo(last);
        dto.setNextVoucherNo(customData.incrementVoucherNo(last));

        // --- Invoice folder ---
        dto.setMainInvoiceFolder(customData.getMainInvoiceFolder());

        // --- Parse latest Excel ---
        Optional<FileStorage> xlsOpt = fileStorageRepository
                .findTopActiveByWorkOrderIdAndFileType(workOrderId, FileStorage.FileType.EXCEL);
        if (xlsOpt.isPresent()) {
            FileStorage fs = xlsOpt.get();
            log.info("Parsing Excel: {}", fs.getFilePath());
            List<TallyPartDTO> parts = excelParser.parseParts(fs.getFilePath(), customerName, method);
            dto.setParts(parts);
            if (parts.isEmpty()) {
                dto.setParseError("No parts could be extracted from: " + fs.getOriginalFileName()
                        + ". Check if the customer name in Excel matches the work order.");
            }
        } else {
            dto.setParts(List.of());
            dto.setParseError("No Excel file uploaded for this dispatch.");
        }

        return ResponseEntity.ok(ApiResponse.ok(dto));
    }

    /**
     * POST /api/tally/send
     * Builds Tally XML and sends it to Tally HTTP API.
     */
    @PostMapping("/send")
    public ResponseEntity<ApiResponse<Map<String, String>>> send(@RequestBody TallyCreateRequest req) {
        if (req.getParts() == null || req.getParts().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("No parts in request"));
        }
        String tallyResponse = tallyService.sendToTally(req);
        String status;
        if (tallyResponse.contains("<CREATED>1</CREATED>")) status = "CREATED";
        else if (tallyResponse.contains("<ALTERED>1</ALTERED>")) status = "ALTERED";
        else if (tallyResponse.startsWith("ERROR:")) status = "CONNECTION_ERROR";
        else if (tallyResponse.contains("LINEERROR")) status = "LINE_ERROR";
        else status = "UNKNOWN";

        Map<String, String> result = new HashMap<>();
        result.put("status", status);
        result.put("tallyResponse", tallyResponse.length() > 1000
                ? tallyResponse.substring(0, 1000) : tallyResponse);
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    /**
     * POST /api/tally/create-folders
     * Creates invoice folder + 3 blank PDF files.
     */
    @PostMapping("/create-folders")
    public ResponseEntity<ApiResponse<Map<String, String>>> createFolders(@RequestBody TallyCreateRequest req) {
        String folder = req.getMainInvoiceFolder();
        if (folder == null || folder.isBlank()) {
            folder = customData.getMainInvoiceFolder();
        }
        if (folder.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Main invoice folder path not configured"));
        }
        String result = tallyService.createFolders(
                req.getVoucherNumber(), req.getPartyTally(), req.getAirSea(), folder);

        Map<String, String> resp = new HashMap<>();
        if (result.startsWith("OK:")) {
            resp.put("status", "OK");
            resp.put("folderPath", result.substring(3));
        } else {
            resp.put("status", "ERROR");
            resp.put("message", result);
        }
        return ResponseEntity.ok(ApiResponse.ok(resp));
    }

    /**
     * POST /api/tally/check-parts
     * Queries Tally HTTP server for all stock items and returns which parts exist.
     */
    @PostMapping("/check-parts")
    public ResponseEntity<ApiResponse<Map<String, Object>>> checkParts(@RequestBody Map<String, List<String>> body) {
        List<String> parts = body.get("parts");
        if (parts == null || parts.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("No parts provided"));
        }
        try {
            Map<String, Object> result = tallyService.checkPartsInTally(parts);
            return ResponseEntity.ok(ApiResponse.ok(result));
        } catch (Exception e) {
            return ResponseEntity.status(503).body(ApiResponse.error(e.getMessage()));
        }
    }

    /**
     * POST /api/tally/save-party
     * Saves current party + export details back to ameya_custom_data.json.
     */
    @PostMapping("/save-party")
    public ResponseEntity<ApiResponse<String>> saveParty(@RequestBody TallyCreateRequest req) {
        try {
            customData.savePartyDetails(
                    req.getPartyTally(),
                    req.getCurrency(),
                    req.getPartyCountry(),
                    req.getAirSea() != null ? req.getAirSea() : "AIR",
                    req.getTerms(),
                    req.getPortLoading(),
                    req.getPortDischarge(),
                    req.getFinalDest(),
                    req.getCountryDest(),
                    req.getBuyerName(),
                    req.getBuyerAddress());
            return ResponseEntity.ok(ApiResponse.ok("Party details saved to ameya_custom_data.json"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    /**
     * GET /api/tally/ping
     * Checks if the Tally HTTP server is reachable on localhost:9000.
     */
    @GetMapping("/ping")
    public ResponseEntity<ApiResponse<Map<String, String>>> ping() {
        Map<String, String> result = tallyService.pingTally();
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    /**
     * POST /api/tally/reload-custom-data
     * Reloads ameya_custom_data.json from disk.
     */
    @PostMapping("/reload-custom-data")
    public ResponseEntity<ApiResponse<String>> reloadCustomData() {
        customData.reload();
        return ResponseEntity.ok(ApiResponse.ok("Custom data reloaded"));
    }

    // ── Helpers ──────────────────────────────────────────────────────────
    private String resolveMode(String shipmentMode) {
        if (shipmentMode == null) return "AIR";
        String m = shipmentMode.toUpperCase();
        if (m.contains("SEA") || m.contains("OCEAN") || m.contains("FCL") || m.contains("LCL")) return "SEA";
        return "AIR";
    }
}
