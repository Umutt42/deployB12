package com.b12.web.dto;

import com.b12.domain.enums.AccreditationRequestStatus;
import com.b12.domain.enums.TrainingAccreditationType;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

public class TrainingAccreditationDtos {

    private Long id;

    // Type : COMPLETE ou SUB_MODULES
    private TrainingAccreditationType type;

    // Agrément centre principal (null si type = SUB_MODULES)
    private Long centerAccreditationId;
    private String centerAccreditationLabel;

    // Organismes partenaires (ids pour écriture, labels pour lecture)
    private Set<Long> partnerAccreditationIds;
    private Set<String> partnerAccreditationLabels;

    // Champs principaux
    private String title;
    private Double durationHours;
    private Double price;
    private Integer trainingPoints;
    private LocalDate receivedDate;
    private AccreditationRequestStatus requestStatus;
    private String accreditationNumber;
    private LocalDate startDate;
    private LocalDate endDate;
    private boolean initial;
    private boolean continuous;
    private boolean subsidized;
    private String comment;
    private String publicCible;
    private boolean archived;

    // Centre de formation (lecture seule : secteurs & centres pilotes)
    private Set<String> sectorLabels;
    private Set<String> pilotCenterLabels;

    // Relations (ids pour écriture)
    private Set<Long> licenseTypeIds;
    private Set<String> licenseTypeLabels;

    private Set<Long> themeIds;
    private Set<String> themeLabels;

    private Set<Long> subThemeIds;
    private Set<String> subThemeLabels;

    private Set<Long> trainerIds;
    private Set<String> trainerLabels;

    // Sous-modules (actifs si type = SUB_MODULES)
    private Set<Long> subModuleIds;
    private Set<String> subModuleLabels;
    private List<Long> subModuleCenterIds;
    private List<String> subModuleCenterLabels;

    // Audit
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private String updatedBy;
    private String createdBy;

    public TrainingAccreditationDtos() {}

    // ─── Getters / Setters ───────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public TrainingAccreditationType getType() { return type; }
    public void setType(TrainingAccreditationType type) { this.type = type; }

    public Long getCenterAccreditationId() { return centerAccreditationId; }
    public void setCenterAccreditationId(Long centerAccreditationId) { this.centerAccreditationId = centerAccreditationId; }

    public String getCenterAccreditationLabel() { return centerAccreditationLabel; }
    public void setCenterAccreditationLabel(String centerAccreditationLabel) { this.centerAccreditationLabel = centerAccreditationLabel; }

    public Set<String> getSectorLabels() { return sectorLabels; }
    public void setSectorLabels(Set<String> sectorLabels) { this.sectorLabels = sectorLabels; }

    public Set<String> getPilotCenterLabels() { return pilotCenterLabels; }
    public void setPilotCenterLabels(Set<String> pilotCenterLabels) { this.pilotCenterLabels = pilotCenterLabels; }

    public Set<Long> getPartnerAccreditationIds() { return partnerAccreditationIds; }
    public void setPartnerAccreditationIds(Set<Long> partnerAccreditationIds) { this.partnerAccreditationIds = partnerAccreditationIds; }

    public Set<String> getPartnerAccreditationLabels() { return partnerAccreditationLabels; }
    public void setPartnerAccreditationLabels(Set<String> partnerAccreditationLabels) { this.partnerAccreditationLabels = partnerAccreditationLabels; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public Double getDurationHours() { return durationHours; }
    public void setDurationHours(Double durationHours) { this.durationHours = durationHours; }

    public Double getPrice() { return price; }
    public void setPrice(Double price) { this.price = price; }

    public Integer getTrainingPoints() { return trainingPoints; }
    public void setTrainingPoints(Integer trainingPoints) { this.trainingPoints = trainingPoints; }

    public LocalDate getReceivedDate() { return receivedDate; }
    public void setReceivedDate(LocalDate receivedDate) { this.receivedDate = receivedDate; }

    public AccreditationRequestStatus getRequestStatus() { return requestStatus; }
    public void setRequestStatus(AccreditationRequestStatus requestStatus) { this.requestStatus = requestStatus; }

    public String getAccreditationNumber() { return accreditationNumber; }
    public void setAccreditationNumber(String accreditationNumber) { this.accreditationNumber = accreditationNumber; }

    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }

    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }

    public boolean isInitial() { return initial; }
    public void setInitial(boolean initial) { this.initial = initial; }

    public boolean isContinuous() { return continuous; }
    public void setContinuous(boolean continuous) { this.continuous = continuous; }

    public boolean isSubsidized() { return subsidized; }
    public void setSubsidized(boolean subsidized) { this.subsidized = subsidized; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }

    public String getPublicCible() { return publicCible; }
    public void setPublicCible(String publicCible) { this.publicCible = publicCible; }

    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }

    public Set<Long> getLicenseTypeIds() { return licenseTypeIds; }
    public void setLicenseTypeIds(Set<Long> licenseTypeIds) { this.licenseTypeIds = licenseTypeIds; }

    public Set<String> getLicenseTypeLabels() { return licenseTypeLabels; }
    public void setLicenseTypeLabels(Set<String> licenseTypeLabels) { this.licenseTypeLabels = licenseTypeLabels; }

    public Set<Long> getThemeIds() { return themeIds; }
    public void setThemeIds(Set<Long> themeIds) { this.themeIds = themeIds; }

    public Set<String> getThemeLabels() { return themeLabels; }
    public void setThemeLabels(Set<String> themeLabels) { this.themeLabels = themeLabels; }

    public Set<Long> getSubThemeIds() { return subThemeIds; }
    public void setSubThemeIds(Set<Long> subThemeIds) { this.subThemeIds = subThemeIds; }

    public Set<String> getSubThemeLabels() { return subThemeLabels; }
    public void setSubThemeLabels(Set<String> subThemeLabels) { this.subThemeLabels = subThemeLabels; }

    public Set<Long> getTrainerIds() { return trainerIds; }
    public void setTrainerIds(Set<Long> trainerIds) { this.trainerIds = trainerIds; }

    public Set<String> getTrainerLabels() { return trainerLabels; }
    public void setTrainerLabels(Set<String> trainerLabels) { this.trainerLabels = trainerLabels; }

    public Set<Long> getSubModuleIds() { return subModuleIds; }
    public void setSubModuleIds(Set<Long> subModuleIds) { this.subModuleIds = subModuleIds; }

    public Set<String> getSubModuleLabels() { return subModuleLabels; }
    public void setSubModuleLabels(Set<String> subModuleLabels) { this.subModuleLabels = subModuleLabels; }

    public List<Long> getSubModuleCenterIds() { return subModuleCenterIds; }
    public void setSubModuleCenterIds(List<Long> subModuleCenterIds) { this.subModuleCenterIds = subModuleCenterIds; }

    public List<String> getSubModuleCenterLabels() { return subModuleCenterLabels; }
    public void setSubModuleCenterLabels(List<String> subModuleCenterLabels) { this.subModuleCenterLabels = subModuleCenterLabels; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
}
