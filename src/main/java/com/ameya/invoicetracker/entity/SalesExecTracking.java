package com.ameya.invoicetracker.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "sales_exec_tracking",
       uniqueConstraints = @UniqueConstraint(columnNames = "work_order_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SalesExecTracking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_order_id", nullable = false)
    private WorkOrder workOrder;

    @Column(name = "marked_by", length = 100)
    private String markedBy;

    @Column(name = "marked_at")
    private LocalDateTime markedAt;
}
