package com.ameya.invoicetracker.dto;
import jakarta.validation.constraints.*;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChangePasswordRequest {
    @NotBlank private String oldPassword;
    @NotBlank @Size(min = 3) private String newPassword;
    @NotBlank private String confirmPassword;
}
