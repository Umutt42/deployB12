package com.b12.web.dto;

import com.b12.domain.*;

import java.util.Set;
import java.util.stream.Collectors;

public final class SubModuleMapper {

    private SubModuleMapper() {}

    public static SubModuleDtos toDto(SubModule sm) {
        if (sm == null) return null;

        SubModuleDtos dto = new SubModuleDtos();
        dto.setId(sm.getId());

        // Agrément centre principal
        CenterAccreditation ca = sm.getCenterAccreditation();
        dto.setCenterAccreditationId(ca.getId());
        dto.setCenterAccreditationLabel(buildCenterLabel(ca));
        dto.setTrainingCenterLabel(ca.getTrainingCenter() != null ? ca.getTrainingCenter().getName() : null);

        // Organismes partenaires
        Set<CenterAccreditation> partners = sm.getPartnerAccreditations();
        dto.setPartnerAccreditationIds(
                partners.stream().map(CenterAccreditation::getId).collect(Collectors.toSet())
        );
        dto.setPartnerAccreditationLabels(
                partners.stream().map(SubModuleMapper::buildCenterLabel).collect(Collectors.toSet())
        );

        // Secteurs & centres pilotes
        TrainingCenter tc = ca.getTrainingCenter();
        if (tc != null) {
            dto.setSectorLabels(tc.getSectors().stream().map(Sector::getName).collect(Collectors.toSet()));
            dto.setPilotCenterLabels(tc.getPilotCenters().stream().map(PilotCenter::getName).collect(Collectors.toSet()));
        }

        // Champs principaux
        dto.setTitle(sm.getTitle());
        dto.setDurationHours(sm.getDurationHours());
        dto.setPrice(sm.getPrice());
        dto.setTrainingPoints(sm.getTrainingPoints());
        dto.setReceivedDate(sm.getReceivedDate());
        dto.setRequestStatus(sm.getRequestStatus());
        dto.setAccreditationNumber(sm.getAccreditationNumber());
        dto.setStartDate(sm.getStartDate());
        dto.setEndDate(sm.getEndDate());
        dto.setInitial(sm.isInitial());
        dto.setContinuous(sm.isContinuous());
        dto.setSubsidized(sm.isSubsidized());
        dto.setComment(sm.getComment());
        dto.setPublicCible(sm.getPublicCible());
        dto.setArchived(sm.isArchived());

        // Types de phytolicences
        dto.setLicenseTypeIds(
                sm.getLicenseTypes().stream().map(LicenseType::getId).collect(Collectors.toSet())
        );
        dto.setLicenseTypeLabels(
                sm.getLicenseTypes().stream().map(LicenseType::getLabel).collect(Collectors.toSet())
        );

        // Thématiques
        dto.setThemeIds(
                sm.getThemes().stream().map(Theme::getId).collect(Collectors.toSet())
        );
        dto.setThemeLabels(
                sm.getThemes().stream().map(Theme::getLabel).collect(Collectors.toSet())
        );

        // Sous-thèmes
        dto.setSubThemeIds(
                sm.getSubThemes().stream().map(SubTheme::getId).collect(Collectors.toSet())
        );
        dto.setSubThemeLabels(
                sm.getSubThemes().stream().map(SubTheme::getLabel).collect(Collectors.toSet())
        );

        // Formateurs
        dto.setTrainerIds(
                sm.getTrainers().stream().map(Trainer::getId).collect(Collectors.toSet())
        );
        dto.setTrainerLabels(
                sm.getTrainers().stream()
                        .map(t -> t.getFirstName() + " " + t.getLastName())
                        .collect(Collectors.toSet())
        );

        // Audit
        dto.setCreatedAt(sm.getCreatedAt());
        dto.setUpdatedAt(sm.getUpdatedAt());
        dto.setUpdatedBy(sm.getUpdatedBy());
        dto.setCreatedBy(sm.getCreatedBy());

        return dto;
    }

    static String buildCenterLabel(CenterAccreditation ca) {
        if (ca == null) return null;
        String num = ca.getAccreditationNumber() != null ? ca.getAccreditationNumber() : "#" + ca.getId();
        String center = ca.getTrainingCenter() != null ? ca.getTrainingCenter().getName() : "";
        return num + (center.isBlank() ? "" : " — " + center);
    }
}
