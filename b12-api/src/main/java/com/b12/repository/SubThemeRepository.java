package com.b12.repository;

import com.b12.domain.SubTheme;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SubThemeRepository extends JpaRepository<SubTheme, Long> {
    List<SubTheme> findByThemeIdOrderByLabelAsc(Long themeId);
    Optional<SubTheme> findByThemeIdAndLabelIgnoreCase(Long themeId, String label);
}
