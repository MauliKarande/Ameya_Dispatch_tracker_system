package com.ameya.invoicetracker.dto;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import java.time.LocalDate;
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class InvoiceUpdateRequest {
    @NotBlank(message = "Invoice number is required")
    private String invoiceNumber;
    private LocalDate invoiceDate;
}
