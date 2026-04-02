package com.b12.web.dto;

import com.b12.domain.PilotCenter;

import java.util.stream.Collectors;

public final class PilotCenterMapper {

    private PilotCenterMapper() {}

    public static PilotCenterDtos toDto(PilotCenter pc) {
        if (pc == null) return null;

        PilotCenterDtos dto = new PilotCenterDtos();
        dto.setId(pc.getId());
        dto.setName(pc.getName());
        dto.setCpGroup(pc.getCpGroup());
        dto.setDescription(pc.getDescription());
        dto.setArchived(pc.isArchived());

        dto.setCreatedAt(pc.getCreatedAt());
        dto.setUpdatedAt(pc.getUpdatedAt());
        dto.setUpdatedBy(pc.getUpdatedBy());
        dto.setCreatedBy(pc.getCreatedBy());

        dto.setSectorIds(
                pc.getSectors().stream().map(s -> s.getId()).collect(Collectors.toSet())
        );

        dto.setOrganismIds(
                pc.getOrganisms().stream().map(o -> o.getId()).collect(Collectors.toSet())
        );

        return dto;
    }
}
