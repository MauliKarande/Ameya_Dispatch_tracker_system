package com.ameya.invoicetracker.controller;

import com.ameya.invoicetracker.entity.WorkOrder;
import com.ameya.invoicetracker.service.IssueExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Month;
import java.time.format.TextStyle;
import java.util.List;
import java.util.Locale;

/**
 * Export Issues: month-filtered CSV/PDF export of dispatches with a recorded
 * invoice issue (No PO / Rate Mismatch / etc.), for the Invoice Creator.
 */
@RestController
@RequestMapping("/api/export/issues")
@RequiredArgsConstructor
@PreAuthorize("hasRole('INVOICE_CREATOR')")
public class IssueExportController {

    private final IssueExportService issueExportService;

    @GetMapping("/csv")
    public ResponseEntity<Resource> csv(@RequestParam int year, @RequestParam int month) {
        List<WorkOrder> rows = issueExportService.findIssues(month, year);
        byte[] bytes = issueExportService.buildCsv(rows);
        String filename = "Export Issues " + monthLabel(month, year) + ".csv";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentLength(bytes.length)
                .body(new ByteArrayResource(bytes));
    }

    @GetMapping("/pdf")
    public ResponseEntity<Resource> pdf(@RequestParam int year, @RequestParam int month) throws Exception {
        List<WorkOrder> rows = issueExportService.findIssues(month, year);
        byte[] bytes = issueExportService.buildPdf(rows, monthLabel(month, year));
        String filename = "Export Issues " + monthLabel(month, year) + ".pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentLength(bytes.length)
                .body(new ByteArrayResource(bytes));
    }

    private String monthLabel(int month, int year) {
        return Month.of(month).getDisplayName(TextStyle.FULL, Locale.ENGLISH) + " " + year;
    }
}
