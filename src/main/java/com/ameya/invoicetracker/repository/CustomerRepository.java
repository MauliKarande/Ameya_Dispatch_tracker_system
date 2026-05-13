package com.ameya.invoicetracker.repository;

import com.ameya.invoicetracker.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface CustomerRepository extends JpaRepository<Customer, Long> {
    boolean existsByNameIgnoreCase(String name);
    @Query("SELECT c FROM Customer c WHERE LOWER(c.name) LIKE LOWER(CONCAT('%',:q,'%')) ORDER BY c.name")
    List<Customer> searchByName(@Param("q") String q);
    List<Customer> findAllByOrderByNameAsc();
}
