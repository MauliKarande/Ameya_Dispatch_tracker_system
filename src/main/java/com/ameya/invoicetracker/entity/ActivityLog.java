package com.ameya.invoicetracker.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "activity_logs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ActivityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_order_id", nullable = false)
    private WorkOrder workOrder;

    @Column(length = 100)
    private String username;

    @Column(length = 100)
    private String fullName;

    @Column(columnDefinition = "TEXT")
    private String action;

    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    private ActionType actionType;

    @Column(nullable = false, updatable = false)
    private LocalDateTime timestamp;

    @PrePersist
    protected void onCreate() { timestamp = LocalDateTime.now(); }

    public enum ActionType {
        WO_CREATED, WO_UPDATED, WO_REVISED, WO_DELETED,
        STOCK_UPDATED, STOCK_REVERTED,
        PACKAGING_ADDED, PACKAGING_UPDATED, PACKAGING_REVERTED,
        INVOICE_CREATED, INVOICE_UPDATED, INVOICE_REVERTED,
        INVOICE_FILE_UPLOADED, INVOICE_ISSUE_REPORTED,
        READY_FOR_DISPATCH_UPDATED, READY_FOR_DISPATCH_REVERTED,
        COLLECTION_UPDATED, COLLECTION_REVERTED,
        FILES_CLEANED
    }
}
