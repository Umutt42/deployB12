package com.b12.repository;

import com.b12.domain.TrainingCenter;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TrainingCenterRepository extends JpaRepository<TrainingCenter, Long> {
    Optional<TrainingCenter> findByNameIgnoreCase(String name);
    Optional<TrainingCenter> findByCompanyNumberIgnoreCase(String companyNumber);
    long countByArchivedFalse();
}
