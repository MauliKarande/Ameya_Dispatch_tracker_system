package com.ameya.invoicetracker.dto;
import lombok.*;
import java.time.LocalDateTime;
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ActivityLogDTO {
    private Long id;
    private String username;
    private String fullName;
    private String action;
    private String actionType;
    private LocalDateTime timestamp;
    private String formattedTimestamp;
}
