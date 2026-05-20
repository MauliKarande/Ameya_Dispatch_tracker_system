package com.ameya.invoicetracker.dto;
import lombok.*;
import java.time.LocalDateTime;
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FileDTO {
    private Long id;
    private String originalFileName;
    private String fileType;
    private Integer version;
    private LocalDateTime uploadedAt;
    private String uploadedBy;
    private String remarks;
    private String downloadUrl;
    private Double amountTotal;
}
