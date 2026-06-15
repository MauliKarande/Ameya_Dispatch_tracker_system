package com.ameya.invoicetracker.dto;

import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TallyPartDTO {
    private int row;
    private String partNo;
    private int qty;
    private double amount;
    private String poNo;
    private String poSrNo;
    private double ratePc;
}
