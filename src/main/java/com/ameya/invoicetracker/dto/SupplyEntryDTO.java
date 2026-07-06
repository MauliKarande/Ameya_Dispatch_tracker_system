package com.ameya.invoicetracker.dto;

import lombok.*;
import java.time.LocalDateTime;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SupplyEntryDTO {
    private Long id;
    private String partNo;
    private String poNo;
    private String srNo;
    private Integer invQty;
    private Integer poQty;
    private Integer actualDespQty;
    private Integer shortQty;
    private Integer exceedQty;
    private boolean resolved;
    private LocalDateTime createdAt;
    private String createdBy;
}
