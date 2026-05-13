package com.ameya.invoicetracker.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "file_storage")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FileStorage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_order_id", nullable = false)
    private WorkOrder workOrder;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private FileType fileType;

    @Column(nullable = false)
    private String originalFileName;

    @Column(nullable = false)
    private String storedFileName;

    @Column(nullable = false)
    private String filePath;

    @Column(nullable = false)
    @Builder.Default
    private Integer version = 1;

    @Column(nullable = false, updatable = false)
    private LocalDateTime uploadedAt;

    @Column(length = 100)
    private String uploadedBy;

    @Column(length = 500)
    private String remarks;

    @Column
    @Builder.Default
    private boolean deleted = false;

    @Column
    private LocalDateTime deletedAt;

    @PrePersist
    protected void onCreate() { uploadedAt = LocalDateTime.now(); }

    public enum FileType { EXCEL, PDF, PACKING }
}
