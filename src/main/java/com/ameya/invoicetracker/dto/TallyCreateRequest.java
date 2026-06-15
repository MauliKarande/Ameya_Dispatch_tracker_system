package com.ameya.invoicetracker.dto;

import lombok.*;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class TallyCreateRequest {
    private List<TallyPartDTO> parts;
    private String voucherNumber;
    private String voucherDate;
    private String partyTally;
    private String partyCountry;
    private String currency;
    private double exchangeRate;
    private String airSea;
    // Export
    private String terms;
    private String portLoading;
    private String portDischarge;
    private String finalDest;
    private String countryDest;
    private String buyerName;
    private String buyerAddress;
    // Packing
    private String netWeight;
    private String grossWeight;
    private String boxSize;
    private String boxType;
    // Folders
    private String mainInvoiceFolder;
}
