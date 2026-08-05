package com.ameya.invoicetracker.controller;

import com.ameya.invoicetracker.entity.WorkOrder;
import com.ameya.invoicetracker.service.IssueExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Export Issues: CSV/PDF export of dispatches with a recorded invoice issue
 * (No PO / Rate Mismatch / etc.), for the Invoice Creator. Accepts a date
 * range so a single month or a consolidated multi-month period both work.
 */
@RestController
@RequestMapping("/api/export/issues")
@RequiredArgsConstructor
@PreAuthorize("hasRole('INVOICE_CREATOR')")
public class IssueExportController {

    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("MMMM yyyy");

    private final IssueExportService issueExportService;

    @GetMapping("/csv")
    public ResponseEntity<Resource> csv(@RequestParam LocalDate startDate, @RequestParam LocalDate endDate) {
        List<WorkOrder> rows = issueExportService.findIssues(startDate, endDate);
        byte[] bytes = issueExportService.buildCsv(rows);
        String filename = "Export Issues " + rangeLabel(startDate, endDate) + ".csv";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentLength(bytes.length)
                .body(new ByteArrayResource(bytes));
    }

    @GetMapping("/pdf")
    public ResponseEntity<Resource> pdf(@RequestParam LocalDate startDate, @RequestParam LocalDate endDate) throws Exception {
        List<WorkOrder> rows = issueExportService.findIssues(startDate, endDate);
        byte[] bytes = issueExportService.buildPdf(rows, rangeLabel(startDate, endDate));
        String filename = "Export Issues " + rangeLabel(startDate, endDate) + ".pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentLength(bytes.length)
                .body(new ByteArrayResource(bytes));
    }

    // Same calendar month → "July 2026"; otherwise → "July 2026 to September 2026"
    private String rangeLabel(LocalDate startDate, LocalDate endDate) {
        String startLabel = startDate.format(MONTH_FMT);
        String endLabel = endDate.format(MONTH_FMT);
        return startLabel.equals(endLabel) ? startLabel : startLabel + " to " + endLabel;
    }
}
