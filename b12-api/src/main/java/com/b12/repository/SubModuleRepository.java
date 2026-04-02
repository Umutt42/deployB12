package com.b12.repository;

import com.b12.domain.SubModule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SubModuleRepository extends JpaRepository<SubModule, Long> {

    Optional<SubModule> findByAccreditationNumberIgnoreCase(String accreditationNumber);

    long countByArchivedFalse();
    long countByArchivedTrue();

    @Query("""
            SELECT DISTINCT sm FROM SubModule sm
            LEFT JOIN FETCH sm.centerAccreditation ca
            LEFT JOIN FETCH ca.trainingCenter
            WHERE sm.archived = false
            """)
    List<SubModule> findAllActiveWithRelations();

    @Query("""
            SELECT DISTINCT sm FROM SubModule sm
            LEFT JOIN FETCH sm.centerAccreditation ca
            LEFT JOIN FETCH ca.trainingCenter
            """)
    List<SubModule> findAllWithRelations();

    @Query("""
            SELECT sm FROM SubModule sm
            LEFT JOIN FETCH sm.centerAccreditation ca
            LEFT JOIN FETCH ca.trainingCenter
            LEFT JOIN FETCH sm.partnerAccreditations
            LEFT JOIN FETCH sm.licenseTypes
            LEFT JOIN FETCH sm.themes
            LEFT JOIN FETCH sm.subThemes
            LEFT JOIN FETCH sm.trainers
            WHERE sm.id = :id
            """)
    Optional<SubModule> findByIdWithRelations(@Param("id") Long id);

    @Query("""
            SELECT sm FROM SubModule sm
            LEFT JOIN FETCH sm.centerAccreditation ca
            LEFT JOIN FETCH ca.trainingCenter
            WHERE ca.id = :centerAccreditationId
            """)
    List<SubModule> findByCenterAccreditationId(@Param("centerAccreditationId") Long centerAccreditationId);
}
