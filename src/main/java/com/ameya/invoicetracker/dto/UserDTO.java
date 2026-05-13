package com.ameya.invoicetracker.dto;
import lombok.*;
import java.time.LocalDateTime;
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserDTO {
    private Long id;
    private String username;
    private String fullName;
    private String role;
    private boolean active;
    private LocalDateTime createdAt;
}
