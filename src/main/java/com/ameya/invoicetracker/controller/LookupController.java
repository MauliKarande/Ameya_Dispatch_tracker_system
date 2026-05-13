package com.ameya.invoicetracker.controller;

import com.ameya.invoicetracker.dto.ApiResponse;
import com.ameya.invoicetracker.dto.LookupItemDTO;
import com.ameya.invoicetracker.entity.*;
import com.ameya.invoicetracker.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/lookup")
@RequiredArgsConstructor
public class LookupController {

    private final CustomerRepository customerRepository;
    private final ShipmentModeRepository shipmentModeRepository;
    private final InvoiceTypeRepository invoiceTypeRepository;

    @GetMapping("/customers")
    public ResponseEntity<ApiResponse<List<LookupItemDTO>>> getCustomers(
            @RequestParam(required = false) String q) {
        List<Customer> list = (q != null && !q.isBlank())
            ? customerRepository.searchByName(q)
            : customerRepository.findAllByOrderByNameAsc();
        return ResponseEntity.ok(ApiResponse.ok(list.stream()
            .map(c -> new LookupItemDTO(c.getId(), c.getName())).collect(Collectors.toList())));
    }

    @PostMapping("/customers")
    public ResponseEntity<ApiResponse<LookupItemDTO>> createCustomer(@RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "").trim();
        if (name.isBlank()) return ResponseEntity.badRequest().body(ApiResponse.error("Name required"));
        if (customerRepository.existsByNameIgnoreCase(name))
            return ResponseEntity.ok(ApiResponse.ok("Already exists",
                customerRepository.findAllByOrderByNameAsc().stream()
                    .filter(c -> c.getName().equalsIgnoreCase(name)).findFirst()
                    .map(c -> new LookupItemDTO(c.getId(), c.getName())).orElse(null)));
        Customer saved = customerRepository.save(Customer.builder().name(name).build());
        return ResponseEntity.ok(ApiResponse.ok("Customer created", new LookupItemDTO(saved.getId(), saved.getName())));
    }

    @GetMapping("/shipment-modes")
    public ResponseEntity<ApiResponse<List<LookupItemDTO>>> getShipmentModes() {
        return ResponseEntity.ok(ApiResponse.ok(shipmentModeRepository.findAllByOrderByNameAsc().stream()
            .map(s -> new LookupItemDTO(s.getId(), s.getName())).collect(Collectors.toList())));
    }

    @PostMapping("/shipment-modes")
    public ResponseEntity<ApiResponse<LookupItemDTO>> createShipmentMode(@RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "").trim();
        if (name.isBlank()) return ResponseEntity.badRequest().body(ApiResponse.error("Name required"));
        if (shipmentModeRepository.existsByNameIgnoreCase(name))
            return ResponseEntity.badRequest().body(ApiResponse.error("Already exists"));
        ShipmentMode saved = shipmentModeRepository.save(ShipmentMode.builder().name(name).build());
        return ResponseEntity.ok(ApiResponse.ok("Mode created", new LookupItemDTO(saved.getId(), saved.getName())));
    }

    @GetMapping("/invoice-types")
    public ResponseEntity<ApiResponse<List<LookupItemDTO>>> getInvoiceTypes() {
        return ResponseEntity.ok(ApiResponse.ok(invoiceTypeRepository.findAllByOrderByNameAsc().stream()
            .map(i -> new LookupItemDTO(i.getId(), i.getName())).collect(Collectors.toList())));
    }

    @PostMapping("/invoice-types")
    public ResponseEntity<ApiResponse<LookupItemDTO>> createInvoiceType(@RequestBody Map<String, String> body) {
        String name = body.getOrDefault("name", "").trim();
        if (name.isBlank()) return ResponseEntity.badRequest().body(ApiResponse.error("Name required"));
        if (invoiceTypeRepository.existsByNameIgnoreCase(name))
            return ResponseEntity.badRequest().body(ApiResponse.error("Already exists"));
        InvoiceType saved = invoiceTypeRepository.save(InvoiceType.builder().name(name).build());
        return ResponseEntity.ok(ApiResponse.ok("Type created", new LookupItemDTO(saved.getId(), saved.getName())));
    }
}
