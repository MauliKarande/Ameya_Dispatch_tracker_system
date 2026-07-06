package com.ameya.invoicetracker.service;

import com.ameya.invoicetracker.dto.*;
import com.ameya.invoicetracker.entity.*;
import com.ameya.invoicetracker.exception.*;
import com.ameya.invoicetracker.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class SupplyService {

    private final WorkOrderRepository workOrderRepository;
    private final SupplyEntryRepository supplyEntryRepository;

    /** Save supply entries for a work order and update its supply status. */
    public List<SupplyEntryDTO> submitEntries(Long workOrderId, SupplySubmitRequest req, String username) {
        WorkOrder wo = workOrderRepository.findById(workOrderId)
            .orElseThrow(() -> new ResourceNotFoundException("Dispatch not found: " + workOrderId));

        if (req.getParts() == null || req.getParts().isEmpty())
            throw new BadRequestException("At least one part row is required.");

        String type = req.getSupplyType() == null ? "SHORT" : req.getSupplyType().toUpperCase();

        for (SupplySubmitRequest.SupplyPartRow row : req.getParts()) {
            SupplyEntry entry = SupplyEntry.builder()
                .workOrder(wo)
                .partNo(nvl(row.getPartNo()))
                .poNo(nvl(row.getPoNo()))
                .srNo(nvl(row.getSrNo()))
                .invQty(row.getInvQty())
                .poQty(row.getPoQty())
                .actualDespQty(row.getActualDespQty())
                .shortQty(row.getShortQty())
                .exceedQty(row.getExceedQty())
                .resolved(false)
                .createdBy(username)
                .updatedBy(username)
                .build();
            supplyEntryRepository.save(entry);
        }

        // Recompute supply status from all unresolved entries
        updateSupplyStatus(wo);
        workOrderRepository.save(wo);
        log.info("Supply entries ({}) submitted for {} by {}", type, wo.getWoNumber(), username);

        return supplyEntryRepository.findByWorkOrderIdOrderByCreatedAtDesc(workOrderId)
            .stream().map(this::toDTO).collect(Collectors.toList());
    }

    /** Return all entries (including resolved) for a DL. */
    @Transactional(readOnly = true)
    public List<SupplyEntryDTO> getEntries(Long workOrderId) {
        return supplyEntryRepository.findByWorkOrderIdOrderByCreatedAtDesc(workOrderId)
            .stream().map(this::toDTO).collect(Collectors.toList());
    }

    /** Return only unresolved entries for the Store Cart. */
    @Transactional(readOnly = true)
    public List<SupplyEntryDTO> getPendingEntries(Long workOrderId) {
        return supplyEntryRepository.findByWorkOrderIdAndResolvedFalseOrderByCreatedAtDesc(workOrderId)
            .stream().map(this::toDTO).collect(Collectors.toList());
    }

    /** Mark an entry as resolved (remove from cart). */
    public void resolveEntry(Long entryId, String username) {
        SupplyEntry entry = supplyEntryRepository.findById(entryId)
            .orElseThrow(() -> new ResourceNotFoundException("Supply entry not found: " + entryId));
        entry.setResolved(true);
        entry.setUpdatedBy(username);
        supplyEntryRepository.save(entry);

        // Recompute supply status
        WorkOrder wo = entry.getWorkOrder();
        updateSupplyStatus(wo);
        workOrderRepository.save(wo);
        log.info("Supply entry {} resolved by {}", entryId, username);
    }

    /** Permanently delete an entry (Store/GM only). */
    public void deleteEntry(Long entryId, String username) {
        SupplyEntry entry = supplyEntryRepository.findById(entryId)
            .orElseThrow(() -> new ResourceNotFoundException("Supply entry not found: " + entryId));
        WorkOrder wo = entry.getWorkOrder();
        supplyEntryRepository.delete(entry);

        updateSupplyStatus(wo);
        workOrderRepository.save(wo);
        log.info("Supply entry {} deleted by {}", entryId, username);
    }

    /** IDs of all work orders that have at least one unresolved supply entry. */
    @Transactional(readOnly = true)
    public List<Long> getWorkOrderIdsWithPendingEntries() {
        return supplyEntryRepository.findWorkOrderIdsWithPendingEntries();
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    private void updateSupplyStatus(WorkOrder wo) {
        List<SupplyEntry> pending =
            supplyEntryRepository.findByWorkOrderIdAndResolvedFalseOrderByCreatedAtDesc(wo.getId());
        boolean hasShort  = pending.stream().anyMatch(e -> e.getShortQty()  != null && e.getShortQty()  > 0);
        boolean hasExceed = pending.stream().anyMatch(e -> e.getExceedQty() != null && e.getExceedQty() > 0);

        if (hasShort && hasExceed) wo.setSupplyStatus(WorkOrder.SupplyStatus.BOTH);
        else if (hasShort)         wo.setSupplyStatus(WorkOrder.SupplyStatus.SHORT);
        else if (hasExceed)        wo.setSupplyStatus(WorkOrder.SupplyStatus.EXCEED);
        else                       wo.setSupplyStatus(WorkOrder.SupplyStatus.NONE);
    }

    private SupplyEntryDTO toDTO(SupplyEntry e) {
        return SupplyEntryDTO.builder()
            .id(e.getId()).partNo(e.getPartNo()).poNo(e.getPoNo()).srNo(e.getSrNo())
            .invQty(e.getInvQty()).poQty(e.getPoQty()).actualDespQty(e.getActualDespQty())
            .shortQty(e.getShortQty()).exceedQty(e.getExceedQty())
            .resolved(e.isResolved()).createdAt(e.getCreatedAt()).createdBy(e.getCreatedBy())
            .build();
    }

    private static String nvl(String s) { return s == null ? "" : s.strip(); }
}
