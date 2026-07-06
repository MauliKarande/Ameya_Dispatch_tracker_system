package com.ameya.invoicetracker.controller;

import com.ameya.invoicetracker.dto.*;
import com.ameya.invoicetracker.service.DlRemarkService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/remarks")
@RequiredArgsConstructor
public class DlRemarkController {

    private final DlRemarkService remarkService;

    /** GET current remark + history for a DL. Visible to all authenticated users. */
    @GetMapping("/{workOrderId}")
    public ResponseEntity<ApiResponse<DlRemarkDTO>> get(@PathVariable Long workOrderId) {
        return ResponseEntity.ok(ApiResponse.ok(remarkService.getRemarkDTO(workOrderId)));
    }

    /** PUT — save or update the remark. General Manager and Store only. */
    @PutMapping("/{workOrderId}")
    @PreAuthorize("hasAnyRole('GENERAL_MANAGER','STORE')")
    public ResponseEntity<ApiResponse<DlRemarkDTO>> save(
            @PathVariable Long workOrderId,
            @RequestBody DlRemarkRequest req,
            @AuthenticationPrincipal UserDetails ud) {
        DlRemarkDTO dto = remarkService.saveRemark(workOrderId, req.getRemark(), ud.getUsername());
        return ResponseEntity.ok(ApiResponse.ok("Remark saved", dto));
    }
}
