package com.ameya.invoicetracker.dto;
import lombok.*;
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class NoteRequest {
    private String noteForInvoice; // nullable — allow clearing the note
}
