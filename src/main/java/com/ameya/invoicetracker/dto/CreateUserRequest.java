package com.ameya.invoicetracker.dto;
import com.ameya.invoicetracker.entity.User;
import jakarta.validation.constraints.*;
import lombok.*;
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class CreateUserRequest {
    @NotBlank private String username;
    @NotBlank @Size(min = 6) private String password;
    @NotBlank private String fullName;
    @NotNull private User.Role role;
}
