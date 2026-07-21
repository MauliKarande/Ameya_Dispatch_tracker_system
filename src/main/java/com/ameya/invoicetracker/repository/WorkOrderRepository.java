package com.ameya.invoicetracker.repository;

import com.ameya.invoicetracker.entity.WorkOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface WorkOrderRepository extends JpaRepository<WorkOrder, Long> {

    Optional<WorkOrder> findByWoNumber(String woNumber);

    boolean existsByWoNumber(String woNumber);

    @Query("SELECT MAX(w.woNumber) FROM WorkOrder w WHERE w.woNumber LIKE CONCAT(:prefix, '%')")
    Optional<String> findMaxWoNumberByPrefix(@Param("prefix") String prefix);

    // Default: newest first
    List<WorkOrder> findAllByOrderByCreatedAtDesc();

    // Filter by status
    List<WorkOrder> findByStatusOrderByCreatedAtDesc(WorkOrder.WoStatus status);

    // Search by customer name (case-insensitive)
    List<WorkOrder> findByCustomerNameContainingIgnoreCaseOrderByCreatedAtDesc(String customerName);

    // Filter by month + year
    @Query("SELECT w FROM WorkOrder w WHERE MONTH(w.woDate) = :month AND YEAR(w.woDate) = :year ORDER BY w.createdAt DESC")
    List<WorkOrder> findByMonthAndYear(@Param("month") int month, @Param("year") int year);

    // Filter by date range
    @Query("SELECT w FROM WorkOrder w WHERE w.woDate BETWEEN :startDate AND :endDate ORDER BY w.createdAt DESC")
    List<WorkOrder> findByDateRange(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // Export Dispatch Data: completed, non-domestic invoices in an invoice-date range.
    // ROAD / HAND DELIVERY shipments are domestic by definition — this also catches
    // real rows whose invoiceType was mislabeled 'Commercial' (e.g. S-26-27-00014).
    @Query("SELECT w FROM WorkOrder w WHERE w.invoiceDate BETWEEN :startDate AND :endDate " +
           "AND w.invoiceStatus = :invoiceStatus " +
           "AND LOWER(w.invoiceType) <> 'domestic' " +
           "AND UPPER(w.shipmentMode) NOT LIKE '%ROAD%' " +
           "AND UPPER(w.shipmentMode) NOT LIKE '%HAND%' " +
           "ORDER BY w.invoiceDate ASC, w.invoiceNumber ASC")
    List<WorkOrder> findExportableInvoices(
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate,
        @Param("invoiceStatus") WorkOrder.StepStatus invoiceStatus
    );

    // Combined search: customer + month/year
    @Query("SELECT w FROM WorkOrder w WHERE " +
           "(:customer IS NULL OR LOWER(w.customerName) LIKE LOWER(CONCAT('%', :customer, '%'))) AND " +
           "(:month IS NULL OR MONTH(w.woDate) = :month) AND " +
           "(:year IS NULL OR YEAR(w.woDate) = :year) AND " +
           "(:status IS NULL OR w.status = :status) " +
           "ORDER BY w.createdAt DESC")
    List<WorkOrder> searchWorkOrders(
        @Param("customer") String customer,
        @Param("month") Integer month,
        @Param("year") Integer year,
        @Param("status") WorkOrder.WoStatus status
    );
}
