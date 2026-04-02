package com.b12.repository;

import com.b12.domain.Organism;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrganismRepository extends JpaRepository<Organism, Long> {
    long countByArchivedFalse();
    Optional<Organism> findByNameIgnoreCase(String name);
}
