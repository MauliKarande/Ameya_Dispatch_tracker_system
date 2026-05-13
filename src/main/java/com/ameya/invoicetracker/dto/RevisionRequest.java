package com.ameya.invoicetracker.dto;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class RevisionRequest {
    @NotBlank(message = "Revision reason is required")
    private String revisionReason;
}
