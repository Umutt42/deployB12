package com.b12.service;

import com.b12.domain.*;
import com.b12.domain.enums.TrainingAccreditationType;
import com.b12.repository.*;
import com.b12.security.SecurityUtils;
import com.b12.web.dto.TrainingAccreditationDtos;
import com.b12.web.dto.TrainingAccreditationMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TrainingAccreditationService {

    private final TrainingAccreditationRepository trainingAccreditationRepo;
    private final CenterAccreditationRepository centerAccreditationRepo;
    private final LicenseTypeRepository licenseTypeRepo;
    private final ThemeRepository themeRepo;
    private final SubThemeRepository subThemeRepo;
    private final TrainerRepository trainerRepo;
    private final SubModuleRepository subModuleRepo;

    // =========================
    // READ
    // =========================

    @Transactional(readOnly = true)
    public List<TrainingAccreditationDtos> findAll() {
        return trainingAccreditationRepo.findAllWithRelations()
                .stream().map(TrainingAccreditationMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public TrainingAccreditationDtos getDto(Long id) {
        TrainingAccreditation ta = trainingAccreditationRepo.findByIdWithRelations(id)
                .orElseThrow(() -> new IllegalArgumentException("Agrément formation introuvable : " + id));
        return TrainingAccreditationMapper.toDto(ta);
    }

    @Transactional(readOnly = true)
    public List<TrainingAccreditationDtos> findByCenterAccreditation(Long centerAccreditationId) {
        return trainingAccreditationRepo.findByCenterAccreditationId(centerAccreditationId)
                .stream().map(TrainingAccreditationMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<TrainingAccreditationDtos> findAllByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return trainingAccreditationRepo.findAllById(ids)
                .stream().map(TrainingAccreditationMapper::toDto).toList();
    }

    // =========================
    // CREATE
    // =========================

    @Transactional
    public TrainingAccreditationDtos createDto(TrainingAccreditationDtos dto) {
        TrainingAccreditation ta = buildFromDto(new TrainingAccreditation(), dto);
        ta.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        ta = trainingAccreditationRepo.save(ta);
        return TrainingAccreditationMapper.toDto(ta);
    }

    // =========================
    // UPDATE
    // =========================

    @Transactional
    public TrainingAccreditationDtos updateDto(Long id, TrainingAccreditationDtos dto) {
        TrainingAccreditation ta = trainingAccreditationRepo.findByIdWithRelations(id)
                .orElseThrow(() -> new IllegalArgumentException("Agrément formation introuvable : " + id));
        buildFromDto(ta, dto);
        ta.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        ta = trainingAccreditationRepo.save(ta);
        return TrainingAccreditationMapper.toDto(ta);
    }

    // =========================
    // ARCHIVE
    // =========================

    @Transactional
    public TrainingAccreditationDtos archiveDto(Long id, boolean archived) {
        TrainingAccreditation ta = trainingAccreditationRepo.findByIdWithRelations(id)
                .orElseThrow(() -> new IllegalArgumentException("Agrément formation introuvable : " + id));
        ta.setArchived(archived);
        ta.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        ta = trainingAccreditationRepo.save(ta);
        return TrainingAccreditationMapper.toDto(ta);
    }

    // =========================
    // DELETE
    // =========================

    @Transactional
    public void delete(Long id) {
        TrainingAccreditation ta = trainingAccreditationRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Agrément formation introuvable : " + id));
        trainingAccreditationRepo.delete(ta);
    }

    // =========================
    // PRIVATE HELPERS
    // =========================

    private TrainingAccreditation buildFromDto(TrainingAccreditation ta, TrainingAccreditationDtos dto) {
        // Type
        TrainingAccreditationType type = dto.getType() != null ? dto.getType() : TrainingAccreditationType.COMPLETE;
        ta.setType(type);

        if (type == TrainingAccreditationType.SUB_MODULES) {
            // ── Mode SOUS-MODULES ──────────────────────────────────────
            ta.setCenterAccreditation(null);

            // Validation : minimum 2 sous-modules
            Set<Long> smIds = dto.getSubModuleIds();
            if (smIds == null || smIds.size() < 2) {
                throw new IllegalArgumentException(
                        "Un agrément de type sous-modules doit contenir au minimum 2 sous-modules.");
            }
            Set<SubModule> subModules = new HashSet<>();
            subModuleRepo.findAllById(smIds).forEach(subModules::add);
            if (subModules.size() < 2) {
                throw new IllegalArgumentException(
                        "Au moins 2 sous-modules valides sont requis.");
            }
            ta.setSubModules(subModules);

            // Pré-calcul des champs numériques depuis les sous-modules
            // (seulement si le DTO ne les fournit pas explicitement)
            if (dto.getDurationHours() == null) {
                ta.setDurationHours(subModules.stream()
                        .filter(sm -> sm.getDurationHours() != null)
                        .mapToDouble(SubModule::getDurationHours).sum());
            } else {
                ta.setDurationHours(dto.getDurationHours());
            }
            if (dto.getPrice() == null) {
                ta.setPrice(subModules.stream()
                        .filter(sm -> sm.getPrice() != null)
                        .mapToDouble(SubModule::getPrice).sum());
            } else {
                ta.setPrice(dto.getPrice());
            }
            if (dto.getTrainingPoints() == null) {
                ta.setTrainingPoints(subModules.stream()
                        .filter(sm -> sm.getTrainingPoints() != null)
                        .mapToInt(SubModule::getTrainingPoints).sum());
            } else {
                ta.setTrainingPoints(dto.getTrainingPoints());
            }

            // Pré-remplissage des relations depuis les sous-modules
            // (le DTO peut les surcharger s'ils sont fournis)
            Set<LicenseType> licenseTypes = new HashSet<>();
            Set<Theme> themes = new HashSet<>();
            Set<SubTheme> subThemes = new HashSet<>();
            Set<Trainer> trainers = new HashSet<>();
            subModules.forEach(sm -> {
                licenseTypes.addAll(sm.getLicenseTypes());
                themes.addAll(sm.getThemes());
                subThemes.addAll(sm.getSubThemes());
                trainers.addAll(sm.getTrainers());
            });
            // Surcharge si le DTO fournit des IDs explicites
            if (dto.getLicenseTypeIds() != null && !dto.getLicenseTypeIds().isEmpty()) {
                licenseTypes.clear();
                licenseTypeRepo.findAllById(dto.getLicenseTypeIds()).forEach(licenseTypes::add);
            }
            if (dto.getThemeIds() != null && !dto.getThemeIds().isEmpty()) {
                themes.clear();
                themeRepo.findAllById(dto.getThemeIds()).forEach(themes::add);
            }
            if (dto.getSubThemeIds() != null && !dto.getSubThemeIds().isEmpty()) {
                subThemes.clear();
                subThemeRepo.findAllById(dto.getSubThemeIds()).forEach(subThemes::add);
            }
            if (dto.getTrainerIds() != null && !dto.getTrainerIds().isEmpty()) {
                trainers.clear();
                trainerRepo.findAllById(dto.getTrainerIds()).forEach(trainers::add);
            }
            ta.setLicenseTypes(licenseTypes);
            ta.setThemes(themes);
            ta.setSubThemes(subThemes);
            ta.setTrainers(trainers);

            // Organismes partenaires
            Set<CenterAccreditation> partners = new HashSet<>();
            if (dto.getPartnerAccreditationIds() != null) {
                for (Long pid : dto.getPartnerAccreditationIds()) {
                    centerAccreditationRepo.findById(pid).ifPresent(partners::add);
                }
            }
            ta.setPartnerAccreditations(partners);

        } else {
            // ── Mode COMPLET ───────────────────────────────────────────
            ta.setSubModules(new HashSet<>());

            if (dto.getCenterAccreditationId() == null) {
                throw new IllegalArgumentException("L'identifiant d'agrément centre est requis.");
            }
            CenterAccreditation ca = centerAccreditationRepo.findById(dto.getCenterAccreditationId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Agrément centre introuvable : " + dto.getCenterAccreditationId()));

            if (ca.getEndDate() != null && dto.getStartDate() != null
                    && !dto.getStartDate().isBefore(ca.getEndDate())) {
                throw new IllegalArgumentException(
                        "La date de début de l'agrément formation (" + dto.getStartDate()
                        + ") doit être antérieure à la date de fin de l'agrément centre (" + ca.getEndDate() + ").");
            }
            ta.setCenterAccreditation(ca);

            // Organismes partenaires
            Set<CenterAccreditation> partners = new HashSet<>();
            if (dto.getPartnerAccreditationIds() != null) {
                for (Long pid : dto.getPartnerAccreditationIds()) {
                    centerAccreditationRepo.findById(pid).ifPresent(partners::add);
                }
            }
            ta.setPartnerAccreditations(partners);

            // Relations standard
            Set<LicenseType> licenseTypes = new HashSet<>();
            if (dto.getLicenseTypeIds() != null) {
                licenseTypeRepo.findAllById(dto.getLicenseTypeIds()).forEach(licenseTypes::add);
            }
            ta.setLicenseTypes(licenseTypes);

            Set<Theme> themes = new HashSet<>();
            if (dto.getThemeIds() != null) {
                themeRepo.findAllById(dto.getThemeIds()).forEach(themes::add);
            }
            ta.setThemes(themes);

            Set<SubTheme> subThemes = new HashSet<>();
            if (dto.getSubThemeIds() != null) {
                subThemeRepo.findAllById(dto.getSubThemeIds()).forEach(subThemes::add);
            }
            ta.setSubThemes(subThemes);

            Set<Trainer> trainers = new HashSet<>();
            if (dto.getTrainerIds() != null) {
                trainerRepo.findAllById(dto.getTrainerIds()).forEach(trainers::add);
            }
            ta.setTrainers(trainers);

            ta.setDurationHours(dto.getDurationHours());
            ta.setPrice(dto.getPrice());
            ta.setTrainingPoints(dto.getTrainingPoints());
        }

        // Champs communs aux deux types
        ta.setTitle(normalizeRequired(dto.getTitle(), "title"));
        ta.setReceivedDate(dto.getReceivedDate());
        ta.setRequestStatus(dto.getRequestStatus());
        ta.setAccreditationNumber(normalizeOptional(dto.getAccreditationNumber()));
        ta.setStartDate(dto.getStartDate());
        ta.setEndDate(dto.getEndDate());
        ta.setInitial(dto.isInitial());
        ta.setContinuous(dto.isContinuous());
        ta.setSubsidized(dto.isSubsidized());
        ta.setComment(normalizeOptional(dto.getComment()));
        ta.setPublicCible(normalizeOptional(dto.getPublicCible()));
        ta.setArchived(dto.isArchived());

        return ta;
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
