package com.b12.web.dto;

import com.b12.domain.*;

import java.util.stream.Collectors;

public final class TrainingActivityMapper {

    private TrainingActivityMapper() {}

    public static TrainingActivityDtos toDto(TrainingActivity a) {
        if (a == null) return null;

        TrainingActivityDtos dto = new TrainingActivityDtos();
        dto.setId(a.getId());

        // Agrément formation lié
        TrainingAccreditation ta = a.getTrainingAccreditation();
        dto.setTrainingAccreditationId(ta.getId());
        dto.setTrainingAccreditationLabel(buildTaLabel(ta));

        // Agrément centre (via agrément formation)
        CenterAccreditation ca = ta.getCenterAccreditation();
        if (ca != null) {
            dto.setCenterAccreditationId(ca.getId());
            dto.setCenterAccreditationLabel(buildCaLabel(ca));
            TrainingCenter tc = ca.getTrainingCenter();
            if (tc != null) {
                dto.setPilotCenterLabels(tc.getPilotCenters().stream().map(PilotCenter::getName).collect(Collectors.toSet()));
                dto.setSectorLabels(tc.getSectors().stream().map(Sector::getName).collect(Collectors.toSet()));
            }
        }

        // Données issues de l'agrément formation
        dto.setInitial(ta.isInitial());
        dto.setContinuous(ta.isContinuous());
        dto.setDurationHours(ta.getDurationHours());
        dto.setThemeLabels(ta.getThemes().stream().map(Theme::getLabel).collect(Collectors.toSet()));
        dto.setSubThemeLabels(ta.getSubThemes().stream().map(SubTheme::getLabel).collect(Collectors.toSet()));
        dto.setLicenseTypeLabels(ta.getLicenseTypes().stream().map(LicenseType::getLabel).collect(Collectors.toSet()));
        dto.setPartnerAccreditationLabels(ta.getPartnerAccreditations().stream().map(TrainingActivityMapper::buildCaLabel).collect(Collectors.toSet()));

        // Champs principaux
        dto.setStartDate(a.getStartDate());
        dto.setEndDate(a.getEndDate());
        dto.setNumberOfParticipants(a.getNumberOfParticipants());
        dto.setOnline(a.isOnline());
        dto.setMemberPrice(a.getMemberPrice());
        dto.setNonMemberPrice(a.getNonMemberPrice());
        dto.setPhytodama(a.isPhytodama());
        dto.setStreet(a.getStreet());
        dto.setNumber(a.getNumber());
        dto.setPostalCode(a.getPostalCode());
        dto.setVille(a.getVille());
        dto.setProvince(a.getProvince());
        dto.setArchived(a.isArchived());

        // Audit
        dto.setCreatedAt(a.getCreatedAt());
        dto.setUpdatedAt(a.getUpdatedAt());
        dto.setUpdatedBy(a.getUpdatedBy());
        dto.setCreatedBy(a.getCreatedBy());

        return dto;
    }

    private static String buildTaLabel(TrainingAccreditation ta) {
        if (ta == null) return null;
        String title = ta.getTitle() != null ? ta.getTitle() : "#" + ta.getId();
        return title;
    }

    private static String buildCaLabel(CenterAccreditation ca) {
        if (ca == null) return null;
        String center = ca.getTrainingCenter() != null ? ca.getTrainingCenter().getName() : "";
        return center.isBlank() ? "#" + ca.getId() : center;
    }
}
