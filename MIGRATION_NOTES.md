# Invoice Tracker v5 - Migration Notes

## Role Changes (IMPORTANT)

The role system has been renamed. If you have an existing v4 database, run the following SQL on the H2 console (`/h2-console`) before starting the application:

```sql
-- Migrate old roles to new roles
UPDATE users SET role = 'GENERAL_MANAGER' WHERE role = 'WO_SENDER';
UPDATE users SET role = 'STORE'           WHERE role IN ('STORE_PERSON', 'PACKAGING');
UPDATE users SET role = 'INVOICE_CREATOR' WHERE role = 'INVOICE_CREATOR';
UPDATE users SET role = 'GUEST'           WHERE role = 'VIEWER';
```

> **If this is a fresh install, no migration is needed.** The DataSeeder will create all users automatically.

## New Columns Added

The following columns are added to the `work_orders` table automatically by `ddl-auto=update`:

| Column | Default |
|---|---|
| invoice_type | 'Commercial' |
| packing_type | NULL |
| ready_for_dispatch_status | 'PENDING' |
| ready_for_dispatch_updated_at | NULL |
| ready_for_dispatch_updated_by | NULL |
| collection_status | 'PENDING' |
| collection_updated_at | NULL |
| collection_updated_by | NULL |

## New Tables

- `customers` — managed via `/api/lookup/customers`
- `shipment_modes` — managed via `/api/lookup/shipment-modes`
- `invoice_types` — managed via `/api/lookup/invoice-types`

These are pre-seeded on first startup via `DataSeeder`.

## Dispatch Number Format

New dispatches use `DL-YYYY-NNNN` format (e.g. `DL-2026-0001`).  
Existing records with `WO-YYYY-NNNN` format continue to work unchanged.

## File Upload Paths

| Type | Path |
|---|---|
| Excel (WO) | `./uploads/excel/` |
| Invoice PDF | `./uploads/pdf/` |
| Packing files | `./uploads/packing/` |

## Auto File Cleanup

A scheduled job runs daily at 2:00 AM. It deletes physical files for dispatches that are:
- Status = COMPLETED, AND
- Inactive (no updates) for > 90 days

Records, metadata, audit logs, and revision history are **never** deleted.
