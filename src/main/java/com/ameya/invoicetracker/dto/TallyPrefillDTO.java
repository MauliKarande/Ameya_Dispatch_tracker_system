package com.ameya.invoicetracker.dto;

import lombok.*;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TallyPrefillDTO {
    // Party
    private String partyTally;
    private String currency;
    private String partyCountry;
    // false when the customer couldn't be matched to any saved party — the UI
    // then prompts to create the party once (name/currency/address)
    private boolean partyKnown;
    // Shipment
    private String airSea;
    // Voucher
    private String lastVoucherNo;
    private String nextVoucherNo;
    // Export details
    private String terms;
    private String portLoading;
    private String portDischarge;
    private String finalDest;
    private String countryDest;
    private String buyerName;
    private String buyerAddress;
    // Address lines for display
    private List<String> addressLines;
    private String mailingName;
    // Parsed parts
    private List<TallyPartDTO> parts;
    private String parseError;
    // Excel file id so the frontend can parse client-side (matches Invoice View)
    private Long excelFileId;
    // Folder
    private String mainInvoiceFolder;
}
