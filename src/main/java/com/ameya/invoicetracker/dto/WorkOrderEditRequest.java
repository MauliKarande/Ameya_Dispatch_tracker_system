package com.ameya.invoicetracker.dto;
import lombok.*;
import java.time.LocalDate;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WorkOrderEditRequest {
    private String customerName;
    private String shipmentMode;
    private String invoiceType;
    private LocalDate woDate;
}
