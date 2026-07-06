package com.ameya.invoicetracker.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "supply_entries")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SupplyEntry {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_order_id", nullable = false)
    private WorkOrder workOrder;

    @Column(length = 200) private String partNo;
    @Column(length = 150) private String poNo;
    @Column(length = 100) private String srNo;

    @Column private Integer invQty;     // from Excel DESP.QTY
    @Column private Integer poQty;      // manually entered by Store
    @Column private Integer actualDespQty; // actual qty being dispatched
    @Column private Integer shortQty;   // qty to be sent later
    @Column private Integer exceedQty;  // qty sent in excess

    @Column(nullable = false)
    @Builder.Default
    private boolean resolved = false;   // true when Store/GM marks it done

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    @Column(length = 100) private String createdBy;
    @Column private LocalDateTime updatedAt;
    @Column(length = 100) private String updatedBy;

    @PrePersist protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt  = LocalDateTime.now();
    }
    @PreUpdate protected void onUpdate() { updatedAt = LocalDateTime.now(); }
}
