package com.b12.service;

import com.b12.domain.Theme;
import com.b12.repository.ThemeRepository;
import com.b12.security.SecurityUtils;
import com.b12.web.dto.ThemeDtos;
import com.b12.web.dto.ThemeMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ThemeService {

    private final ThemeRepository themeRepository;

    // =========================================================
    // CREATE
    // =========================================================
    public Theme create(ThemeDtos dto) {

        String label = normalize(dto.getName());

        themeRepository.findByLabelIgnoreCase(label).ifPresent(t -> {
            throw new IllegalArgumentException("Cette thématique existe déjà : " + label);
        });

        Theme theme = Theme.builder()
                .label(label)
                .description(dto.getDescription())
                .archived(false)
                .build();

        // ✅ audit
        theme.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());

        return themeRepository.save(theme);
    }

    // =========================================================
    // LIST
    // =========================================================
    @Transactional(readOnly = true)
    public List<ThemeDtos> findAll() {
        return themeRepository.findAllWithSubThemes()
                .stream()
                .map(ThemeMapper::toDto)
                .toList();
    }

    // =========================================================
    // GET ONE
    // =========================================================
    @Transactional(readOnly = true)
    public Theme get(Long id) {
        return themeRepository.findByIdWithSubThemes(id)
                .orElseThrow(() ->
                        new IllegalArgumentException("Thématique introuvable : " + id)
                );
    }

    // =========================================================
    // ARCHIVE / UNARCHIVE
    // =========================================================
    public Theme archive(Long id, boolean archived) {

        Theme theme = get(id);

        theme.setArchived(archived);

        // ✅ audit
        theme.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());

        return themeRepository.save(theme);
    }

    // =========================================================
    // UPDATE
    // =========================================================
    public Theme update(Long id, ThemeDtos dto) {

        Theme theme = get(id);

        String newLabel = normalize(dto.getName());

        // 🔒 vérification unicité si changement de label
        if (!theme.getLabel().equalsIgnoreCase(newLabel)) {
            themeRepository.findByLabelIgnoreCase(newLabel)
                    .ifPresent(existing -> {
                        throw new IllegalArgumentException(
                                "Cette thématique existe déjà : " + newLabel
                        );
                    });
            theme.setLabel(newLabel);
        }

        theme.setDescription(dto.getDescription());

        // ✅ audit
        theme.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());

        return themeRepository.save(theme);
    }

    // =========================================================
    // DELETE
    // =========================================================
    public void delete(Long id) {

        Theme theme = get(id);

        // 🔒 sécurité : empêcher suppression si sous-thèmes existent
        if (theme.getSubThemes() != null && !theme.getSubThemes().isEmpty()) {
            throw new IllegalArgumentException(
                    "Impossible de supprimer : la thématique possède des sous-thèmes."
            );
        }

        themeRepository.delete(theme);
    }

    // =========================================================
    // FIND BY IDS (export sélection)
    // =========================================================
    @Transactional(readOnly = true)
    public List<ThemeDtos> findAllByIds(List<Long> ids) {

        if (ids == null || ids.isEmpty()) {
            return List.of();
        }

        return themeRepository.findAllByIdWithSubThemes(ids)
                .stream()
                .map(ThemeMapper::toDto)
                .toList();
    }

    // =========================================================
    // UTILS
    // =========================================================
    private String normalize(String s) {

        if (s == null || s.trim().isEmpty()) {
            throw new IllegalArgumentException("Le nom de la thématique est requis.");
        }

        return s.trim();
    }
}
