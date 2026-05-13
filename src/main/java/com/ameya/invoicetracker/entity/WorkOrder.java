package com.ameya.invoicetracker.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "work_orders")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WorkOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String woNumber;   // kept as woNumber internally, displayed as Dispatch No.

    @Column(nullable = false, length = 200)
    private String customerName;

    @Column(nullable = false, length = 100)
    private String shipmentMode;

    @Column(length = 100)
    private String invoiceType;  // Commercial, Sample, Domestic, Charges, Certifications

    @Column(nullable = false)
    private LocalDate woDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private WoStatus status;

    @Column(nullable = false)
    @Builder.Default
    private Integer version = 1;

    @Column(nullable = false)
    @Builder.Default
    private boolean revised = false;

    @Column(columnDefinition = "TEXT")
    private String revisionReason;

    @Column
    private LocalDateTime revisionReasonUpdatedAt;

    // Stock
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private StepStatus stockStatus = StepStatus.PENDING;

    @Column private LocalDateTime stockUpdatedAt;
    @Column(length = 100) private String stockUpdatedBy;

    // Packing Details (renamed from Packaging)
    @Column(length = 30)
    private String packingType;   // "01_BOX" or "MORE_THAN_ONE_BOX"

    @Column(columnDefinition = "TEXT")
    private String packagingDetails;  // text details for box details step

    // Packing Details step (only active when MORE_THAN_ONE_BOX — file upload after invoice)
    @Enumerated(EnumType.STRING) @Column(length = 20)
    @Builder.Default
    private StepStatus packingDetailsStatus = StepStatus.PENDING;
    @Column private LocalDateTime packingDetailsUpdatedAt;
    @Column(length = 100) private String packingDetailsUpdatedBy;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private StepStatus packagingStatus = StepStatus.PENDING;

    @Column private LocalDateTime packagingUpdatedAt;
    @Column(length = 100) private String packagingUpdatedBy;

    // Invoice
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private StepStatus invoiceStatus = StepStatus.PENDING;

    @Column(length = 100) private String invoiceNumber;
    @Column private java.time.LocalDate invoiceDate;
    @Column private LocalDateTime invoiceUpdatedAt;
    @Column(length = 100) private String invoiceUpdatedBy;

    @Column(columnDefinition = "TEXT")
    private String invoiceIssue;

    @Column private LocalDateTime invoiceIssueUpdatedAt;
    @Column(length = 100) private String invoiceIssueUpdatedBy;

    // Ready For Dispatch (new)
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private StepStatus readyForDispatchStatus = StepStatus.PENDING;

    @Column private LocalDateTime readyForDispatchUpdatedAt;
    @Column(length = 100) private String readyForDispatchUpdatedBy;

    // Collection (new)
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private StepStatus collectionStatus = StepStatus.PENDING;

    @Column private LocalDateTime collectionUpdatedAt;
    @Column(length = 100) private String collectionUpdatedBy;

    // Note from GM → Invoice Creator
    @Column(columnDefinition = "TEXT")
    private String noteForInvoice;

    @Column private LocalDateTime noteUpdatedAt;
    @Column(length = 100) private String noteUpdatedBy;

    // Timestamps
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column private LocalDateTime updatedAt;
    @Column(length = 100) private String createdBy;

    // Relations
    @OneToMany(mappedBy = "workOrder", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<FileStorage> files = new ArrayList<>();

    @OneToMany(mappedBy = "workOrder", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<ActivityLog> activityLogs = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt  = LocalDateTime.now();
        if (status == null) status = WoStatus.IN_PROGRESS;
        if (invoiceType == null || invoiceType.isBlank()) invoiceType = "Commercial";
        if (stockStatus == null) stockStatus = StepStatus.PENDING;
        if (packagingStatus == null) packagingStatus = StepStatus.PENDING;
        if (invoiceStatus == null) invoiceStatus = StepStatus.PENDING;
        if (packingDetailsStatus == null) packingDetailsStatus = StepStatus.PENDING;
        if (readyForDispatchStatus == null) readyForDispatchStatus = StepStatus.PENDING;
        if (collectionStatus == null) collectionStatus = StepStatus.PENDING;
    }

    @PreUpdate
    protected void onUpdate() { updatedAt = LocalDateTime.now(); }

    public enum WoStatus    { IN_PROGRESS, COMPLETED, REVISED }
    public enum StepStatus  { PENDING, DONE }
}
