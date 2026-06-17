package com.ameya.invoicetracker.dto;

import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DlRemarkDTO {
    private String remark;
    private LocalDateTime updatedAt;
    private String updatedBy;
    private List<HistoryEntry> history;

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class HistoryEntry {
        private String remark;
        private LocalDateTime changedAt;
        private String changedBy;
    }
}
