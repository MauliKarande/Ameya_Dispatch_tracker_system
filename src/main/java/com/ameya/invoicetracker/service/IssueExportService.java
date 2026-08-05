package com.ameya.invoicetracker.service;

import com.ameya.invoicetracker.entity.WorkOrder;
import com.ameya.invoicetracker.repository.WorkOrderRepository;
import com.lowagie.text.Document;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class IssueExportService {

    private static final DateTimeFormatter RAISED_FMT = DateTimeFormatter.ofPattern("dd-MMM-yyyy HH:mm");
    private static final String[] HEADERS = { "DL No", "Party Name", "Invoice No", "Issue", "Raised Date & Time" };

    private final WorkOrderRepository workOrderRepository;

    public List<WorkOrder> findIssues(int month, int year) {
        return workOrderRepository.findIssuesByMonthAndYear(month, year).stream()
                .filter(w -> w.getInvoiceIssue() != null && !w.getInvoiceIssue().isBlank())
                .toList();
    }

    public byte[] buildCsv(List<WorkOrder> rows) {
        StringBuilder sb = new StringBuilder();
        sb.append('﻿'); // UTF-8 BOM so Excel opens this correctly
        sb.append(String.join(",", HEADERS)).append("\r\n");
        for (WorkOrder w : rows) {
            sb.append(csvCell(w.getWoNumber())).append(',')
              .append(csvCell(w.getCustomerName())).append(',')
              .append(csvCell(w.getInvoiceNumber())).append(',')
              .append(csvCell(w.getInvoiceIssue())).append(',')
              .append(csvCell(raisedText(w)))
              .append("\r\n");
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    public byte[] buildPdf(List<WorkOrder> rows, String monthLabel) throws Exception {
        Document doc = new Document(PageSize.A4.rotate(), 24, 24, 36, 24);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter.getInstance(doc, baos);
        doc.open();

        Font titleFont = new Font(Font.HELVETICA, 14, Font.BOLD);
        Font headFont  = new Font(Font.HELVETICA, 9, Font.BOLD, Color.WHITE);
        Font cellFont  = new Font(Font.HELVETICA, 8.5f, Font.NORMAL);

        Paragraph title = new Paragraph("Export Issues — " + monthLabel, titleFont);
        title.setSpacingAfter(10);
        doc.add(title);

        PdfPTable table = new PdfPTable(HEADERS.length);
        table.setWidthPercentage(100);
        table.setWidths(new float[] { 12, 24, 10, 38, 16 });

        for (String h : HEADERS) {
            PdfPCell cell = new PdfPCell(new Phrase(h, headFont));
            cell.setBackgroundColor(new Color(30, 58, 110));
            cell.setPadding(5);
            table.addCell(cell);
        }

        if (rows.isEmpty()) {
            PdfPCell empty = new PdfPCell(new Phrase("No issues recorded for this month", cellFont));
            empty.setColspan(HEADERS.length);
            empty.setPadding(10);
            table.addCell(empty);
        } else {
            for (WorkOrder w : rows) {
                addCell(table, w.getWoNumber(), cellFont);
                addCell(table, w.getCustomerName(), cellFont);
                addCell(table, w.getInvoiceNumber(), cellFont);
                addCell(table, w.getInvoiceIssue(), cellFont);
                addCell(table, raisedText(w), cellFont);
            }
        }

        doc.add(table);
        doc.close();
        return baos.toByteArray();
    }

    private void addCell(PdfPTable table, String value, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(value != null ? value : "", font));
        cell.setPadding(4);
        table.addCell(cell);
    }

    private String csvCell(String v) {
        if (v == null) v = "";
        return "\"" + v.replace("\"", "\"\"") + "\"";
    }

    private String raisedText(WorkOrder w) {
        return w.getInvoiceIssueUpdatedAt() != null ? w.getInvoiceIssueUpdatedAt().format(RAISED_FMT) : "";
    }
}
