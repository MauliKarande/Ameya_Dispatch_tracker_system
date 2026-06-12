package com.ameya.invoicetracker.dto;

import lombok.*;
import java.time.LocalDateTime;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SalesExecDocDoneDTO {
    private WorkOrderSummaryDTO workOrder;
    private String markedBy;
    private LocalDateTime markedAt;
}
