package com.b12.web.dto;

import java.time.OffsetDateTime;
import java.util.Set;

public class TrainingCenterDtos {

    private Long id;
    private String name;
    private String companyNumber;
    private boolean archived;

    // Adresse du siège (HQ)
    private String hqStreet;
    private String hqNumber;
    private String hqPostalCode;
    private String hqCity;
    private String hqProvince;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private String updatedBy;
    private String createdBy;

    private Set<Long> sectorIds;
    private Set<Long> pilotCenterIds;

    public TrainingCenterDtos() {}

    // ====== ID ======
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    // ====== Name ======
    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    // ====== Company Number ======
    public String getCompanyNumber() {
        return companyNumber;
    }

    public void setCompanyNumber(String companyNumber) {
        this.companyNumber = companyNumber;
    }

    // ====== Archived ======
    public boolean isArchived() {
        return archived;
    }

    public void setArchived(boolean archived) {
        this.archived = archived;
    }

    // ====== HQ Address ======
    public String getHqStreet() {
        return hqStreet;
    }

    public void setHqStreet(String hqStreet) {
        this.hqStreet = hqStreet;
    }

    public String getHqNumber() {
        return hqNumber;
    }

    public void setHqNumber(String hqNumber) {
        this.hqNumber = hqNumber;
    }

    public String getHqPostalCode() {
        return hqPostalCode;
    }

    public void setHqPostalCode(String hqPostalCode) {
        this.hqPostalCode = hqPostalCode;
    }

    public String getHqCity() {
        return hqCity;
    }

    public void setHqCity(String hqCity) {
        this.hqCity = hqCity;
    }

    public String getHqProvince() {
        return hqProvince;
    }

    public void setHqProvince(String hqProvince) {
        this.hqProvince = hqProvince;
    }

    // ====== Audit ======
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

    // ====== Relations ======
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
