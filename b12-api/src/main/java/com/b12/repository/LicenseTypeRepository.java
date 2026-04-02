package com.b12.repository;

import com.b12.domain.LicenseType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LicenseTypeRepository extends JpaRepository<LicenseType, Long> {
    long countByArchivedFalse();
    Optional<LicenseType> findByCodeIgnoreCase(String code);
    boolean existsByCodeIgnoreCase(String code);
}
