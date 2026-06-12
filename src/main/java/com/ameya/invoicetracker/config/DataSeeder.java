package com.ameya.invoicetracker.config;

import com.ameya.invoicetracker.entity.*;
import com.ameya.invoicetracker.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component @Order(1) @RequiredArgsConstructor @Slf4j
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final CustomerRepository customerRepository;
    private final ShipmentModeRepository shipmentModeRepository;
    private final InvoiceTypeRepository invoiceTypeRepository;

    @Override
    public void run(String... args) {
        // ── GENERAL MANAGER ───────────────────────────────────────────────────
        seedUser("admin",          "System Admin",  User.Role.ADMIN,           "admin@123");
        seedUser("arvind.patil",   "Arvind Patil",  User.Role.GENERAL_MANAGER, "123");

        // ── STORE USERS ───────────────────────────────────────────────────────
        seedUser("krishna.salgar",    "Krishna Salgar",    User.Role.STORE, "123");
        seedUser("laxman.waghchoure", "Laxman Waghchoure", User.Role.STORE, "123");
        seedUser("yogesh.borde",      "Yogesh Borde",      User.Role.STORE, "123");
        seedUser("shyam.jagtap",      "Shyam Jagtap",      User.Role.STORE, "123");
        seedUser("vitthal.lekawale",  "Vitthal Lekawale",  User.Role.STORE, "123");

        // ── INVOICE CREATORS ──────────────────────────────────────────────────
        seedUser("mauli.karande",    "Mauli Karande",    User.Role.INVOICE_CREATOR, "123");
        seedUser("sanket.gogawale",  "Sanket Gogawale",  User.Role.INVOICE_CREATOR, "123");

        // ── SALES EXECUTIVE ───────────────────────────────────────────────────
        seedUser("vaibhav.yadav", "Vaibhav Yadav", User.Role.SALES_EXECUTIVE, "123456");

        // ── GUEST ─────────────────────────────────────────────────────────────
        seedUser("guest", "Guest", User.Role.GUEST, "123");

        // ── CUSTOMERS ─────────────────────────────────────────────────────────
        List<String> customers = List.of(
            "TRILLIUM Flow Technologies France SAS",
            "ARMATURE D.O.O (SLOVENIJA)",
            "Flowserve do Brasil LTDA (Tax ID 33.273.681/0001-10)",
            "SULZER LEEDS PMC - UK",
            "SULZER PUMPS (CANADA) INC",
            "FLOWSERVE PTE LTD. - Singapore",
            "SULZER PUMPS (US) INC",
            "TRILLIUM FLOW TECHNOLOGIES UK",
            "FLOWSERVE CORPORATION (FCD) SPRINGVILLE OPERATION",
            "ADAMS ARMATUREN GmbH",
            "BAF VALVES",
            "SULZER PUMPS (UK) LTD.",
            "Flowserve do Brasil LTD",
            "FLOWSERVE FLOW CONTROL DIVISION, RALEIGH",
            "SULZER PUMPS MEXICO, SA de CV",
            "TRILLIUM VALVES USA",
            "KOSO KENT INTROL LIMITED"
        );
        customers.forEach(name -> {
            if (!customerRepository.existsByNameIgnoreCase(name))
                customerRepository.save(Customer.builder().name(name).build());
        });

        // ── SHIPMENT MODES ────────────────────────────────────────────────────
        List<String> modes = List.of("AIR", "SEA", "ROAD", "COURIER", "HAND DELIVERY", "MULTIMODAL");
        modes.forEach(name -> {
            if (!shipmentModeRepository.existsByNameIgnoreCase(name))
                shipmentModeRepository.save(ShipmentMode.builder().name(name).build());
        });

        // ── INVOICE TYPES ─────────────────────────────────────────────────────
        List<String> types = List.of("Commercial", "Sample", "Domestic", "Charges", "Certifications");
        types.forEach(name -> {
            if (!invoiceTypeRepository.existsByNameIgnoreCase(name))
                invoiceTypeRepository.save(InvoiceType.builder().name(name).build());
        });

        log.info("All Ameya Dispatch Tracker users and lookup data ready.");
    }

    private void seedUser(String username, String fullName, User.Role role, String rawPassword) {
        if (!userRepository.existsByUsername(username)) {
            userRepository.save(User.builder()
                .username(username).fullName(fullName).role(role)
                .password(passwordEncoder.encode(rawPassword)).active(true).build());
            log.info("  Created: {} ({})", username, role);
        }
    }
}
