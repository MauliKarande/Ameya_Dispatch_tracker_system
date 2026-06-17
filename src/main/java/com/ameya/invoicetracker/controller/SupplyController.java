package com.ameya.invoicetracker.controller;

import com.ameya.invoicetracker.dto.*;
import com.ameya.invoicetracker.entity.WorkOrder;
import com.ameya.invoicetracker.repository.WorkOrderRepository;
import com.ameya.invoicetracker.service.SupplyService;
import com.ameya.invoicetracker.service.WorkOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/supply")
@RequiredArgsConstructor
public class SupplyController {

    private final SupplyService supplyService;
    private final WorkOrderRepository workOrderRepository;
    private final WorkOrderService workOrderService;

    /** Submit supply entries for a DL (also marks readyForDispatch = DONE). */
    @PostMapping("/{workOrderId}")
    @PreAuthorize("hasRole('STORE')")
    public ResponseEntity<ApiResponse<List<SupplyEntryDTO>>> submit(
            @PathVariable Long workOrderId,
            @RequestBody SupplySubmitRequest req,
            @AuthenticationPrincipal UserDetails ud) {
        // First mark Ready For Dispatch as DONE (same validation as the regular endpoint)
        workOrderService.updateReadyForDispatch(workOrderId, "DONE", ud.getUsername());
        // Then save supply entries
        List<SupplyEntryDTO> entries = supplyService.submitEntries(workOrderId, req, ud.getUsername());
        return ResponseEntity.ok(ApiResponse.ok("Supply entries saved", entries));
    }

    /** Get all supply entries for a DL. */
    @GetMapping("/{workOrderId}")
    public ResponseEntity<ApiResponse<List<SupplyEntryDTO>>> getEntries(@PathVariable Long workOrderId) {
        return ResponseEntity.ok(ApiResponse.ok(supplyService.getEntries(workOrderId)));
    }

    /** Get pending (unresolved) supply entries for a DL. */
    @GetMapping("/{workOrderId}/pending")
    public ResponseEntity<ApiResponse<List<SupplyEntryDTO>>> getPending(@PathVariable Long workOrderId) {
        return ResponseEntity.ok(ApiResponse.ok(supplyService.getPendingEntries(workOrderId)));
    }

    /** Mark an entry as resolved (remove from cart view). */
    @PatchMapping("/entry/{entryId}/resolve")
    @PreAuthorize("hasAnyRole('STORE','GENERAL_MANAGER')")
    public ResponseEntity<ApiResponse<String>> resolve(
            @PathVariable Long entryId,
            @AuthenticationPrincipal UserDetails ud) {
        supplyService.resolveEntry(entryId, ud.getUsername());
        return ResponseEntity.ok(ApiResponse.ok("Entry resolved"));
    }

    /** Permanently delete an entry. */
    @DeleteMapping("/entry/{entryId}")
    @PreAuthorize("hasAnyRole('STORE','GENERAL_MANAGER')")
    public ResponseEntity<ApiResponse<String>> delete(
            @PathVariable Long entryId,
            @AuthenticationPrincipal UserDetails ud) {
        supplyService.deleteEntry(entryId, ud.getUsername());
        return ResponseEntity.ok(ApiResponse.ok("Entry deleted"));
    }

    /**
     * Store Cart endpoint — returns all work orders that have at least one
     * unresolved supply entry, with their summary + pending entry count.
     */
    @GetMapping("/cart")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> cart() {
        List<Long> ids = supplyService.getWorkOrderIdsWithPendingEntries();
        if (ids.isEmpty()) return ResponseEntity.ok(ApiResponse.ok(List.of()));

        List<WorkOrder> wos = workOrderRepository.findAllById(ids);
        List<Map<String, Object>> result = wos.stream().map(wo -> {
            List<SupplyEntryDTO> pending = supplyService.getPendingEntries(wo.getId());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", wo.getId());
            m.put("woNumber", wo.getWoNumber());
            m.put("customerName", wo.getCustomerName());
            m.put("shipmentMode", wo.getShipmentMode());
            m.put("supplyStatus", wo.getSupplyStatus() != null ? wo.getSupplyStatus().name() : "NONE");
            m.put("pendingCount", pending.size());
            m.put("entries", pending);
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.ok(result));
    }
}
