package com.ameya.invoicetracker.dto;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class StatusUpdateRequest {
    private String action; // "DONE" or "PENDING"
}
