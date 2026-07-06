package com.ameya.invoicetracker.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "dl_remark_history")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DlRemarkHistory {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long workOrderId;

    @Column(columnDefinition = "TEXT")
    private String remark;

    @Column(nullable = false, updatable = false)
    private LocalDateTime changedAt;
    @Column(length = 100) private String changedBy;

    @PrePersist protected void onCreate() { changedAt = LocalDateTime.now(); }
}
