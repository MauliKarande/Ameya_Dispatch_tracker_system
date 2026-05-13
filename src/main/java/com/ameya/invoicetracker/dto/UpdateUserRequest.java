package com.ameya.invoicetracker.dto;

import com.ameya.invoicetracker.entity.User;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class UpdateUserRequest {
    private String username;    // new username (optional)
    private String fullName;    // new display name (optional)
    private String newPassword; // new password (optional, blank = keep existing)
    private User.Role role;     // new role (optional)
    private Boolean active;     // enable/disable (optional)
}
