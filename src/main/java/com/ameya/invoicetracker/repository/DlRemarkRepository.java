package com.ameya.invoicetracker.repository;

import com.ameya.invoicetracker.entity.DlRemark;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface DlRemarkRepository extends JpaRepository<DlRemark, Long> {
    Optional<DlRemark> findByWorkOrderId(Long workOrderId);
}
