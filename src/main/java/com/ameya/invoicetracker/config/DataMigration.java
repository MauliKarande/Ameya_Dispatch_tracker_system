package com.ameya.invoicetracker.config;

import com.ameya.invoicetracker.repository.ShipmentModeRepository;
import com.ameya.invoicetracker.repository.WorkOrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Component
@Order(2)
@RequiredArgsConstructor
@Slf4j
public class DataMigration implements CommandLineRunner {

    private final WorkOrderRepository workOrderRepository;
    private final ShipmentModeRepository shipmentModeRepository;

    // Maps every legacy "By X" variant (case-insensitive key) to the canonical value
    private static final Map<String, String> SHIPMENT_REMAP = Map.of(
        "by air",           "AIR",
        "by sea",           "SEA",
        "by road",          "ROAD",
        "by courier",       "COURIER",
        "by hand delivery", "HAND DELIVERY",
        "by multimodal",    "MULTIMODAL"
    );

    @Override
    @Transactional
    public void run(String... args) {
        // 1. Update work orders that use a legacy shipment mode name
        int updated = 0;
        for (var wo : workOrderRepository.findAll()) {
            if (wo.getShipmentMode() == null) continue;
            String canonical = SHIPMENT_REMAP.get(wo.getShipmentMode().trim().toLowerCase());
            if (canonical != null && !canonical.equals(wo.getShipmentMode())) {
                log.info("Migrating shipment mode on {} : '{}' -> '{}'",
                    wo.getWoNumber(), wo.getShipmentMode(), canonical);
                wo.setShipmentMode(canonical);
                workOrderRepository.save(wo);
                updated++;
            }
        }

        // 2. Remove legacy ShipmentMode lookup rows whose name matches a "By X" key
        int removed = 0;
        for (var mode : shipmentModeRepository.findAll()) {
            if (SHIPMENT_REMAP.containsKey(mode.getName().trim().toLowerCase())) {
                log.info("Removing legacy shipment mode entry: '{}'", mode.getName());
                shipmentModeRepository.delete(mode);
                removed++;
            }
        }

        if (updated > 0 || removed > 0)
            log.info("Shipment mode migration done: {} work orders updated, {} lookup rows removed.", updated, removed);
    }
}
