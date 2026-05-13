package com.ameya.invoicetracker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class InvoiceTrackerApplication {
    public static void main(String[] args) {
        SpringApplication.run(InvoiceTrackerApplication.class, args);
    }
}
