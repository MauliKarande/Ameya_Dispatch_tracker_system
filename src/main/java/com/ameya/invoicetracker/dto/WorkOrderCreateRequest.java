package com.ameya.invoicetracker.dto;
import jakarta.validation.constraints.*;
import lombok.*;
import java.time.LocalDate;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WorkOrderCreateRequest {
    @NotBlank(message = "Customer name is required")
    private String customerName;
    @NotBlank(message = "Shipment mode is required")
    private String shipmentMode;
    private String invoiceType;
    @NotNull(message = "Dispatch date is required")
    private LocalDate woDate;
}
