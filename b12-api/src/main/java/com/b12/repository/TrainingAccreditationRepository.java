package com.b12.repository;

import com.b12.domain.Trainer;
import com.b12.domain.TrainingAccreditation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TrainingAccreditationRepository extends JpaRepository<TrainingAccreditation, Long> {

    @Query("""
            SELECT DISTINCT ta FROM TrainingAccreditation ta
            LEFT JOIN FETCH ta.centerAccreditation ca
            LEFT JOIN FETCH ca.trainingCenter
            LEFT JOIN FETCH ta.subModules sm
            LEFT JOIN FETCH sm.centerAccreditation smCa
            LEFT JOIN FETCH smCa.trainingCenter
            WHERE ca.id = :centerAccreditationId
            """)
    List<TrainingAccreditation> findByCenterAccreditationId(@Param("centerAccreditationId") Long centerAccreditationId);
    Optional<TrainingAccreditation> findByAccreditationNumberIgnoreCase(String accreditationNumber);

    long countByArchivedFalse();
    long countByArchivedTrue();
    long countByRequestStatusAndArchivedFalse(com.b12.domain.enums.AccreditationRequestStatus status);
    long countByEndDateBetweenAndArchivedFalse(LocalDate from, LocalDate to);

    @Query("""
            SELECT DISTINCT ta FROM TrainingAccreditation ta
            LEFT JOIN FETCH ta.centerAccreditation ca
            LEFT JOIN FETCH ca.trainingCenter tc
            LEFT JOIN FETCH ta.subModules sm
            LEFT JOIN FETCH sm.centerAccreditation smCa
            LEFT JOIN FETCH smCa.trainingCenter
            WHERE ta.archived = false
            """)
    List<TrainingAccreditation> findAllActiveWithRelations();

    @Query("""
            SELECT DISTINCT ta FROM TrainingAccreditation ta
            LEFT JOIN FETCH ta.centerAccreditation ca
            LEFT JOIN FETCH ca.trainingCenter tc
            LEFT JOIN FETCH ta.subModules sm
            LEFT JOIN FETCH sm.centerAccreditation smCa
            LEFT JOIN FETCH smCa.trainingCenter
            """)
    List<TrainingAccreditation> findAllWithRelations();

    @Query("""
            SELECT ta FROM TrainingAccreditation ta
            LEFT JOIN FETCH ta.centerAccreditation ca
            LEFT JOIN FETCH ca.trainingCenter tc
            LEFT JOIN FETCH ta.partnerAccreditations
            LEFT JOIN FETCH ta.licenseTypes
            LEFT JOIN FETCH ta.themes
            LEFT JOIN FETCH ta.subThemes
            LEFT JOIN FETCH ta.trainers
            LEFT JOIN FETCH ta.subModules sm
            LEFT JOIN FETCH sm.centerAccreditation smCa
            LEFT JOIN FETCH smCa.trainingCenter
            WHERE ta.id = :id
            """)
    java.util.Optional<TrainingAccreditation> findByIdWithRelations(@Param("id") Long id);

    /** Reverse-lookup formateur + centre de formation associé. */
    @Query("""
            SELECT ta FROM TrainingAccreditation ta
            LEFT JOIN FETCH ta.trainers
            LEFT JOIN FETCH ta.centerAccreditation ca
            LEFT JOIN FETCH ca.trainingCenter
            """)
    List<TrainingAccreditation> findAllWithTrainers();

    /** Agréments liés à un formateur via ManyToMany (pour le détail). */
    @Query("""
            SELECT ta FROM TrainingAccreditation ta
            LEFT JOIN FETCH ta.centerAccreditation ca
            LEFT JOIN FETCH ca.trainingCenter
            WHERE :trainer MEMBER OF ta.trainers
            """)
    List<TrainingAccreditation> findByTrainer(@Param("trainer") Trainer trainer);

    /** Agréments COMPLETE par centre de formation. */
    @Query("""
            SELECT tc.name, COUNT(ta)
            FROM TrainingAccreditation ta
            JOIN ta.centerAccreditation ca
            JOIN ca.trainingCenter tc
            WHERE ta.archived = false
            AND ta.type = com.b12.domain.enums.TrainingAccreditationType.COMPLETE
            GROUP BY tc.id, tc.name
            ORDER BY COUNT(ta) DESC
            """)
    List<Object[]> countByTrainingCenter();

    /** Agréments SUB_MODULES par centre de formation (via les sous-modules liés). */
    @Query("""
            SELECT tc.name, COUNT(DISTINCT ta)
            FROM TrainingAccreditation ta
            JOIN ta.subModules sm
            JOIN sm.centerAccreditation smCa
            JOIN smCa.trainingCenter tc
            WHERE ta.archived = false
            GROUP BY tc.id, tc.name
            ORDER BY COUNT(DISTINCT ta) DESC
            """)
    List<Object[]> countSubModulesByTrainingCenter();

    List<TrainingAccreditation> findByStartDateBetweenAndArchivedFalse(LocalDate from, LocalDate to);

    @Query("""
            SELECT ta FROM TrainingAccreditation ta
            WHERE ta.requestStatus = com.b12.domain.enums.AccreditationRequestStatus.ACCEPTED
            AND ta.receivedDate IS NOT NULL
            AND ta.startDate IS NOT NULL
            AND ta.archived = false
            """)
    List<TrainingAccreditation> findAcceptedWithProcessingDates();

    /**
     * Retourne les TA éligibles pour une activité à une date donnée.
     * - Type COMPLETE : TA et CA tous deux actifs à cette date.
     * - Type SUB_MODULES : seule la validité de la TA elle-même est vérifiée
     *   (pas de CA principal — les centres sont portés par les sous-modules).
     */
    @Query("""
            SELECT ta FROM TrainingAccreditation ta
            LEFT JOIN FETCH ta.centerAccreditation ca
            LEFT JOIN FETCH ca.trainingCenter
            WHERE (ta.startDate IS NULL OR ta.startDate <= :date)
            AND (ta.endDate IS NULL OR ta.endDate >= :date)
            AND (
                ta.type = com.b12.domain.enums.TrainingAccreditationType.SUB_MODULES
                OR (
                    (ca.startDate IS NULL OR ca.startDate <= :date)
                    AND (ca.endDate IS NULL OR ca.endDate >= :date)
                )
            )
            """)
    List<TrainingAccreditation> findAllEligibleForActivity(@Param("date") LocalDate date);
}
