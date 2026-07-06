package com.ameya.invoicetracker.dto;

import lombok.*;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SupplySubmitRequest {
    /** "SHORT", "EXCEED", or "BOTH" */
    private String supplyType;
    private List<SupplyPartRow> parts;

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class SupplyPartRow {
        private String partNo;
        private String poNo;
        private String srNo;
        private Integer invQty;
        private Integer poQty;
        private Integer actualDespQty;
        private Integer shortQty;
        private Integer exceedQty;
    }
}
