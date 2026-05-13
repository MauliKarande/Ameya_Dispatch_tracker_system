package com.ameya.invoicetracker.repository;

import com.ameya.invoicetracker.entity.ShipmentMode;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ShipmentModeRepository extends JpaRepository<ShipmentMode, Long> {
    boolean existsByNameIgnoreCase(String name);
    List<ShipmentMode> findAllByOrderByNameAsc();
}
