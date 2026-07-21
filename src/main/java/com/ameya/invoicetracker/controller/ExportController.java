package com.ameya.invoicetracker.controller;

import com.ameya.invoicetracker.dto.ApiResponse;
import com.ameya.invoicetracker.service.DispatchExportService;
import com.ameya.invoicetracker.service.ExchangeRateService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
@PreAuthorize("hasRole('LOGISTIC')")
public class ExportController {

    private final DispatchExportService exportService;

    /**
     * GET /api/export/dispatch-data/check?startDate=&endDate=
     * Returns whether the range is ready to export, or which (date, currency)
     * pairs are still missing a saved exchange rate. Currency is always
     * derived per-party — never a user choice — so only the currencies a
     * date's invoices actually use are ever asked for.
     */
    @GetMapping("/dispatch-data/check")
    public ResponseEntity<ApiResponse<Map<String, Object>>> check(
            @RequestParam LocalDate startDate,
            @RequestParam LocalDate endDate) {
        List<DispatchExportService.MissingRatePair> missingPairs =
                exportService.findMissingRatePairs(startDate, endDate);
        Map<String, Object> result = Map.of(
                "ready", missingPairs.isEmpty(),
                "missingPairs", missingPairs
        );
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    /**
     * POST /api/export/dispatch-data/rates
     * Saves user-entered exchange rates into the shared exchange-rate
     * calendar (date+currency -> rate). Export resolves each invoice's rate
     * from this table dynamically, so nothing here is written per-invoice.
     */
    @PostMapping("/dispatch-data/rates")
    public ResponseEntity<ApiResponse<Void>> saveRates(
            @RequestBody Map<String, List<Map<String, Object>>> body,
            @AuthenticationPrincipal UserDetails ud) {
        List<Map<String, Object>> rawRates = body.getOrDefault("rates", List.of());
        List<ExchangeRateService.RateEntry> rates = rawRates.stream()
                .map(m -> new ExchangeRateService.RateEntry(
                        (String) m.get("date"),
                        (String) m.get("currency"),
                        m.get("rate") != null ? Double.valueOf(m.get("rate").toString()) : null))
                .toList();
        exportService.saveBackfillRates(rates, ud.getUsername());
        return ResponseEntity.ok(ApiResponse.ok("Rates saved", null));
    }

    /**
     * GET /api/export/dispatch-data/download?startDate=&endDate=
     * Streams the generated .xlsx. Accepts the token either as a Bearer
     * header (used by the frontend's progress-tracked fetch download) or as
     * a query param (same fallback every other download link in this app uses).
     */
    @GetMapping("/dispatch-data/download")
    public ResponseEntity<Resource> download(
            @RequestParam LocalDate startDate,
            @RequestParam LocalDate endDate) throws Exception {
        byte[] bytes = exportService.buildWorkbook(startDate, endDate);
        String filename = "Export Dispatch Data " + startDate + " to " + endDate + ".xlsx";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentLength(bytes.length)
                .body(new ByteArrayResource(bytes));
    }
}
