package com.ameya.invoicetracker.repository;

import com.ameya.invoicetracker.entity.SalesExecTracking;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SalesExecTrackingRepository extends JpaRepository<SalesExecTracking, Long> {
    boolean existsByWorkOrderId(Long workOrderId);
    List<SalesExecTracking> findAllByOrderByMarkedAtDesc();
}
