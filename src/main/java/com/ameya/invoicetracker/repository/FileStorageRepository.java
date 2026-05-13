package com.ameya.invoicetracker.repository;

import com.ameya.invoicetracker.entity.FileStorage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface FileStorageRepository extends JpaRepository<FileStorage, Long> {

    List<FileStorage> findByWorkOrderIdAndFileTypeOrderByVersionDesc(Long workOrderId, FileStorage.FileType fileType);

    Optional<FileStorage> findTopByWorkOrderIdAndFileTypeOrderByVersionDesc(Long workOrderId, FileStorage.FileType fileType);

    int countByWorkOrderIdAndFileType(Long workOrderId, FileStorage.FileType fileType);

    @Query("SELECT f FROM FileStorage f WHERE f.workOrder.id = :woId AND f.fileType = :type AND f.deleted = false ORDER BY f.version DESC")
    List<FileStorage> findActiveByWorkOrderIdAndFileType(@Param("woId") Long woId, @Param("type") FileStorage.FileType type);

    @Query("SELECT f FROM FileStorage f WHERE f.workOrder.id = :woId AND f.fileType = :type AND f.deleted = false ORDER BY f.version DESC LIMIT 1")
    Optional<FileStorage> findTopActiveByWorkOrderIdAndFileType(@Param("woId") Long woId, @Param("type") FileStorage.FileType type);

    @Query("SELECT f FROM FileStorage f WHERE f.workOrder.status = 'COMPLETED' AND f.workOrder.updatedAt < :cutoff AND f.deleted = false")
    List<FileStorage> findFilesForCleanup(@Param("cutoff") LocalDateTime cutoff);
}
