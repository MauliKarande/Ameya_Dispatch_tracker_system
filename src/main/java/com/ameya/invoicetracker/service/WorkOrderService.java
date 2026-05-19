package com.ameya.invoicetracker.service;

import com.ameya.invoicetracker.dto.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

public interface WorkOrderService {
    WorkOrderDetailDTO createWorkOrder(WorkOrderCreateRequest request, MultipartFile excelFile, String username);
    WorkOrderDetailDTO getWorkOrderById(Long id);
    WorkOrderDetailDTO getWorkOrderByWoNumber(String woNumber);
    List<WorkOrderSummaryDTO> getAllWorkOrders();
    List<WorkOrderSummaryDTO> searchWorkOrders(SearchRequest request);
    WorkOrderDetailDTO updateWorkOrderDetails(Long id, WorkOrderEditRequest req, String username);
    WorkOrderDetailDTO uploadNewExcel(Long id, MultipartFile excelFile, String revisionReason, String username);
    WorkOrderDetailDTO updateStockStatus(Long id, String action, String username);
    WorkOrderDetailDTO savePackagingDetails(Long id, PackagingRequest request, String username);
    WorkOrderDetailDTO revertPackagingStatus(Long id, String username);
    WorkOrderDetailDTO savePackingDetails(Long id, MultipartFile packingFile, String username);
    WorkOrderDetailDTO revertPackingDetailsStatus(Long id, String username);
    WorkOrderDetailDTO updateInvoice(Long id, InvoiceUpdateRequest request, MultipartFile pdfFile, String username);
    WorkOrderDetailDTO revertInvoiceStatus(Long id, String username);
    WorkOrderDetailDTO uploadInvoicePdf(Long id, MultipartFile pdfFile, String username);
    WorkOrderDetailDTO updateReadyForDispatch(Long id, String action, String username);
    WorkOrderDetailDTO updateCollection(Long id, String action, String username);
    WorkOrderDetailDTO saveNote(Long id, NoteRequest request, String username);
    WorkOrderDetailDTO saveInvoiceIssue(Long id, InvoiceIssueRequest request, String username);
    void deleteWorkOrder(Long id, String username);
    List<WorkOrderSummaryDTO> getReadyForInvoice();
    void deleteInvoicePdf(Long fileId, String username);
}
