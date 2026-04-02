package com.b12.repository;

import com.b12.domain.Sector;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SectorRepository extends JpaRepository<Sector, Long> {
    long countByArchivedFalse();
    Optional<Sector> findByNameIgnoreCase(String name);
}
