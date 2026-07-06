package com.ameya.invoicetracker.controller;

import com.ameya.invoicetracker.dto.ApiResponse;
import com.ameya.invoicetracker.dto.SalesExecDocDoneDTO;
import com.ameya.invoicetracker.dto.WorkOrderSummaryDTO;
import com.ameya.invoicetracker.entity.SalesExecTracking;
import com.ameya.invoicetracker.entity.WorkOrder;
import com.ameya.invoicetracker.exception.ResourceNotFoundException;
import com.ameya.invoicetracker.repository.SalesExecTrackingRepository;
import com.ameya.invoicetracker.repository.WorkOrderRepository;
import com.ameya.invoicetracker.service.WorkOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/sales-exec")
@PreAuthorize("hasRole('SALES_EXECUTIVE')")
@RequiredArgsConstructor
public class SalesExecController {

    private final WorkOrderRepository workOrderRepository;
    private final SalesExecTrackingRepository trackingRepository;
    private final WorkOrderService workOrderService;

    /** DLs that are fully dispatched by STORE but not yet documented by Sales Exec */
    @GetMapping("/rfd")
    public ResponseEntity<ApiResponse<List<WorkOrderSummaryDTO>>> getRfdList() {
        Set<Long> documented = trackingRepository.findAllByOrderByMarkedAtDesc()
            .stream().map(t -> t.getWorkOrder().getId()).collect(Collectors.toSet());

        List<WorkOrderSummaryDTO> result = workOrderRepository.findAllByOrderByCreatedAtDesc()
            .stream()
            .filter(wo -> wo.getStockStatus()    == WorkOrder.StepStatus.DONE
                       && wo.getPackagingStatus() == WorkOrder.StepStatus.DONE
                       && wo.getInvoiceStatus()   == WorkOrder.StepStatus.DONE
                       && (wo.getReadyForDispatchStatus() == WorkOrder.StepStatus.DONE
                           || (wo.getSupplyStatus() != null && wo.getSupplyStatus() != WorkOrder.SupplyStatus.NONE))
                       && !documented.contains(wo.getId()))
            .map(wo -> workOrderService.getSummaryById(wo.getId()))
            .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    /** DLs that Sales Exec has already marked as Documentation Done */
    @GetMapping("/doc-done")
    public ResponseEntity<ApiResponse<List<SalesExecDocDoneDTO>>> getDocDoneList() {
        List<SalesExecDocDoneDTO> result = trackingRepository.findAllByOrderByMarkedAtDesc()
            .stream()
            .map(t -> SalesExecDocDoneDTO.builder()
                .workOrder(workOrderService.getSummaryById(t.getWorkOrder().getId()))
                .markedBy(t.getMarkedBy())
                .markedAt(t.getMarkedAt())
                .build())
            .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    /** Mark a DL as Documentation Done — only creates a tracking record, does not touch the work order */
    @PostMapping("/{woId}/mark-done")
    public ResponseEntity<ApiResponse<Void>> markDocDone(
            @PathVariable Long woId,
            @AuthenticationPrincipal UserDetails ud) {

        if (trackingRepository.existsByWorkOrderId(woId)) {
            return ResponseEntity.ok(ApiResponse.ok("Already documented", null));
        }

        WorkOrder wo = workOrderRepository.findById(woId)
            .orElseThrow(() -> new ResourceNotFoundException("Work order not found: " + woId));

        trackingRepository.save(SalesExecTracking.builder()
            .workOrder(wo)
            .markedBy(ud.getUsername())
            .markedAt(LocalDateTime.now())
            .build());

        return ResponseEntity.ok(ApiResponse.ok("Documentation marked as done", null));
    }
}
