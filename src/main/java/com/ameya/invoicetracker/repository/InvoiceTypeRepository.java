package com.ameya.invoicetracker.repository;

import com.ameya.invoicetracker.entity.InvoiceType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface InvoiceTypeRepository extends JpaRepository<InvoiceType, Long> {
    boolean existsByNameIgnoreCase(String name);
    List<InvoiceType> findAllByOrderByNameAsc();
}
