package com.ameya.invoicetracker.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;

/**
 * Runs before DataSeeder (@Order 1) to ensure the 'role' column in the users table
 * is VARCHAR(50) and not a MySQL ENUM. MySQL ENUM columns are not automatically
 * expanded by ddl-auto=update when new enum values are added to the Java enum.
 */
@Component
@Order(0)
@RequiredArgsConstructor
@Slf4j
public class SchemaFixer implements CommandLineRunner {

    private final DataSource dataSource;

    @Override
    public void run(String... args) throws Exception {
        try (Connection conn = dataSource.getConnection()) {
            // Fix 1: Convert users.role from ENUM to VARCHAR so new roles can be added without schema changes
            DatabaseMetaData meta = conn.getMetaData();
            ResultSet cols = meta.getColumns(null, null, "users", "role");
            if (cols.next()) {
                String typeName = cols.getString("TYPE_NAME");
                if (typeName != null && typeName.toUpperCase().contains("ENUM")) {
                    log.info("SchemaFixer: converting users.role from ENUM to VARCHAR(50)");
                    conn.createStatement().execute(
                        "ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL"
                    );
                    log.info("SchemaFixer: users.role column converted successfully");
                }
            }

            // Fix 2: Ensure file_storage.amount_verified has no NULL values (primitive boolean can't hold NULL)
            ResultSet amtCols = meta.getColumns(null, null, "file_storage", "amount_verified");
            if (amtCols.next()) {
                // Set any NULL values to 0 (false) so Hibernate doesn't throw reading them
                int updated = conn.createStatement().executeUpdate(
                    "UPDATE file_storage SET amount_verified = 0 WHERE amount_verified IS NULL"
                );
                if (updated > 0) log.info("SchemaFixer: fixed {} file_storage rows with NULL amount_verified", updated);
                // Also tighten the column to NOT NULL with default 0
                conn.createStatement().execute(
                    "ALTER TABLE file_storage MODIFY COLUMN amount_verified BIT(1) NOT NULL DEFAULT 0"
                );
            }
        }
    }
}
