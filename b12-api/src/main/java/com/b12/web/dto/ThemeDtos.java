package com.b12.web.dto;

import java.time.OffsetDateTime;
import java.util.List;

public class ThemeDtos {

    private Long id;
    private String name;
    private String description;
    private boolean archived;

    // ✅ Dates système
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    // ✅ Audit utilisateur
    private String updatedBy;

    // sous-thématiques associées (pour GET)
    private List<SubThemeDtos> subThemes;

    public ThemeDtos() {
    }

    // ===== getters & setters =====

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

    public List<SubThemeDtos> getSubThemes() {
        return subThemes;
    }

    public void setSubThemes(List<SubThemeDtos> subThemes) {
        this.subThemes = subThemes;
    }
}
