package com.ameya.invoicetracker.scheduler;

import com.ameya.invoicetracker.entity.*;
import com.ameya.invoicetracker.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.List;

@Component @RequiredArgsConstructor @Slf4j
public class FileCleanupScheduler {

    private final FileStorageRepository fileStorageRepository;
    private final ActivityLogRepository activityLogRepository;

    // Run daily at 2 AM
    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void cleanupOldFiles() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(90);
        List<FileStorage> files = fileStorageRepository.findFilesForCleanup(cutoff);
        int deleted = 0;
        for (FileStorage fs : files) {
            try {
                Path path = Paths.get(fs.getFilePath());
                if (Files.exists(path)) {
                    Files.delete(path);
                    deleted++;
                }
                fs.setDeleted(true);
                fs.setDeletedAt(LocalDateTime.now());
                fileStorageRepository.save(fs);
            } catch (IOException e) {
                log.warn("Failed to delete file: {} — {}", fs.getFilePath(), e.getMessage());
            }
        }
        if (deleted > 0) log.info("Auto cleanup: deleted {} physical files from completed dispatches (>90 days inactive)", deleted);
    }
}
