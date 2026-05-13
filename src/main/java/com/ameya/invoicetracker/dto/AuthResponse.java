package com.ameya.invoicetracker.dto;
import lombok.*;
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AuthResponse {
    private String token;
    private String username;
    private String fullName;
    private String role;
    private String message;
}
