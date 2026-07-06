package com.ameya.invoicetracker.repository;

import com.ameya.invoicetracker.entity.SupplyEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface SupplyEntryRepository extends JpaRepository<SupplyEntry, Long> {

    List<SupplyEntry> findByWorkOrderIdOrderByCreatedAtDesc(Long workOrderId);

    List<SupplyEntry> findByWorkOrderIdAndResolvedFalseOrderByCreatedAtDesc(Long workOrderId);

    boolean existsByWorkOrderIdAndResolvedFalse(Long workOrderId);

    // Fetch all work order ids that have at least one unresolved entry
    @Query("SELECT DISTINCT se.workOrder.id FROM SupplyEntry se WHERE se.resolved = false")
    List<Long> findWorkOrderIdsWithPendingEntries();
}
