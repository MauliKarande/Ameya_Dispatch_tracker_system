package com.ameya.invoicetracker.controller;

import com.ameya.invoicetracker.dto.*;
import com.ameya.invoicetracker.service.WorkOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/workorders")
@RequiredArgsConstructor
public class WorkOrderController {

    private final WorkOrderService workOrderService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<WorkOrderSummaryDTO>>> getAll(
            @RequestParam(required = false) String customer,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String filter) {

        if ("ready-for-invoice".equals(filter)) {
            List<WorkOrderSummaryDTO> result = workOrderService.getReadyForInvoice();
            return ResponseEntity.ok(ApiResponse.ok(result));
        }
        if ("ready-for-dispatch".equals(filter)) {
            List<WorkOrderSummaryDTO> result = workOrderService.getReadyForDispatch();
            return ResponseEntity.ok(ApiResponse.ok(result));
        }

        boolean hasFilter = (customer != null && !customer.isBlank()) || month != null
            || year != null || (status != null && !status.isBlank());
        List<WorkOrderSummaryDTO> result = hasFilter
            ? workOrderService.searchWorkOrders(SearchRequest.builder()
                .customerName(customer).month(month).year(year).status(status).build())
            : workOrderService.getAllWorkOrders();
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<WorkOrderDetailDTO>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(workOrderService.getWorkOrderById(id)));
    }

    @GetMapping("/by-number/{woNumber}")
    public ResponseEntity<ApiResponse<WorkOrderDetailDTO>> getByNumber(@PathVariable String woNumber) {
        return ResponseEntity.ok(ApiResponse.ok(workOrderService.getWorkOrderByWoNumber(woNumber)));
    }

    @PostMapping
    @PreAuthorize("hasRole('GENERAL_MANAGER')")
    public ResponseEntity<ApiResponse<WorkOrderDetailDTO>> create(
            @Valid @RequestPart("data") WorkOrderCreateRequest req,
            @RequestPart(value = "excelFile", required = false) MultipartFile excelFile,
            @RequestParam(value = "amountTotal", required = false) Double amountTotal,
            @AuthenticationPrincipal UserDetails ud) {
        return ResponseEntity.ok(ApiResponse.ok("Dispatch created",
            workOrderService.createWorkOrder(req, excelFile, ud.getUsername(), amountTotal)));
    }

    @PutMapping("/{id}/details")
    @PreAuthorize("hasRole('GENERAL_MANAGER')")
    public ResponseEntity<ApiResponse<WorkOrderDetailDTO>> updateDetails(
            @PathVariable Long id,
            @RequestBody WorkOrderEditRequest req,
            @AuthenticationPrincipal UserDetails ud) {
        return ResponseEntity.ok(ApiResponse.ok("Dispatch updated",
            workOrderService.updateWorkOrderDetails(id, req, ud.getUsername())));
    }

    @PostMapping("/{id}/excel")
    @PreAuthorize("hasRole('GENERAL_MANAGER')")
    public ResponseEntity<ApiResponse<WorkOrderDetailDTO>> uploadExcel(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @RequestParam("revisionReason") String revisionReason,
            @RequestParam(value = "amountTotal", required = false) Double amountTotal,
            @AuthenticationPrincipal UserDetails ud) {
        return ResponseEntity.ok(ApiResponse.ok("Excel revision uploaded",
            workOrderService.uploadNewExcel(id, file, revisionReason, ud.getUsername(), amountTotal)));
    }

    @PatchMapping("/{id}/stock")
    @PreAuthorize("hasRole('STORE')")
    public ResponseEntity<ApiResponse<WorkOrderDetailDTO>> updateStock(
            @PathVariable Long id,
            @RequestParam(defaultValue = "DONE") String action,
            @AuthenticationPrincipal UserDetails ud) {
        return ResponseEntity.ok(ApiResponse.ok("Stock status updated",
            workOrderService.updateStockStatus(id, action, ud.getUsername())));
    }

    @PutMapping("/{id}/packaging")
    @PreAuthorize("hasRole('STORE')")
    public ResponseEntity<ApiResponse<WorkOrderDetailDTO>> savePackaging(
            @PathVariable Long id,
            @RequestBody PackagingRequest req,
            @AuthenticationPrincipal UserDetails ud) {
        return ResponseEntity.ok(ApiResponse.ok("Box Details saved",
            workOrderService.savePackagingDetails(id, req, ud.getUsername())));
    }

    @PatchMapping("/{id}/packaging/revert")
    @PreAuthorize("hasRole('STORE')")
    public ResponseEntity<ApiResponse<WorkOrderDetailDTO>> revertPackaging(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails ud) {
        return ResponseEntity.ok(ApiResponse.ok("Box Details reverted",
            workOrderService.revertPackagingStatus(id, ud.getUsername())));
    }

    // ── PACKING DETAILS (MORE_THAN_ONE_BOX only — file upload after invoice) ──
    @PutMapping("/{id}/packing-details")
    @PreAuthorize("hasRole('STORE')")
    public ResponseEntity<ApiResponse<WorkOrderDetailDTO>> savePackingDetails(
            @PathVariable Long id,
            @RequestPart(value = "packingFile") MultipartFile packingFile,
            @AuthenticationPrincipal UserDetails ud) {
        return ResponseEntity.ok(ApiResponse.ok("Packing Details saved",
            workOrderService.savePackingDetails(id, packingFile, ud.getUsername())));
    }

    @PatchMapping("/{id}/packing-details/revert")
    @PreAuthorize("hasRole('STORE')")
    public ResponseEntity<ApiResponse<WorkOrderDetailDTO>> revertPackingDetails(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails ud) {
        return ResponseEntity.ok(ApiResponse.ok("Packing Details reverted",
            workOrderService.revertPackingDetailsStatus(id, ud.getUsername())));
    }

    @PutMapping("/{id}/invoice")
    @PreAuthorize("hasRole('INVOICE_CREATOR')")
    public ResponseEntity<ApiResponse<WorkOrderDetailDTO>> updateInvoice(
            @PathVariable Long id,
            @RequestPart("data") InvoiceUpdateRequest req,
            @RequestPart(value = "pdfFile", required = false) MultipartFile pdfFile,
            @AuthenticationPrincipal UserDetails ud) {
        return ResponseEntity.ok(ApiResponse.ok("Invoice updated",
            workOrderService.updateInvoice(id, req, pdfFile, ud.getUsername())));
    }

    @PatchMapping("/{id}/invoice/revert")
    @PreAuthorize("hasRole('INVOICE_CREATOR')")
    public ResponseEntity<ApiResponse<WorkOrderDetailDTO>> revertInvoice(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails ud) {
        return ResponseEntity.ok(ApiResponse.ok("Invoice reverted",
            workOrderService.revertInvoiceStatus(id, ud.getUsername())));
    }

    @PostMapping("/{id}/invoice/pdf")
    @PreAuthorize("hasRole('INVOICE_CREATOR')")
    public ResponseEntity<ApiResponse<WorkOrderDetailDTO>> uploadInvoicePdf(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserDetails ud) {
        return ResponseEntity.ok(ApiResponse.ok("PDF uploaded",
            workOrderService.uploadInvoicePdf(id, file, ud.getUsername())));
    }

    @PatchMapping("/{id}/ready-for-dispatch")
    @PreAuthorize("hasRole('STORE')")
    public ResponseEntity<ApiResponse<WorkOrderDetailDTO>> updateReadyForDispatch(
            @PathVariable Long id,
            @RequestParam(defaultValue = "DONE") String action,
            @AuthenticationPrincipal UserDetails ud) {
        return ResponseEntity.ok(ApiResponse.ok("Ready For Dispatch updated",
            workOrderService.updateReadyForDispatch(id, action, ud.getUsername())));
    }

    @PatchMapping("/{id}/collection")
    @PreAuthorize("hasRole('STORE')")
    public ResponseEntity<ApiResponse<WorkOrderDetailDTO>> updateCollection(
            @PathVariable Long id,
            @RequestParam(defaultValue = "DONE") String action,
            @AuthenticationPrincipal UserDetails ud) {
        return ResponseEntity.ok(ApiResponse.ok("Collection updated",
            workOrderService.updateCollection(id, action, ud.getUsername())));
    }

    @PutMapping("/{id}/invoice-issue")
    @PreAuthorize("hasRole('INVOICE_CREATOR')")
    public ResponseEntity<ApiResponse<WorkOrderDetailDTO>> saveInvoiceIssue(
            @PathVariable Long id,
            @RequestBody InvoiceIssueRequest req,
            @AuthenticationPrincipal UserDetails ud) {
        return ResponseEntity.ok(ApiResponse.ok("Issue saved",
            workOrderService.saveInvoiceIssue(id, req, ud.getUsername())));
    }

    @PutMapping("/{id}/note")
    @PreAuthorize("hasRole('GENERAL_MANAGER')")
    public ResponseEntity<ApiResponse<WorkOrderDetailDTO>> saveNote(
            @PathVariable Long id,
            @RequestBody NoteRequest req,
            @AuthenticationPrincipal UserDetails ud) {
        return ResponseEntity.ok(ApiResponse.ok("Note saved",
            workOrderService.saveNote(id, req, ud.getUsername())));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('GENERAL_MANAGER')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable Long id, @AuthenticationPrincipal UserDetails ud) {
        workOrderService.deleteWorkOrder(id, ud.getUsername());
        return ResponseEntity.ok(ApiResponse.ok("Dispatch deleted", null));
    }
}
