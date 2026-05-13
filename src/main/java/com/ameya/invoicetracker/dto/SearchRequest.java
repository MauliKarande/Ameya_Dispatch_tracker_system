package com.ameya.invoicetracker.dto;
import lombok.*;
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SearchRequest {
    private String customerName;
    private Integer month;
    private Integer year;
    private String status;
}
