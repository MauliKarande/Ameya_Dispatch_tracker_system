package com.ameya.invoicetracker.repository;

import com.ameya.invoicetracker.entity.DlRemarkHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DlRemarkHistoryRepository extends JpaRepository<DlRemarkHistory, Long> {
    List<DlRemarkHistory> findByWorkOrderIdOrderByChangedAtDesc(Long workOrderId);
}
