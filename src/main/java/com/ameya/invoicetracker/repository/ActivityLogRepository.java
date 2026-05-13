package com.ameya.invoicetracker.repository;

import com.ameya.invoicetracker.entity.ActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {

    List<ActivityLog> findByWorkOrderIdOrderByTimestampDesc(Long workOrderId);
}
