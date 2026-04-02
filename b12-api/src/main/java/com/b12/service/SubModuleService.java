package com.b12.service;

import com.b12.domain.*;
import com.b12.repository.*;
import com.b12.security.SecurityUtils;
import com.b12.web.dto.SubModuleDtos;
import com.b12.web.dto.SubModuleMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SubModuleService {

    private final SubModuleRepository subModuleRepo;
    private final CenterAccreditationRepository centerAccreditationRepo;
    private final LicenseTypeRepository licenseTypeRepo;
    private final ThemeRepository themeRepo;
    private final SubThemeRepository subThemeRepo;
    private final TrainerRepository trainerRepo;

    // =========================
    // READ
    // =========================

    @Transactional(readOnly = true)
    public List<SubModuleDtos> findAll() {
        return subModuleRepo.findAllWithRelations()
                .stream().map(SubModuleMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public SubModuleDtos getDto(Long id) {
        SubModule sm = subModuleRepo.findByIdWithRelations(id)
                .orElseThrow(() -> new IllegalArgumentException("Sous-module introuvable : " + id));
        return SubModuleMapper.toDto(sm);
    }

    @Transactional(readOnly = true)
    public List<SubModuleDtos> findByCenterAccreditation(Long centerAccreditationId) {
        return subModuleRepo.findByCenterAccreditationId(centerAccreditationId)
                .stream().map(SubModuleMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<SubModuleDtos> findAllByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return subModuleRepo.findAllById(ids)
                .stream().map(SubModuleMapper::toDto).toList();
    }

    // =========================
    // CREATE
    // =========================

    @Transactional
    public SubModuleDtos createDto(SubModuleDtos dto) {
        SubModule sm = buildFromDto(new SubModule(), dto);
        sm.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        sm = subModuleRepo.save(sm);
        return SubModuleMapper.toDto(sm);
    }

    // =========================
    // UPDATE
    // =========================

    @Transactional
    public SubModuleDtos updateDto(Long id, SubModuleDtos dto) {
        SubModule sm = subModuleRepo.findByIdWithRelations(id)
                .orElseThrow(() -> new IllegalArgumentException("Sous-module introuvable : " + id));
        buildFromDto(sm, dto);
        sm.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        sm = subModuleRepo.save(sm);
        return SubModuleMapper.toDto(sm);
    }

    // =========================
    // ARCHIVE
    // =========================

    @Transactional
    public SubModuleDtos archiveDto(Long id, boolean archived) {
        SubModule sm = subModuleRepo.findByIdWithRelations(id)
                .orElseThrow(() -> new IllegalArgumentException("Sous-module introuvable : " + id));
        sm.setArchived(archived);
        sm.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        sm = subModuleRepo.save(sm);
        return SubModuleMapper.toDto(sm);
    }

    // =========================
    // DELETE
    // =========================

    @Transactional
    public void delete(Long id) {
        SubModule sm = subModuleRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Sous-module introuvable : " + id));
        subModuleRepo.delete(sm);
    }

    // =========================
    // PRIVATE HELPERS
    // =========================

    private SubModule buildFromDto(SubModule sm, SubModuleDtos dto) {
        // Agrément centre principal
        if (dto.getCenterAccreditationId() == null) {
            throw new IllegalArgumentException("L'identifiant d'agrément centre est requis.");
        }
        CenterAccreditation ca = centerAccreditationRepo.findById(dto.getCenterAccreditationId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Agrément centre introuvable : " + dto.getCenterAccreditationId()));

        if (ca.getEndDate() != null && dto.getStartDate() != null
                && !dto.getStartDate().isBefore(ca.getEndDate())) {
            throw new IllegalArgumentException(
                    "La date de début du sous-module (" + dto.getStartDate()
                    + ") doit être antérieure à la date de fin de l'agrément centre (" + ca.getEndDate() + ").");
        }

        sm.setCenterAccreditation(ca);

        // Organismes partenaires
        Set<CenterAccreditation> partners = new HashSet<>();
        if (dto.getPartnerAccreditationIds() != null) {
            for (Long pid : dto.getPartnerAccreditationIds()) {
                centerAccreditationRepo.findById(pid).ifPresent(partners::add);
            }
        }
        sm.setPartnerAccreditations(partners);

        // Champs principaux
        sm.setTitle(normalizeRequired(dto.getTitle(), "title"));
        sm.setDurationHours(dto.getDurationHours());
        sm.setPrice(dto.getPrice());
        sm.setTrainingPoints(dto.getTrainingPoints());
        sm.setReceivedDate(dto.getReceivedDate());
        sm.setRequestStatus(dto.getRequestStatus());
        sm.setAccreditationNumber(normalizeOptional(dto.getAccreditationNumber()));
        sm.setStartDate(dto.getStartDate());
        sm.setEndDate(dto.getEndDate());
        sm.setInitial(dto.isInitial());
        sm.setContinuous(dto.isContinuous());
        sm.setSubsidized(dto.isSubsidized());
        sm.setComment(normalizeOptional(dto.getComment()));
        sm.setPublicCible(normalizeOptional(dto.getPublicCible()));
        sm.setArchived(dto.isArchived());

        // Types de phytolicences
        Set<LicenseType> licenseTypes = new HashSet<>();
        if (dto.getLicenseTypeIds() != null) {
            licenseTypeRepo.findAllById(dto.getLicenseTypeIds()).forEach(licenseTypes::add);
        }
        sm.setLicenseTypes(licenseTypes);

        // Thématiques
        Set<Theme> themes = new HashSet<>();
        if (dto.getThemeIds() != null) {
            themeRepo.findAllById(dto.getThemeIds()).forEach(themes::add);
        }
        sm.setThemes(themes);

        // Sous-thèmes
        Set<SubTheme> subThemes = new HashSet<>();
        if (dto.getSubThemeIds() != null) {
            subThemeRepo.findAllById(dto.getSubThemeIds()).forEach(subThemes::add);
        }
        sm.setSubThemes(subThemes);

        // Formateurs
        Set<Trainer> trainers = new HashSet<>();
        if (dto.getTrainerIds() != null) {
            trainerRepo.findAllById(dto.getTrainerIds()).forEach(trainers::add);
        }
        sm.setTrainers(trainers);

        return sm;
    }

    private String normalizeOptional(String s) {
        if (s == null) return null;
        String v = s.trim();
        return v.isEmpty() ? null : v;
    }

    private String normalizeRequired(String s, String field) {
        String v = normalizeOptional(s);
        if (v == null) throw new IllegalArgumentException("Le champ " + field + " est requis.");
        return v;
    }
}
