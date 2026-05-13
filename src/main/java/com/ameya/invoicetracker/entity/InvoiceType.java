package com.ameya.invoicetracker.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "invoice_types")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class InvoiceType {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 100)
    private String name;
}
