package com.b12.repository;

import com.b12.domain.TrainingActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TrainingActivityRepository extends JpaRepository<TrainingActivity, Long> {

    @Query("""
            SELECT a FROM TrainingActivity a
            LEFT JOIN FETCH a.trainingAccreditation ta
            LEFT JOIN FETCH ta.centerAccreditation ca
            LEFT JOIN FETCH ca.trainingCenter
            WHERE a.trainingAccreditation.id = :id
            """)
    List<TrainingActivity> findByTrainingAccreditationId(@Param("id") Long trainingAccreditationId);

    @Query("""
            SELECT a FROM TrainingActivity a
            LEFT JOIN FETCH a.trainingAccreditation ta
            LEFT JOIN FETCH ta.centerAccreditation ca
            LEFT JOIN FETCH ca.trainingCenter
            WHERE a.archived = false
            """)
    List<TrainingActivity> findByArchivedFalse();

    @Query("""
            SELECT a FROM TrainingActivity a
            LEFT JOIN FETCH a.trainingAccreditation
            WHERE a.id = :id
            """)
    Optional<TrainingActivity> findByIdWithAccreditation(@Param("id") Long id);

    long countByArchivedFalse();

    @Query("SELECT a.province, COUNT(a) FROM TrainingActivity a WHERE a.archived = false AND a.province IS NOT NULL AND a.province <> '' GROUP BY a.province ORDER BY COUNT(a) DESC")
    List<Object[]> countByProvince();

    @Query("""
            SELECT lt.label, COUNT(a)
            FROM TrainingActivity a
            JOIN a.trainingAccreditation ta
            JOIN ta.licenseTypes lt
            WHERE a.archived = false
            GROUP BY lt.id, lt.label
            ORDER BY COUNT(a) DESC
            """)
    List<Object[]> countByLicenseType();

    @Query("""
            SELECT th.label, COUNT(a)
            FROM TrainingActivity a
            JOIN a.trainingAccreditation ta
            JOIN ta.themes th
            WHERE a.archived = false
            GROUP BY th.id, th.label
            ORDER BY COUNT(a) DESC
            """)
    List<Object[]> countByTheme();

    @Query("""
            SELECT CONCAT(t.firstName, ' ', t.lastName), COUNT(a)
            FROM TrainingActivity a
            JOIN a.trainingAccreditation ta
            JOIN ta.trainers t
            WHERE a.archived = false AND t.archived = false
            GROUP BY t.id, t.firstName, t.lastName
            ORDER BY COUNT(a) DESC
            """)
    List<Object[]> countByTrainer();

    @Query("""
            SELECT s.name, COUNT(DISTINCT a.id)
            FROM TrainingActivity a
            JOIN a.trainingAccreditation ta
            JOIN ta.centerAccreditation ca
            JOIN ca.trainingCenter tc
            JOIN tc.sectors s
            WHERE a.archived = false
            GROUP BY s.id, s.name
            ORDER BY COUNT(DISTINCT a.id) DESC
            """)
    List<Object[]> countBySector();

    long countByStartDateBetweenAndArchivedFalse(java.time.LocalDate from, java.time.LocalDate to);

    @Query("""
            SELECT a FROM TrainingActivity a
            LEFT JOIN FETCH a.trainingAccreditation ta
            LEFT JOIN FETCH ta.centerAccreditation ca
            LEFT JOIN FETCH ca.trainingCenter
            WHERE a.startDate BETWEEN :from AND :to
            AND a.archived = false
            """)
    List<TrainingActivity> findByStartDateBetweenAndArchivedFalse(
            @Param("from") java.time.LocalDate from,
            @Param("to") java.time.LocalDate to);
}
