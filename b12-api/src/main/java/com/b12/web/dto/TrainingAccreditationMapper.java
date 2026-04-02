package com.b12.web.dto;

import com.b12.domain.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public final class TrainingAccreditationMapper {

    private TrainingAccreditationMapper() {}

    public static TrainingAccreditationDtos toDto(TrainingAccreditation a) {
        if (a == null) return null;

        TrainingAccreditationDtos dto = new TrainingAccreditationDtos();
        dto.setId(a.getId());
        dto.setType(a.getType());

        // Agrément centre principal (null si type = SUB_MODULES)
        CenterAccreditation ca = a.getCenterAccreditation();
        if (ca != null) {
            dto.setCenterAccreditationId(ca.getId());
            dto.setCenterAccreditationLabel(buildCenterLabel(ca));
            TrainingCenter tc = ca.getTrainingCenter();
            if (tc != null) {
                dto.setSectorLabels(tc.getSectors().stream().map(Sector::getName).collect(Collectors.toSet()));
                dto.setPilotCenterLabels(tc.getPilotCenters().stream().map(PilotCenter::getName).collect(Collectors.toSet()));
            }
        }

        // Organismes partenaires
        Set<CenterAccreditation> partners = a.getPartnerAccreditations();
        dto.setPartnerAccreditationIds(
                partners.stream().map(CenterAccreditation::getId).collect(Collectors.toSet())
        );
        dto.setPartnerAccreditationLabels(
                partners.stream().map(TrainingAccreditationMapper::buildCenterLabel).collect(Collectors.toSet())
        );

        // Sous-modules
        dto.setSubModuleIds(
                a.getSubModules().stream().map(com.b12.domain.SubModule::getId).collect(Collectors.toSet())
        );
        dto.setSubModuleLabels(
                a.getSubModules().stream().map(com.b12.domain.SubModule::getTitle).collect(Collectors.toSet())
        );
        Map<Long, String> centerMap = new LinkedHashMap<>();
        for (com.b12.domain.SubModule sm : a.getSubModules()) {
            CenterAccreditation smCa = sm.getCenterAccreditation();
            if (smCa != null && smCa.getTrainingCenter() != null) {
                String name = smCa.getTrainingCenter().getName();
                if (name != null && !name.isBlank()) {
                    centerMap.putIfAbsent(smCa.getId(), name);
                }
            }
        }
        dto.setSubModuleCenterIds(new ArrayList<>(centerMap.keySet()));
        dto.setSubModuleCenterLabels(new ArrayList<>(centerMap.values()));

        // Champs principaux
        dto.setTitle(a.getTitle());
        dto.setDurationHours(a.getDurationHours());
        dto.setPrice(a.getPrice());
        dto.setTrainingPoints(a.getTrainingPoints());
        dto.setReceivedDate(a.getReceivedDate());
        dto.setRequestStatus(a.getRequestStatus());
        dto.setAccreditationNumber(a.getAccreditationNumber());
        dto.setStartDate(a.getStartDate());
        dto.setEndDate(a.getEndDate());
        dto.setInitial(a.isInitial());
        dto.setContinuous(a.isContinuous());
        dto.setSubsidized(a.isSubsidized());
        dto.setComment(a.getComment());
        dto.setPublicCible(a.getPublicCible());
        dto.setArchived(a.isArchived());

        // Types de phytolicences
        dto.setLicenseTypeIds(
                a.getLicenseTypes().stream().map(LicenseType::getId).collect(Collectors.toSet())
        );
        dto.setLicenseTypeLabels(
                a.getLicenseTypes().stream().map(LicenseType::getLabel).collect(Collectors.toSet())
        );

        // Thématiques
        dto.setThemeIds(
                a.getThemes().stream().map(Theme::getId).collect(Collectors.toSet())
        );
        dto.setThemeLabels(
                a.getThemes().stream().map(Theme::getLabel).collect(Collectors.toSet())
        );

        // Sous-thèmes
        dto.setSubThemeIds(
                a.getSubThemes().stream().map(SubTheme::getId).collect(Collectors.toSet())
        );
        dto.setSubThemeLabels(
                a.getSubThemes().stream().map(SubTheme::getLabel).collect(Collectors.toSet())
        );

        // Formateurs
        dto.setTrainerIds(
                a.getTrainers().stream().map(Trainer::getId).collect(Collectors.toSet())
        );
        dto.setTrainerLabels(
                a.getTrainers().stream()
                        .map(t -> t.getFirstName() + " " + t.getLastName())
                        .collect(Collectors.toSet())
        );

        // Audit
        dto.setCreatedAt(a.getCreatedAt());
        dto.setUpdatedAt(a.getUpdatedAt());
        dto.setUpdatedBy(a.getUpdatedBy());
        dto.setCreatedBy(a.getCreatedBy());

        return dto;
    }

    private static String buildCenterLabel(CenterAccreditation ca) {
        if (ca == null) return null;
        String num = ca.getAccreditationNumber() != null ? ca.getAccreditationNumber() : "#" + ca.getId();
        String center = ca.getTrainingCenter() != null ? ca.getTrainingCenter().getName() : "";
        return num + (center.isBlank() ? "" : " — " + center);
    }
}
