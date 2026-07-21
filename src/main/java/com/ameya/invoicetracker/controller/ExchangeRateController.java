package com.ameya.invoicetracker.controller;

import com.ameya.invoicetracker.dto.ApiResponse;
import com.ameya.invoicetracker.service.ExchangeRateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/exchange-rates")
@RequiredArgsConstructor
@PreAuthorize("hasRole('LOGISTIC')")
public class ExchangeRateController {

    private final ExchangeRateService exchangeRateService;

    /**
     * GET /api/exchange-rates/month?year=2026&month=5
     * Returns every day of the month with whatever rates are already saved
     * (per currency), so the calendar page can render a full month at once.
     */
    @GetMapping("/month")
    public ResponseEntity<ApiResponse<Map<String, Object>>> month(
            @RequestParam int year,
            @RequestParam int month) {
        Map<String, Object> result = Map.of(
                "currencies", ExchangeRateService.CURRENCIES,
                "days", exchangeRateService.getMonthRates(year, month)
        );
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    /**
     * POST /api/exchange-rates
     * Body: { "rates": [ {date, currency, rate}, ... ] }
     * Upserts the calendar entries and fills any invoices on those dates that
     * are still missing currency data (never overwrites an already-captured rate).
     */
    @PostMapping
    public ResponseEntity<ApiResponse<Void>> save(
            @RequestBody Map<String, List<Map<String, Object>>> body,
            @AuthenticationPrincipal UserDetails ud) {
        List<Map<String, Object>> raw = body.getOrDefault("rates", List.of());
        List<ExchangeRateService.RateEntry> entries = raw.stream()
                .map(m -> new ExchangeRateService.RateEntry(
                        (String) m.get("date"),
                        (String) m.get("currency"),
                        m.get("rate") != null ? Double.valueOf(m.get("rate").toString()) : null))
                .toList();
        exchangeRateService.saveRates(entries, ud.getUsername());
        return ResponseEntity.ok(ApiResponse.ok("Exchange rates saved", null));
    }
}
