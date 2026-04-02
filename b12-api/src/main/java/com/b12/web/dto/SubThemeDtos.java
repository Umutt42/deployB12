package com.b12.web.dto;

public class SubThemeDtos {

    public record ImportRow(String name, String description, Integer hours) {}

    private Long id;
    private String name;
    private String description;
    private Integer hours;
    private boolean archived;

    // référence vers le thème parent
    private Long themeId;

    public SubThemeDtos() {
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

    public Integer getHours() {
        return hours;
    }

    public void setHours(Integer hours) {
        this.hours = hours;
    }

    public boolean isArchived() {
        return archived;
    }

    public void setArchived(boolean archived) {
        this.archived = archived;
    }

    public Long getThemeId() {
        return themeId;
    }

    public void setThemeId(Long themeId) {
        this.themeId = themeId;
    }
}
