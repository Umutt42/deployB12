package com.b12.repository;

import com.b12.domain.PilotCenter;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PilotCenterRepository extends JpaRepository<PilotCenter, Long> {
    long countByArchivedFalse();
    Optional<PilotCenter> findByNameIgnoreCase(String name);
}
