package com.ameya.invoicetracker.service;

import com.ameya.invoicetracker.entity.DailyExchangeRate;
import com.ameya.invoicetracker.repository.DailyExchangeRateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExchangeRateService {

    public static final List<String> CURRENCIES = List.of("EURO", "USD", "GBP");

    private final DailyExchangeRateRepository rateRepository;

    public record RateEntry(String date, String currency, Double rate) {}

    // ── Month view: one entry per day, with whatever rates are already saved ──
    public List<Map<String, Object>> getMonthRates(int year, int month) {
        YearMonth ym = YearMonth.of(year, month);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();

        List<DailyExchangeRate> saved = rateRepository.findByRateDateBetween(start, end);
        Map<LocalDate, Map<String, Double>> byDate = new HashMap<>();
        for (DailyExchangeRate r : saved) {
            byDate.computeIfAbsent(r.getRateDate(), d -> new HashMap<>()).put(r.getCurrency(), r.getRate());
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (int day = 1; day <= ym.lengthOfMonth(); day++) {
            LocalDate date = ym.atDay(day);
            Map<String, Double> rates = byDate.getOrDefault(date, Map.of());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date", date.toString());
            Map<String, Double> rateMap = new LinkedHashMap<>();
            for (String curr : CURRENCIES) rateMap.put(curr, rates.get(curr));
            row.put("rates", rateMap);
            result.add(row);
        }
        return result;
    }

    // ── Save: upsert the calendar entry only. Invoices are never written to
    // directly here — Export Dispatch Data resolves each invoice's own
    // (date, party-derived currency) against this table at generation time,
    // so a rate entered for one currency can never bleed onto a different
    // party's invoice on the same day. ────────────────────────────────────
    public void saveRates(List<RateEntry> entries, String username) {
        for (RateEntry e : entries) {
            if (e.date() == null || e.currency() == null || e.rate() == null) continue;
            LocalDate date = LocalDate.parse(e.date());

            DailyExchangeRate existing = rateRepository.findByRateDateAndCurrency(date, e.currency()).orElse(null);
            if (existing == null) {
                existing = DailyExchangeRate.builder()
                        .rateDate(date).currency(e.currency()).rate(e.rate()).updatedBy(username).build();
            } else {
                existing.setRate(e.rate());
                existing.setUpdatedBy(username);
            }
            rateRepository.save(existing);
        }
    }
}
