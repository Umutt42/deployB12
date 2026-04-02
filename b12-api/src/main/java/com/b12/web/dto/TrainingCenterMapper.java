package com.b12.web.dto;

import com.b12.domain.TrainingCenter;

import java.util.stream.Collectors;

public final class TrainingCenterMapper {

    private TrainingCenterMapper() {}

    public static TrainingCenterDtos toDto(TrainingCenter tc) {
        if (tc == null) return null;

        TrainingCenterDtos dto = new TrainingCenterDtos();
        dto.setId(tc.getId());
        dto.setName(tc.getName());
        dto.setCompanyNumber(tc.getCompanyNumber());
        dto.setArchived(tc.isArchived());

        dto.setCreatedAt(tc.getCreatedAt());
        dto.setUpdatedAt(tc.getUpdatedAt());
        dto.setUpdatedBy(tc.getUpdatedBy());
        dto.setCreatedBy(tc.getCreatedBy());
        dto.setHqStreet(tc.getHqStreet());
dto.setHqNumber(tc.getHqNumber());
dto.setHqPostalCode(tc.getHqPostalCode());
dto.setHqCity(tc.getHqCity());
dto.setHqProvince(tc.getHqProvince());


        dto.setSectorIds(
                tc.getSectors().stream().map(s -> s.getId()).collect(Collectors.toSet())
        );

        dto.setPilotCenterIds(
                tc.getPilotCenters().stream().map(pc -> pc.getId()).collect(Collectors.toSet())
        );

        return dto;
    }
}
