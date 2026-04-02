package com.b12.repository;

import com.b12.domain.CenterAccreditation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CenterAccreditationRepository extends JpaRepository<CenterAccreditation, Long> {
    List<CenterAccreditation> findByTrainingCenterId(Long trainingCenterId);
    Optional<CenterAccreditation> findByAccreditationNumberIgnoreCase(String accreditationNumber);
    List<CenterAccreditation> findByEndDateBeforeAndArchivedFalse(LocalDate date);

    long countByArchivedFalse();
    long countByArchivedTrue();
    long countByEndDateBetweenAndArchivedFalse(LocalDate from, LocalDate to);
    long countByRequestStatusAndArchivedFalse(com.b12.domain.enums.AccreditationRequestStatus status);

    List<CenterAccreditation> findByStartDateBetweenAndArchivedFalse(LocalDate from, LocalDate to);

    @Query("""
            SELECT ca FROM CenterAccreditation ca
            WHERE ca.requestStatus = com.b12.domain.enums.AccreditationRequestStatus.ACCEPTED
            AND ca.receivedDate IS NOT NULL
            AND ca.startDate IS NOT NULL
            AND ca.archived = false
            """)
    List<CenterAccreditation> findAcceptedWithProcessingDates();

    /** Agréments centre dont l'intervalle couvre une date donnée (statut ACCEPTED, archivage ignoré car historique). */
    @Query("""
            SELECT ca FROM CenterAccreditation ca
            WHERE ca.requestStatus = 'ACCEPTED'
            AND (ca.startDate IS NULL OR ca.startDate <= :date)
            AND (ca.endDate IS NULL OR ca.endDate >= :date)
            """)
    List<CenterAccreditation> findActiveAt(@Param("date") LocalDate date);
}
