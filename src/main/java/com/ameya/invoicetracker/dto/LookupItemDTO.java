package com.ameya.invoicetracker.dto;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LookupItemDTO {
    private Long id;
    private String name;
}
