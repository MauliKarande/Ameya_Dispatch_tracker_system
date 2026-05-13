package com.ameya.invoicetracker.dto;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WorkOrderDetailDTO {
    private Long id;
    private String woNumber;
    private String customerName;
    private String shipmentMode;
    private String invoiceType;
    private LocalDate woDate;
    private String status;
    private Integer version;
    private boolean revised;
    private String revisionReason;
    private LocalDateTime revisionReasonUpdatedAt;

    // Stock
    private String stockStatus;
    private LocalDateTime stockUpdatedAt;
    private String stockUpdatedBy;

    // Box Details step
    private String packingType;
    private String packagingDetails;
    // Packing Details step (MORE_THAN_ONE_BOX only, after invoice)
    private String packingDetailsStatus;
    private LocalDateTime packingDetailsUpdatedAt;
    private String packingDetailsUpdatedBy;
    private String packagingStatus;
    private LocalDateTime packagingUpdatedAt;
    private String packagingUpdatedBy;

    // Invoice
    private String invoiceStatus;
    private String invoiceNumber;
    private java.time.LocalDate invoiceDate;
    private LocalDateTime invoiceUpdatedAt;
    private String invoiceUpdatedBy;
    private String invoiceIssue;
    private LocalDateTime invoiceIssueUpdatedAt;
    private String invoiceIssueUpdatedBy;

    // Ready For Dispatch
    private String readyForDispatchStatus;
    private LocalDateTime readyForDispatchUpdatedAt;
    private String readyForDispatchUpdatedBy;

    // Collection
    private String collectionStatus;
    private LocalDateTime collectionUpdatedAt;
    private String collectionUpdatedBy;

    // Note GM → Invoice Creator
    private String noteForInvoice;
    private LocalDateTime noteUpdatedAt;
    private String noteUpdatedBy;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;

    private List<FileDTO> excelFiles;
    private List<FileDTO> pdfFiles;
    private List<FileDTO> packingFiles;
    private List<ActivityLogDTO> activityLogs;
}
