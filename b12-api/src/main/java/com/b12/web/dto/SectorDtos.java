package com.b12.web.dto;

import java.time.OffsetDateTime;
import java.util.Set;

public class SectorDtos {

    public record ImportRow(String name, String description) {}

    private Long id;
    private String name;
    private String description;
    private boolean archived;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private String updatedBy;
    private String createdBy;

    private Set<Long> organismIds;
    private Set<Long> pilotCenterIds;

    public SectorDtos() {
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

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
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

    public Set<Long> getOrganismIds() {
        return organismIds;
    }

    public void setOrganismIds(Set<Long> organismIds) {
        this.organismIds = organismIds;
    }

    public Set<Long> getPilotCenterIds() {
        return pilotCenterIds;
    }

    public void setPilotCenterIds(Set<Long> pilotCenterIds) {
        this.pilotCenterIds = pilotCenterIds;
    }
}
