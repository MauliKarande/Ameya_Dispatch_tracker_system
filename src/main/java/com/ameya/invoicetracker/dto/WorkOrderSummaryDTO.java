package com.ameya.invoicetracker.dto;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WorkOrderSummaryDTO {
    private Long id;
    private String woNumber;
    private String customerName;
    private String shipmentMode;
    private String invoiceType;
    private LocalDate woDate;
    private String status;
    private Integer version;
    private boolean revised;
    private String stockStatus;
    private String packingDetailsStatus; // PENDING/DONE — for MORE_THAN_ONE_BOX step after invoice
    private String packingType;          // "01_BOX" or "MORE_THAN_ONE_BOX"
    private String packagingStatus;
    private String invoiceStatus;
    private String invoiceNumber;
    private java.time.LocalDate invoiceDate;
    private String readyForDispatchStatus;
    private String collectionStatus;
    private LocalDateTime collectionUpdatedAt;
    private boolean hasNote;
    private boolean hasInvoiceIssue;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;
    private Long latestExcelFileId;
    private String latestExcelFileName;
    private Long latestPdfFileId;
    private String latestPdfFileName;
    private Long latestPackingFileId;
    private String latestPackingFileName;
}
