package com.ameya.invoicetracker.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "daily_exchange_rates",
       uniqueConstraints = @UniqueConstraint(columnNames = {"rate_date", "currency"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DailyExchangeRate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rate_date", nullable = false)
    private LocalDate rateDate;

    @Column(nullable = false, length = 20)
    private String currency;

    @Column(nullable = false)
    private Double rate;

    @Column private LocalDateTime updatedAt;
    @Column(length = 100) private String updatedBy;

    @PrePersist @PreUpdate
    protected void onSave() { updatedAt = LocalDateTime.now(); }
}
