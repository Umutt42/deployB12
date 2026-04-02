package com.b12.web.dto;

import com.b12.domain.Organism;

import java.util.stream.Collectors;

public final class OrganismMapper {

    private OrganismMapper() {}

    public static OrganismDtos toDto(Organism o) {
        if (o == null) return null;

        OrganismDtos dto = new OrganismDtos();
        dto.setId(o.getId());
        dto.setName(o.getName());
        dto.setAbbreviation(o.getAbbreviation());
        dto.setArchived(o.isArchived());

        dto.setCreatedAt(o.getCreatedAt());
        dto.setUpdatedAt(o.getUpdatedAt());
        dto.setUpdatedBy(o.getUpdatedBy());
        dto.setCreatedBy(o.getCreatedBy());

        dto.setSectorIds(
                o.getSectors().stream().map(s -> s.getId()).collect(Collectors.toSet())
        );

        dto.setPilotCenterIds(
                o.getPilotCenters().stream().map(pc -> pc.getId()).collect(Collectors.toSet())
        );

        return dto;
    }
}
