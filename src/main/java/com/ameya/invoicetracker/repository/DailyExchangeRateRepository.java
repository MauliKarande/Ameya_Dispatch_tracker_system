package com.ameya.invoicetracker.repository;

import com.ameya.invoicetracker.entity.DailyExchangeRate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DailyExchangeRateRepository extends JpaRepository<DailyExchangeRate, Long> {

    List<DailyExchangeRate> findByRateDateBetween(LocalDate start, LocalDate end);

    Optional<DailyExchangeRate> findByRateDateAndCurrency(LocalDate rateDate, String currency);
}
