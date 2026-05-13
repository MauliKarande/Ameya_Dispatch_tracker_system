package com.ameya.invoicetracker.dto;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PackagingRequest {
    private String packingType;      // "01_BOX" or "MORE_THAN_ONE_BOX"
    private String packagingDetails;
}
