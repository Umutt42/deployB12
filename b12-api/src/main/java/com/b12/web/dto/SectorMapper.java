package com.b12.web.dto;

import com.b12.domain.Sector;

import java.util.stream.Collectors;

public final class SectorMapper {

    private SectorMapper() {}

    public static SectorDtos toDto(Sector s) {
        if (s == null) return null;

        SectorDtos dto = new SectorDtos();
        dto.setId(s.getId());
        dto.setName(s.getName());
        dto.setDescription(s.getDescription());
        dto.setArchived(s.isArchived());

        dto.setCreatedAt(s.getCreatedAt());
        dto.setUpdatedAt(s.getUpdatedAt());
        dto.setUpdatedBy(s.getUpdatedBy());
        dto.setCreatedBy(s.getCreatedBy());

        dto.setOrganismIds(
                s.getOrganisms().stream().map(o -> o.getId()).collect(Collectors.toSet())
        );

        dto.setPilotCenterIds(
                s.getPilotCenters().stream().map(pc -> pc.getId()).collect(Collectors.toSet())
        );

        return dto;
    }
}
