package com.b12.web.dto;

import java.time.OffsetDateTime;
import java.util.Set;

public class OrganismDtos {

    public record ImportRow(String name, String abbreviation) {}

    private Long id;
    private String name;
    private String abbreviation;
    private boolean archived;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private String updatedBy;
    private String createdBy;

    private Set<Long> sectorIds;
    private Set<Long> pilotCenterIds;

    public OrganismDtos() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAbbreviation() {
        return abbreviation;
    }

    public void setAbbreviation(String abbreviation) {
        this.abbreviation = abbreviation;
    }

    public boolean isArchived() {
        return archived;
    }

    public void setArchived(boolean archived) {
        this.archived = archived;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public Set<Long> getSectorIds() {
        return sectorIds;
    }

    public void setSectorIds(Set<Long> sectorIds) {
        this.sectorIds = sectorIds;
    }

    public Set<Long> getPilotCenterIds() {
        return pilotCenterIds;
    }

    public void setPilotCenterIds(Set<Long> pilotCenterIds) {
        this.pilotCenterIds = pilotCenterIds;
    }
}
