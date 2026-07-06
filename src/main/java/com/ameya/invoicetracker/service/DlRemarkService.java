package com.ameya.invoicetracker.service;

import com.ameya.invoicetracker.dto.DlRemarkDTO;
import com.ameya.invoicetracker.entity.DlRemark;
import com.ameya.invoicetracker.entity.DlRemarkHistory;
import com.ameya.invoicetracker.repository.DlRemarkHistoryRepository;
import com.ameya.invoicetracker.repository.DlRemarkRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class DlRemarkService {

    private final DlRemarkRepository remarkRepository;
    private final DlRemarkHistoryRepository historyRepository;

    /** Save or update the remark for a work order. Old value is logged to history. */
    public DlRemarkDTO saveRemark(Long workOrderId, String remark, String username) {
        DlRemark existing = remarkRepository.findByWorkOrderId(workOrderId).orElse(null);

        if (existing != null && existing.getRemark() != null && !existing.getRemark().isBlank()) {
            // archive the old remark before overwriting
            historyRepository.save(DlRemarkHistory.builder()
                .workOrderId(workOrderId)
                .remark(existing.getRemark())
                .changedBy(existing.getUpdatedBy())
                .build());
        }

        if (existing == null) {
            existing = DlRemark.builder()
                .workOrderId(workOrderId)
                .build();
        }
        existing.setRemark(remark);
        existing.setUpdatedAt(LocalDateTime.now());
        existing.setUpdatedBy(username);
        remarkRepository.save(existing);
        log.info("Remark updated for workOrder={} by {}", workOrderId, username);
        return getRemarkDTO(workOrderId);
    }

    /** Fetch current remark + history for a work order. */
    @Transactional(readOnly = true)
    public DlRemarkDTO getRemarkDTO(Long workOrderId) {
        DlRemark r = remarkRepository.findByWorkOrderId(workOrderId).orElse(null);
        List<DlRemarkHistory> hist = historyRepository.findByWorkOrderIdOrderByChangedAtDesc(workOrderId);
        return DlRemarkDTO.builder()
            .remark(r != null ? r.getRemark() : null)
            .updatedAt(r != null ? r.getUpdatedAt() : null)
            .updatedBy(r != null ? r.getUpdatedBy() : null)
            .history(hist.stream().map(h -> DlRemarkDTO.HistoryEntry.builder()
                .remark(h.getRemark()).changedAt(h.getChangedAt()).changedBy(h.getChangedBy())
                .build()).collect(Collectors.toList()))
            .build();
    }

    /** Lightweight check — returns current remark text or null. */
    @Transactional(readOnly = true)
    public String getCurrentRemark(Long workOrderId) {
        return remarkRepository.findByWorkOrderId(workOrderId)
            .map(DlRemark::getRemark).orElse(null);
    }
}
