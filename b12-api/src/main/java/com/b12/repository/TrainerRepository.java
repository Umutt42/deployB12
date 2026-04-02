package com.b12.repository;

import com.b12.domain.Trainer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TrainerRepository extends JpaRepository<Trainer, Long> {

    @Query("""
            SELECT t FROM Trainer t
            LEFT JOIN FETCH t.trainingAccreditation ta
            LEFT JOIN FETCH ta.centerAccreditation ca
            LEFT JOIN FETCH ca.trainingCenter
            LEFT JOIN FETCH t.partnerOrganisms
            WHERE t.archived = false
            """)
    List<Trainer> findByArchivedFalseWithRelations();

    @Query("""
            SELECT t FROM Trainer t
            LEFT JOIN FETCH t.trainingAccreditation ta
            LEFT JOIN FETCH ta.centerAccreditation ca
            LEFT JOIN FETCH ca.trainingCenter
            LEFT JOIN FETCH t.partnerOrganisms
            WHERE t.id = :id
            """)
    Optional<Trainer> findByIdWithRelations(@Param("id") Long id);

    List<Trainer> findByArchivedFalse();
    long countByArchivedFalse();
    Optional<Trainer> findByEmailIgnoreCase(String email);

    @Query("""
            SELECT t FROM Trainer t
            LEFT JOIN FETCH t.trainingAccreditation ta
            LEFT JOIN FETCH ta.centerAccreditation ca
            LEFT JOIN FETCH ca.trainingCenter
            LEFT JOIN FETCH t.partnerOrganisms
            """)
    List<Trainer> findAllWithRelations();

    @Query("""
            SELECT DISTINCT tr FROM TrainingAccreditation ta
            JOIN ta.trainers tr
            WHERE ta.centerAccreditation.id = :centerAccreditationId
            AND tr.archived = false
            """)
    List<Trainer> findByCenterAccreditationId(@Param("centerAccreditationId") Long centerAccreditationId);
}
