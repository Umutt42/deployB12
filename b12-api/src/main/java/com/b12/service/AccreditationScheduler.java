package com.b12.service;

import com.b12.domain.CenterAccreditation;
import com.b12.repository.CenterAccreditationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class AccreditationScheduler {

    private final CenterAccreditationRepository accreditationRepo;

    /** Au démarrage du serveur : archive ce qui est déjà expiré. */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void archiveOnStartup() {
        archiveExpiredAccreditations();
    }

    /**
     * Tous les jours à minuit : archive automatiquement les agréments
     * dont la date de fin est dépassée.
     */
    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void archiveExpiredAccreditations() {
        List<CenterAccreditation> expired = accreditationRepo
                .findByEndDateBeforeAndArchivedFalse(LocalDate.now());

        if (expired.isEmpty()) return;

        for (CenterAccreditation a : expired) {
            a.setArchived(true);
            a.setUpdatedBy("system");
        }
        accreditationRepo.saveAll(expired);

        log.info("Archivage automatique : {} agrément(s) archivé(s) (date de fin dépassée)", expired.size());
    }
}
