package com.ameya.invoicetracker.controller;

import com.ameya.invoicetracker.dto.ApiResponse;
import com.ameya.invoicetracker.entity.FileStorage;
import com.ameya.invoicetracker.exception.ResourceNotFoundException;
import com.ameya.invoicetracker.repository.FileStorageRepository;
import com.ameya.invoicetracker.service.WorkOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.net.MalformedURLException;
import java.nio.file.Path;
import java.nio.file.Paths;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final FileStorageRepository fileStorageRepository;
    private final WorkOrderService workOrderService;

    @GetMapping("/download/{fileId}")
    public ResponseEntity<Resource> downloadFile(@PathVariable Long fileId) {
        FileStorage fs = fileStorageRepository.findById(fileId)
            .orElseThrow(() -> new ResourceNotFoundException("File not found: " + fileId));

        try {
            Path filePath = Paths.get(fs.getFilePath());
            Resource resource = new UrlResource(filePath.toUri());

            if (!resource.exists() || !resource.isReadable()) {
                throw new ResourceNotFoundException("File not found on disk: " + fs.getOriginalFileName());
            }

            String contentType;
            if (fs.getFileType() == FileStorage.FileType.PDF) {
                contentType = "application/pdf";
            } else if (fs.getFileType() == FileStorage.FileType.EXCEL || fs.getFileType() == FileStorage.FileType.PACKING) {
                String name = fs.getOriginalFileName() != null ? fs.getOriginalFileName().toLowerCase() : "";
                if (name.endsWith(".csv")) contentType = "text/csv";
                else if (name.endsWith(".xls")) contentType = "application/vnd.ms-excel";
                else contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            } else {
                contentType = "application/octet-stream";
            }

            return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename=\"" + fs.getOriginalFileName() + "\"")
                .body(resource);

        } catch (MalformedURLException e) {
            throw new ResourceNotFoundException("Could not read file: " + fs.getOriginalFileName());
        }
    }

    @GetMapping("/view/{fileId}")
    public ResponseEntity<Resource> viewFile(@PathVariable Long fileId) {
        FileStorage fs = fileStorageRepository.findById(fileId)
            .orElseThrow(() -> new ResourceNotFoundException("File not found: " + fileId));

        try {
            Path filePath = Paths.get(fs.getFilePath());
            Resource resource = new UrlResource(filePath.toUri());

            if (!resource.exists()) throw new ResourceNotFoundException("File missing");

            String contentType = fs.getFileType() == FileStorage.FileType.PDF
                ? "application/pdf" : "application/octet-stream";

            return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                    "inline; filename=\"" + fs.getOriginalFileName() + "\"")
                .body(resource);

        } catch (MalformedURLException e) {
            throw new ResourceNotFoundException("Could not read file");
        }
    }

    @PatchMapping("/{fileId}/amount-total")
    public ResponseEntity<ApiResponse<Void>> saveAmountTotal(
            @PathVariable Long fileId,
            @RequestParam Double value) {
        FileStorage fs = fileStorageRepository.findById(fileId)
            .orElseThrow(() -> new ResourceNotFoundException("File not found: " + fileId));
        fs.setAmountTotal(value);
        fileStorageRepository.save(fs);
        return ResponseEntity.ok(ApiResponse.ok("Amount total saved", null));
    }

    @DeleteMapping("/{fileId}")
    @PreAuthorize("hasRole('INVOICE_CREATOR')")
    public ResponseEntity<ApiResponse<Void>> deleteInvoicePdf(
            @PathVariable Long fileId,
            @AuthenticationPrincipal UserDetails ud) {
        workOrderService.deleteInvoicePdf(fileId, ud.getUsername());
        return ResponseEntity.ok(ApiResponse.ok("Invoice PDF deleted", null));
    }
}
