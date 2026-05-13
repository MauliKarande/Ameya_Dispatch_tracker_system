package com.ameya.invoicetracker.service.impl;

import com.ameya.invoicetracker.dto.*;
import com.ameya.invoicetracker.entity.*;
import com.ameya.invoicetracker.exception.*;
import com.ameya.invoicetracker.repository.*;
import com.ameya.invoicetracker.controller.NotificationController;
import com.ameya.invoicetracker.service.WorkOrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service @RequiredArgsConstructor @Slf4j @Transactional
public class WorkOrderServiceImpl implements WorkOrderService {

    private final WorkOrderRepository workOrderRepository;
    private final FileStorageRepository fileStorageRepository;
    private final ActivityLogRepository activityLogRepository;
    private final UserRepository userRepository;

    @Value("${app.upload.excel-dir}") private String excelUploadDir;
    @Value("${app.upload.pdf-dir}")   private String pdfUploadDir;
    @Value("${app.upload.packing-dir:./uploads/packing}") private String packingUploadDir;

    // ── CREATE ──────────────────────────────────────────────
    @Override
    public WorkOrderDetailDTO createWorkOrder(WorkOrderCreateRequest req, MultipartFile excelFile, String username) {
        String woNumber = generateWoNumber();
        User user = getUser(username);
        WorkOrder wo = WorkOrder.builder()
            .woNumber(woNumber).customerName(req.getCustomerName())
            .shipmentMode(req.getShipmentMode())
            .invoiceType(req.getInvoiceType() != null && !req.getInvoiceType().isBlank() ? req.getInvoiceType() : "Commercial")
            .woDate(req.getWoDate())
            .status(WorkOrder.WoStatus.IN_PROGRESS).version(1).revised(false)
            .stockStatus(WorkOrder.StepStatus.PENDING)
            .packagingStatus(WorkOrder.StepStatus.PENDING)
            .invoiceStatus(WorkOrder.StepStatus.PENDING)
            .readyForDispatchStatus(WorkOrder.StepStatus.PENDING)
            .collectionStatus(WorkOrder.StepStatus.PENDING)
            .createdBy(user.getFullName()).build();
        workOrderRepository.save(wo);
        if (excelFile != null && !excelFile.isEmpty())
            saveFile(wo, excelFile, FileStorage.FileType.EXCEL, 1, username, user.getFullName());
        logActivity(wo, username, user.getFullName(),
            "Dispatch " + woNumber + " created for customer: " + req.getCustomerName(),
            ActivityLog.ActionType.WO_CREATED);
        WorkOrderDetailDTO dto = toDetailDTO(wo);
        NotificationController.broadcastWithData("DISPATCH_CREATED", user.getFullName() + " created new dispatch " + woNumber + " for " + req.getCustomerName(), dto);
        return dto;
    }

    @Override @Transactional(readOnly = true)
    public WorkOrderDetailDTO getWorkOrderById(Long id) { return toDetailDTO(findWoOrThrow(id)); }

    @Override @Transactional(readOnly = true)
    public WorkOrderDetailDTO getWorkOrderByWoNumber(String woNumber) {
        return toDetailDTO(workOrderRepository.findByWoNumber(woNumber)
            .orElseThrow(() -> new ResourceNotFoundException("Dispatch not found: " + woNumber)));
    }

    @Override @Transactional(readOnly = true)
    public List<WorkOrderSummaryDTO> getAllWorkOrders() {
        return workOrderRepository.findAllByOrderByCreatedAtDesc()
            .stream().map(this::toSummaryDTO).collect(Collectors.toList());
    }

    @Override @Transactional(readOnly = true)
    public List<WorkOrderSummaryDTO> searchWorkOrders(SearchRequest req) {
        WorkOrder.WoStatus status = null;
        if (req.getStatus() != null && !req.getStatus().isBlank()) {
            try { status = WorkOrder.WoStatus.valueOf(req.getStatus()); } catch (Exception ignored) {}
        }
        return workOrderRepository.searchWorkOrders(req.getCustomerName(), req.getMonth(), req.getYear(), status)
            .stream().map(this::toSummaryDTO).collect(Collectors.toList());
    }

    // ── REVISION ─────────────────────────────────────────────
    @Override
    public WorkOrderDetailDTO uploadNewExcel(Long id, MultipartFile excelFile, String revisionReason, String username) {
        WorkOrder wo = findWoOrThrow(id);
        User user = getUser(username);
        if (revisionReason == null || revisionReason.isBlank())
            throw new BadRequestException("Revision reason is required.");
        int newVersion = wo.getVersion() + 1;
        wo.setVersion(newVersion); wo.setRevised(true);
        wo.setStatus(WorkOrder.WoStatus.REVISED);
        wo.setRevisionReason(revisionReason);
        wo.setRevisionReasonUpdatedAt(LocalDateTime.now());
        wo.setStockStatus(WorkOrder.StepStatus.PENDING);
        wo.setPackagingStatus(WorkOrder.StepStatus.PENDING);
        wo.setInvoiceStatus(WorkOrder.StepStatus.PENDING);
        wo.setReadyForDispatchStatus(WorkOrder.StepStatus.PENDING);
        wo.setCollectionStatus(WorkOrder.StepStatus.PENDING);
        wo.setPackagingDetails(null); wo.setPackingType(null);
        wo.setInvoiceIssue(null);
        saveFile(wo, excelFile, FileStorage.FileType.EXCEL, newVersion, username, user.getFullName());
        workOrderRepository.save(wo);
        logActivity(wo, username, user.getFullName(),
            "Revised to v" + newVersion + ". Reason: " + revisionReason, ActivityLog.ActionType.WO_REVISED);
        WorkOrderDetailDTO revDto = toDetailDTO(wo);
        NotificationController.broadcastWithData("DISPATCH_REVISED", user.getFullName() + " revised " + wo.getWoNumber() + " (" + wo.getCustomerName() + ") to version " + newVersion, revDto);
        return revDto;
    }

    // ── STOCK ──────────────────────────────────────────────
    @Override
    public WorkOrderDetailDTO updateStockStatus(Long id, String action, String username) {
        WorkOrder wo = findWoOrThrow(id);
        User user = getUser(username);
        boolean toDone = "DONE".equalsIgnoreCase(action);
        if (!toDone) {
            // Revert: only if packaging is still PENDING
            if (wo.getPackagingStatus() == WorkOrder.StepStatus.DONE)
                throw new BadRequestException("Cannot revert Stock — Packing Details is already Done. Revert Packing first.");
        }
        wo.setStockStatus(toDone ? WorkOrder.StepStatus.DONE : WorkOrder.StepStatus.PENDING);
        wo.setStockUpdatedAt(LocalDateTime.now()); wo.setStockUpdatedBy(user.getFullName());
        workOrderRepository.save(wo); updateOverallStatus(wo);
        logActivity(wo, username, user.getFullName(),
            "Stock status " + (toDone ? "marked DONE" : "reverted to PENDING"),
            toDone ? ActivityLog.ActionType.STOCK_UPDATED : ActivityLog.ActionType.STOCK_REVERTED);
        WorkOrderDetailDTO stockDto = toDetailDTO(wo);
        if (toDone) {
            NotificationController.broadcastWithData("STOCK_DONE", user.getFullName() + " marked Stock as Done for " + wo.getWoNumber() + " (" + wo.getCustomerName() + ")", stockDto);
        } else {
            NotificationController.broadcastWithData("STOCK_REVERT", user.getFullName() + " reverted Stock status for " + wo.getWoNumber() + " (" + wo.getCustomerName() + ")", stockDto);
        }
        return stockDto;
    }

    // ── BOX DETAILS (text only, both box types) ───────────────
    @Override
    public WorkOrderDetailDTO savePackagingDetails(Long id, PackagingRequest req, String username) {
        WorkOrder wo = findWoOrThrow(id);
        User user = getUser(username);
        if (req.getPackagingDetails() == null || req.getPackagingDetails().isBlank())
            throw new BadRequestException("Box details text is required.");
        boolean isUpdate = wo.getPackagingStatus() == WorkOrder.StepStatus.DONE;
        wo.setPackingType(req.getPackingType());
        wo.setPackagingDetails(req.getPackagingDetails());
        wo.setPackagingStatus(WorkOrder.StepStatus.DONE);
        wo.setPackagingUpdatedAt(LocalDateTime.now()); wo.setPackagingUpdatedBy(user.getFullName());
        workOrderRepository.save(wo); updateOverallStatus(wo);
        logActivity(wo, username, user.getFullName(),
            isUpdate ? "Box Details updated" : "Box Details added",
            isUpdate ? ActivityLog.ActionType.PACKAGING_UPDATED : ActivityLog.ActionType.PACKAGING_ADDED);
        WorkOrderDetailDTO packDto = toDetailDTO(wo);
        NotificationController.broadcastWithData("PACKAGING_DONE", user.getFullName() + " added Box details for " + wo.getWoNumber() + " (" + wo.getCustomerName() + ")", packDto);
        return packDto;
    }

    @Override
    public WorkOrderDetailDTO revertPackagingStatus(Long id, String username) {
        WorkOrder wo = findWoOrThrow(id);
        User user = getUser(username);
        if (wo.getInvoiceStatus() == WorkOrder.StepStatus.DONE)
            throw new BadRequestException("Cannot revert Packing Details — Invoice is already Done. Revert Invoice first.");
        wo.setPackagingStatus(WorkOrder.StepStatus.PENDING);
        wo.setPackagingUpdatedAt(LocalDateTime.now()); wo.setPackagingUpdatedBy(user.getFullName());
        workOrderRepository.save(wo); updateOverallStatus(wo);
        logActivity(wo, username, user.getFullName(), "Box Details reverted to PENDING", ActivityLog.ActionType.PACKAGING_REVERTED);
        WorkOrderDetailDTO revertPackDto = toDetailDTO(wo);
        NotificationController.broadcastWithData("PACKAGING_REVERT", user.getFullName() + " reverted Packing details for " + wo.getWoNumber() + " (" + wo.getCustomerName() + ")", revertPackDto);
        return revertPackDto;
    }

    // ── PACKING DETAILS (MORE_THAN_ONE_BOX only — file upload after invoice) ──
    @Override
    public WorkOrderDetailDTO savePackingDetails(Long id, MultipartFile packingFile, String username) {
        WorkOrder wo = findWoOrThrow(id);
        User user = getUser(username);
        if (!"MORE_THAN_ONE_BOX".equals(wo.getPackingType()))
            throw new BadRequestException("Packing Details upload is only for More Than One Box dispatches.");
        if (wo.getInvoiceStatus() != WorkOrder.StepStatus.DONE)
            throw new BadRequestException("Invoice must be Done before uploading Packing Details.");
        if (packingFile == null || packingFile.isEmpty())
            throw new BadRequestException("Please select a file to upload (PDF or Word).");
        int cnt = fileStorageRepository.countByWorkOrderIdAndFileType(wo.getId(), FileStorage.FileType.PACKING);
        saveFile(wo, packingFile, FileStorage.FileType.PACKING, cnt + 1, username, user.getFullName());
        boolean isUpdate = wo.getPackingDetailsStatus() == WorkOrder.StepStatus.DONE;
        wo.setPackingDetailsStatus(WorkOrder.StepStatus.DONE);
        wo.setPackingDetailsUpdatedAt(LocalDateTime.now()); wo.setPackingDetailsUpdatedBy(user.getFullName());
        workOrderRepository.save(wo); updateOverallStatus(wo);
        logActivity(wo, username, user.getFullName(),
            isUpdate ? "Packing Details file updated" : "Packing Details file uploaded",
            isUpdate ? ActivityLog.ActionType.PACKAGING_UPDATED : ActivityLog.ActionType.PACKAGING_ADDED);
        WorkOrderDetailDTO dto = toDetailDTO(wo);
        NotificationController.broadcastWithData("PACKAGING_DONE", user.getFullName() + " uploaded Packing Details for " + wo.getWoNumber() + " (" + wo.getCustomerName() + ")", dto);
        return dto;
    }

    @Override
    public WorkOrderDetailDTO revertPackingDetailsStatus(Long id, String username) {
        WorkOrder wo = findWoOrThrow(id);
        User user = getUser(username);
        if (wo.getReadyForDispatchStatus() == WorkOrder.StepStatus.DONE)
            throw new BadRequestException("Cannot revert Packing Details — Ready For Dispatch is already Done. Revert Ready For Dispatch first.");
        wo.setPackingDetailsStatus(WorkOrder.StepStatus.PENDING);
        wo.setPackingDetailsUpdatedAt(LocalDateTime.now()); wo.setPackingDetailsUpdatedBy(user.getFullName());
        workOrderRepository.save(wo); updateOverallStatus(wo);
        logActivity(wo, username, user.getFullName(), "Packing Details reverted to PENDING", ActivityLog.ActionType.PACKAGING_REVERTED);
        WorkOrderDetailDTO dto = toDetailDTO(wo);
        NotificationController.broadcastWithData("PACKAGING_REVERT", user.getFullName() + " reverted Packing Details for " + wo.getWoNumber() + " (" + wo.getCustomerName() + ")", dto);
        return dto;
    }

    // ── INVOICE ──────────────────────────────────────────────
    @Override
    public WorkOrderDetailDTO updateInvoice(Long id, InvoiceUpdateRequest req, MultipartFile pdfFile, String username) {
        WorkOrder wo = findWoOrThrow(id);
        User user = getUser(username);
        boolean isUpdate = wo.getInvoiceNumber() != null;
        wo.setInvoiceNumber(req.getInvoiceNumber());
        wo.setInvoiceDate(req.getInvoiceDate() != null ? req.getInvoiceDate() : java.time.LocalDate.now());
        wo.setInvoiceStatus(WorkOrder.StepStatus.DONE);
        wo.setInvoiceUpdatedAt(LocalDateTime.now()); wo.setInvoiceUpdatedBy(user.getFullName());
        wo.setInvoiceIssue(null);
        if (pdfFile != null && !pdfFile.isEmpty()) {
            int cnt = fileStorageRepository.countByWorkOrderIdAndFileType(wo.getId(), FileStorage.FileType.PDF);
            saveFile(wo, pdfFile, FileStorage.FileType.PDF, cnt + 1, username, user.getFullName());
        }
        workOrderRepository.save(wo); updateOverallStatus(wo);
        logActivity(wo, username, user.getFullName(),
            (isUpdate ? "Invoice updated. " : "Invoice marked DONE. ") + "Invoice No: " + req.getInvoiceNumber(),
            isUpdate ? ActivityLog.ActionType.INVOICE_UPDATED : ActivityLog.ActionType.INVOICE_CREATED);
        WorkOrderDetailDTO invDto = toDetailDTO(wo);
        NotificationController.broadcastWithData("INVOICE_DONE", user.getFullName() + " uploaded Invoice for " + wo.getWoNumber() + " (" + wo.getCustomerName() + ")", invDto);
        return invDto;
    }

    @Override
    public WorkOrderDetailDTO revertInvoiceStatus(Long id, String username) {
        WorkOrder wo = findWoOrThrow(id);
        User user = getUser(username);
        if (wo.getPackingDetailsStatus() == WorkOrder.StepStatus.DONE)
            throw new BadRequestException("Cannot revert Invoice — Packing Details is already Done. Revert Packing Details first.");
        if (wo.getReadyForDispatchStatus() == WorkOrder.StepStatus.DONE)
            throw new BadRequestException("Cannot revert Invoice — Ready For Dispatch is already Done. Revert Ready For Dispatch first.");
        wo.setInvoiceStatus(WorkOrder.StepStatus.PENDING);
        wo.setInvoiceUpdatedAt(LocalDateTime.now()); wo.setInvoiceUpdatedBy(user.getFullName());
        workOrderRepository.save(wo); updateOverallStatus(wo);
        logActivity(wo, username, user.getFullName(), "Invoice reverted to PENDING", ActivityLog.ActionType.INVOICE_REVERTED);
        WorkOrderDetailDTO revertInvDto = toDetailDTO(wo);
        NotificationController.broadcastWithData("INVOICE_REVERT", user.getFullName() + " reverted Invoice for " + wo.getWoNumber() + " (" + wo.getCustomerName() + ")", revertInvDto);
        return revertInvDto;
    }

    @Override
    public WorkOrderDetailDTO uploadInvoicePdf(Long id, MultipartFile pdfFile, String username) {
        WorkOrder wo = findWoOrThrow(id);
        User user = getUser(username);
        int cnt = fileStorageRepository.countByWorkOrderIdAndFileType(wo.getId(), FileStorage.FileType.PDF);
        saveFile(wo, pdfFile, FileStorage.FileType.PDF, cnt + 1, username, user.getFullName());
        logActivity(wo, username, user.getFullName(), "Invoice PDF uploaded (v" + (cnt+1) + ")", ActivityLog.ActionType.INVOICE_FILE_UPLOADED);
        return toDetailDTO(wo);
    }

    // ── READY FOR DISPATCH ───────────────────────────────────
    @Override
    public WorkOrderDetailDTO updateReadyForDispatch(Long id, String action, String username) {
        WorkOrder wo = findWoOrThrow(id);
        User user = getUser(username);
        boolean toDone = "DONE".equalsIgnoreCase(action);
        if (toDone) {
            if (wo.getInvoiceStatus() != WorkOrder.StepStatus.DONE)
                throw new BadRequestException("Cannot mark Ready For Dispatch — Invoice must be Done first.");
            if ("MORE_THAN_ONE_BOX".equals(wo.getPackingType()) && wo.getPackingDetailsStatus() != WorkOrder.StepStatus.DONE)
                throw new BadRequestException("Cannot mark Ready For Dispatch — Packing Details file must be uploaded first.");
        } else {
            if (wo.getCollectionStatus() == WorkOrder.StepStatus.DONE)
                throw new BadRequestException("Cannot revert Ready For Dispatch — Collection is already Done. Revert Collection first.");
        }
        wo.setReadyForDispatchStatus(toDone ? WorkOrder.StepStatus.DONE : WorkOrder.StepStatus.PENDING);
        wo.setReadyForDispatchUpdatedAt(LocalDateTime.now()); wo.setReadyForDispatchUpdatedBy(user.getFullName());
        workOrderRepository.save(wo); updateOverallStatus(wo);
        logActivity(wo, username, user.getFullName(),
            "Ready For Dispatch " + (toDone ? "marked DONE" : "reverted to PENDING"),
            toDone ? ActivityLog.ActionType.READY_FOR_DISPATCH_UPDATED : ActivityLog.ActionType.READY_FOR_DISPATCH_REVERTED);
        WorkOrderDetailDTO rfdDto = toDetailDTO(wo);
        if (toDone) {
            NotificationController.broadcastWithData("READY_FOR_DISPATCH_DONE", user.getFullName() + " marked Ready For Dispatch for " + wo.getWoNumber() + " (" + wo.getCustomerName() + ")", rfdDto);
        } else {
            NotificationController.broadcastWithData("READY_FOR_DISPATCH_REVERT", user.getFullName() + " reverted Ready For Dispatch for " + wo.getWoNumber() + " (" + wo.getCustomerName() + ")", rfdDto);
        }
        return rfdDto;
    }

    // ── COLLECTION ───────────────────────────────────────────
    @Override
    public WorkOrderDetailDTO updateCollection(Long id, String action, String username) {
        WorkOrder wo = findWoOrThrow(id);
        User user = getUser(username);
        boolean toDone = "DONE".equalsIgnoreCase(action);
        if (toDone) {
            if (wo.getReadyForDispatchStatus() != WorkOrder.StepStatus.DONE)
                throw new BadRequestException("Cannot mark Collection — Ready For Dispatch must be Done first.");
        }
        wo.setCollectionStatus(toDone ? WorkOrder.StepStatus.DONE : WorkOrder.StepStatus.PENDING);
        wo.setCollectionUpdatedAt(LocalDateTime.now()); wo.setCollectionUpdatedBy(user.getFullName());
        workOrderRepository.save(wo); updateOverallStatus(wo);
        logActivity(wo, username, user.getFullName(),
            "Collection " + (toDone ? "marked DONE" : "reverted to PENDING"),
            toDone ? ActivityLog.ActionType.COLLECTION_UPDATED : ActivityLog.ActionType.COLLECTION_REVERTED);
        WorkOrderDetailDTO collDto = toDetailDTO(wo);
        if (toDone) {
            NotificationController.broadcastWithData("COLLECTION_DONE", user.getFullName() + " marked Collection Done for " + wo.getWoNumber() + " (" + wo.getCustomerName() + ")", collDto);
        } else {
            NotificationController.broadcastWithData("COLLECTION_REVERT", user.getFullName() + " reverted Collection for " + wo.getWoNumber() + " (" + wo.getCustomerName() + ")", collDto);
        }
        return collDto;
    }

    // ── INVOICE ISSUE ─────────────────────────────────────────
    @Override
    public WorkOrderDetailDTO saveInvoiceIssue(Long id, InvoiceIssueRequest req, String username) {
        WorkOrder wo = findWoOrThrow(id);
        User user = getUser(username);
        wo.setInvoiceIssue(req.getInvoiceIssue());
        wo.setInvoiceIssueUpdatedAt(LocalDateTime.now()); wo.setInvoiceIssueUpdatedBy(user.getFullName());
        workOrderRepository.save(wo);
        boolean hasIssue = req.getInvoiceIssue() != null && !req.getInvoiceIssue().isBlank();
        logActivity(wo, username, user.getFullName(),
            hasIssue ? "Invoice issue reported: " + req.getInvoiceIssue() : "Invoice issue cleared",
            ActivityLog.ActionType.INVOICE_ISSUE_REPORTED);
        WorkOrderDetailDTO issueDto = toDetailDTO(wo);
        if (hasIssue)
            NotificationController.broadcastWithData("INVOICE_ISSUE", user.getFullName() + " reported an Invoice Issue on " + wo.getWoNumber() + " (" + wo.getCustomerName() + "): " + req.getInvoiceIssue(), issueDto);
        return issueDto;
    }

    // ── NOTE ──────────────────────────────────────────────────
    @Override
    public WorkOrderDetailDTO saveNote(Long id, NoteRequest req, String username) {
        WorkOrder wo = findWoOrThrow(id);
        User user = getUser(username);
        boolean isUpdate = wo.getNoteForInvoice() != null && !wo.getNoteForInvoice().isBlank();
        wo.setNoteForInvoice(req.getNoteForInvoice());
        wo.setNoteUpdatedAt(LocalDateTime.now()); wo.setNoteUpdatedBy(user.getFullName());
        workOrderRepository.save(wo);
        logActivity(wo, username, user.getFullName(),
            isUpdate ? "Note for Invoice Creator updated" : "Note for Invoice Creator added",
            ActivityLog.ActionType.WO_UPDATED);
        return toDetailDTO(wo);
    }

    // ── DELETE ─────────────────────────────────────────────────
    @Override
    public void deleteWorkOrder(Long id, String username) {
        WorkOrder wo = findWoOrThrow(id);
        log.warn("Dispatch {} deleted by {}", wo.getWoNumber(), username);
        workOrderRepository.delete(wo);
    }

    // ── HELPERS ────────────────────────────────────────────────
    private WorkOrder findWoOrThrow(Long id) {
        return workOrderRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Dispatch not found: " + id));
    }
    private User getUser(String username) {
        return userRepository.findByUsername(username)
            .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));
    }
    private void updateOverallStatus(WorkOrder wo) {
        boolean moreThanOne = "MORE_THAN_ONE_BOX".equals(wo.getPackingType());
        boolean allDone = wo.getStockStatus() == WorkOrder.StepStatus.DONE
            && wo.getPackagingStatus() == WorkOrder.StepStatus.DONE
            && wo.getInvoiceStatus() == WorkOrder.StepStatus.DONE
            && (!moreThanOne || wo.getPackingDetailsStatus() == WorkOrder.StepStatus.DONE)
            && wo.getReadyForDispatchStatus() == WorkOrder.StepStatus.DONE
            && wo.getCollectionStatus() == WorkOrder.StepStatus.DONE;
        if (allDone && wo.getStatus() != WorkOrder.WoStatus.REVISED) {
            wo.setStatus(WorkOrder.WoStatus.COMPLETED);
            workOrderRepository.save(wo);
        } else if (!allDone && wo.getStatus() == WorkOrder.WoStatus.COMPLETED) {
            wo.setStatus(WorkOrder.WoStatus.IN_PROGRESS);
            workOrderRepository.save(wo);
        }
    }
    private String generateWoNumber() {
        String prefix = "DL-" + java.time.Year.now().getValue() + "-";
        long count = workOrderRepository.count() + 1;
        return prefix + String.format("%04d", count);
    }
    private void saveFile(WorkOrder wo, MultipartFile file, FileStorage.FileType type,
                          int version, String username, String fullName) {
        try {
            String dir = switch (type) {
                case EXCEL -> excelUploadDir;
                case PDF -> pdfUploadDir;
                case PACKING -> packingUploadDir;
            };
            Files.createDirectories(Paths.get(dir));
            String orig = file.getOriginalFilename();
            String ext  = (orig != null && orig.contains(".")) ? orig.substring(orig.lastIndexOf('.')) : "";
            String stored = wo.getWoNumber() + "_v" + version + "_" + System.currentTimeMillis() + ext;
            Path target = Paths.get(dir, stored);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            fileStorageRepository.save(FileStorage.builder()
                .workOrder(wo).fileType(type).originalFileName(orig)
                .storedFileName(stored).filePath(target.toString())
                .version(version).uploadedBy(fullName).build());
        } catch (IOException e) {
            throw new BadRequestException("Failed to save file: " + e.getMessage());
        }
    }
    private void logActivity(WorkOrder wo, String username, String fullName,
                              String action, ActivityLog.ActionType type) {
        activityLogRepository.save(ActivityLog.builder()
            .workOrder(wo).username(username).fullName(fullName)
            .action(action).actionType(type).build());
    }

    // ── MAPPERS ────────────────────────────────────────────────
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("hh:mm a, dd MMM yyyy");

    private WorkOrderSummaryDTO toSummaryDTO(WorkOrder wo) {
        Optional<FileStorage> excel = fileStorageRepository.findTopByWorkOrderIdAndFileTypeOrderByVersionDesc(wo.getId(), FileStorage.FileType.EXCEL);
        Optional<FileStorage> pdf   = fileStorageRepository.findTopByWorkOrderIdAndFileTypeOrderByVersionDesc(wo.getId(), FileStorage.FileType.PDF);
        Optional<FileStorage> packing = fileStorageRepository.findTopByWorkOrderIdAndFileTypeOrderByVersionDesc(wo.getId(), FileStorage.FileType.PACKING);
        return WorkOrderSummaryDTO.builder()
            .id(wo.getId()).woNumber(wo.getWoNumber()).customerName(wo.getCustomerName())
            .shipmentMode(wo.getShipmentMode()).invoiceType(wo.getInvoiceType())
            .woDate(wo.getWoDate()).status(wo.getStatus().name())
            .version(wo.getVersion()).revised(wo.isRevised())
            .stockStatus(wo.getStockStatus().name())
            .packingType(wo.getPackingType())
            .packingDetailsStatus(wo.getPackingDetailsStatus() != null ? wo.getPackingDetailsStatus().name() : "PENDING")
            .packagingStatus(wo.getPackagingStatus().name())
            .invoiceStatus(wo.getInvoiceStatus().name())
            .invoiceNumber(wo.getInvoiceNumber()).invoiceDate(wo.getInvoiceDate())            .readyForDispatchStatus(wo.getReadyForDispatchStatus().name())
            .collectionStatus(wo.getCollectionStatus().name())
            .hasNote(wo.getNoteForInvoice() != null && !wo.getNoteForInvoice().isBlank())
            .hasInvoiceIssue(wo.getInvoiceIssue() != null && !wo.getInvoiceIssue().isBlank())
            .createdAt(wo.getCreatedAt()).updatedAt(wo.getUpdatedAt()).createdBy(wo.getCreatedBy())
            .latestExcelFileId(excel.map(FileStorage::getId).orElse(null))
            .latestExcelFileName(excel.map(FileStorage::getOriginalFileName).orElse(null))
            .latestPdfFileId(pdf.map(FileStorage::getId).orElse(null))
            .latestPdfFileName(pdf.map(FileStorage::getOriginalFileName).orElse(null))
            .latestPackingFileId(packing.map(FileStorage::getId).orElse(null))
            .latestPackingFileName(packing.map(FileStorage::getOriginalFileName).orElse(null))
            .build();
    }

    private WorkOrderDetailDTO toDetailDTO(WorkOrder wo) {
        List<FileDTO> excelFiles = fileStorageRepository
            .findByWorkOrderIdAndFileTypeOrderByVersionDesc(wo.getId(), FileStorage.FileType.EXCEL)
            .stream().map(this::toFileDTO).collect(Collectors.toList());
        List<FileDTO> pdfFiles = fileStorageRepository
            .findByWorkOrderIdAndFileTypeOrderByVersionDesc(wo.getId(), FileStorage.FileType.PDF)
            .stream().map(this::toFileDTO).collect(Collectors.toList());
        List<FileDTO> packingFiles = fileStorageRepository
            .findByWorkOrderIdAndFileTypeOrderByVersionDesc(wo.getId(), FileStorage.FileType.PACKING)
            .stream().map(this::toFileDTO).collect(Collectors.toList());
        List<ActivityLogDTO> logs = activityLogRepository
            .findByWorkOrderIdOrderByTimestampDesc(wo.getId())
            .stream().map(this::toLogDTO).collect(Collectors.toList());
        return WorkOrderDetailDTO.builder()
            .id(wo.getId()).woNumber(wo.getWoNumber()).customerName(wo.getCustomerName())
            .shipmentMode(wo.getShipmentMode()).invoiceType(wo.getInvoiceType())
            .woDate(wo.getWoDate()).status(wo.getStatus().name())
            .version(wo.getVersion()).revised(wo.isRevised())
            .revisionReason(wo.getRevisionReason()).revisionReasonUpdatedAt(wo.getRevisionReasonUpdatedAt())
            .stockStatus(wo.getStockStatus().name()).stockUpdatedAt(wo.getStockUpdatedAt()).stockUpdatedBy(wo.getStockUpdatedBy())
            .packingType(wo.getPackingType()).packagingDetails(wo.getPackagingDetails())
            .packagingStatus(wo.getPackagingStatus().name())
            .packagingUpdatedAt(wo.getPackagingUpdatedAt()).packagingUpdatedBy(wo.getPackagingUpdatedBy())
            .packingDetailsStatus(wo.getPackingDetailsStatus() != null ? wo.getPackingDetailsStatus().name() : "PENDING")
            .packingDetailsUpdatedAt(wo.getPackingDetailsUpdatedAt()).packingDetailsUpdatedBy(wo.getPackingDetailsUpdatedBy())
            .invoiceStatus(wo.getInvoiceStatus().name()).invoiceNumber(wo.getInvoiceNumber()).invoiceDate(wo.getInvoiceDate())
            .invoiceUpdatedAt(wo.getInvoiceUpdatedAt()).invoiceUpdatedBy(wo.getInvoiceUpdatedBy())
            .invoiceIssue(wo.getInvoiceIssue()).invoiceIssueUpdatedAt(wo.getInvoiceIssueUpdatedAt())
            .invoiceIssueUpdatedBy(wo.getInvoiceIssueUpdatedBy())
            .readyForDispatchStatus(wo.getReadyForDispatchStatus().name())
            .readyForDispatchUpdatedAt(wo.getReadyForDispatchUpdatedAt()).readyForDispatchUpdatedBy(wo.getReadyForDispatchUpdatedBy())
            .collectionStatus(wo.getCollectionStatus().name())
            .collectionUpdatedAt(wo.getCollectionUpdatedAt()).collectionUpdatedBy(wo.getCollectionUpdatedBy())
            .noteForInvoice(wo.getNoteForInvoice()).noteUpdatedAt(wo.getNoteUpdatedAt()).noteUpdatedBy(wo.getNoteUpdatedBy())
            .createdAt(wo.getCreatedAt()).updatedAt(wo.getUpdatedAt()).createdBy(wo.getCreatedBy())
            .excelFiles(excelFiles).pdfFiles(pdfFiles).packingFiles(packingFiles).activityLogs(logs)
            .build();
    }
    private FileDTO toFileDTO(FileStorage fs) {
        return FileDTO.builder().id(fs.getId()).originalFileName(fs.getOriginalFileName())
            .fileType(fs.getFileType().name()).version(fs.getVersion())
            .uploadedAt(fs.getUploadedAt()).uploadedBy(fs.getUploadedBy())
            .remarks(fs.getRemarks()).downloadUrl("/api/files/download/" + fs.getId()).build();
    }
    private ActivityLogDTO toLogDTO(ActivityLog l) {
        return ActivityLogDTO.builder().id(l.getId()).username(l.getUsername()).fullName(l.getFullName())
            .action(l.getAction()).actionType(l.getActionType().name()).timestamp(l.getTimestamp())
            .formattedTimestamp(l.getTimestamp().format(FMT) + " — by " + l.getFullName()).build();
    }
}
