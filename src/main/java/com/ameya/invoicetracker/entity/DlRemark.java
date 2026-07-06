package com.ameya.invoicetracker.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "dl_remarks")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DlRemark {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long workOrderId;

    @Column(columnDefinition = "TEXT")
    private String remark;

    private LocalDateTime updatedAt;
    @Column(length = 100) private String updatedBy;
}
