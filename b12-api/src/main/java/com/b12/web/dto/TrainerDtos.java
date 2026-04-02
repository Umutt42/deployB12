package com.b12.web.dto;

import java.time.OffsetDateTime;
import java.util.Set;

public class TrainerDtos {

    public record ImportRow(
        String firstName,
        String lastName,
        String email,
        String phone,
        String phytolicenceNumber
    ) {}

    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private String phone;
    private String phytolicenceNumber;
    private String comment;
    private boolean archived;

    // Agrément formation (FK) — id pour écriture, label pour lecture
    private Long trainingAccreditationId;
    private String trainingAccreditationLabel;

    // Organismes partenaires — ids pour écriture, labels pour lecture
    private Set<Long> partnerOrganismIds;
    private Set<String> partnerOrganismLabels;

    // Agréments formation liés (lecture seule) — FK + ManyToMany fusionnés
    private Set<Long> trainingAccreditationIds;
    private Set<String> trainingAccreditationLabels;

    // Centres de formation liés (lecture seule, via agrément formation → agrément centre → centre)
    private Set<Long> trainingCenterIds;
    private Set<String> trainingCenterLabels;

    // Audit
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private String updatedBy;
    private String createdBy;

    public TrainerDtos() {}

    // ─── Getters / Setters ───────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getPhytolicenceNumber() { return phytolicenceNumber; }
    public void setPhytolicenceNumber(String phytolicenceNumber) { this.phytolicenceNumber = phytolicenceNumber; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }

    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }

    public Long getTrainingAccreditationId() { return trainingAccreditationId; }
    public void setTrainingAccreditationId(Long trainingAccreditationId) { this.trainingAccreditationId = trainingAccreditationId; }

    public String getTrainingAccreditationLabel() { return trainingAccreditationLabel; }
    public void setTrainingAccreditationLabel(String trainingAccreditationLabel) { this.trainingAccreditationLabel = trainingAccreditationLabel; }

    public Set<Long> getPartnerOrganismIds() { return partnerOrganismIds; }
    public void setPartnerOrganismIds(Set<Long> partnerOrganismIds) { this.partnerOrganismIds = partnerOrganismIds; }

    public Set<String> getPartnerOrganismLabels() { return partnerOrganismLabels; }
    public void setPartnerOrganismLabels(Set<String> partnerOrganismLabels) { this.partnerOrganismLabels = partnerOrganismLabels; }

    public Set<Long> getTrainingAccreditationIds() { return trainingAccreditationIds; }
    public void setTrainingAccreditationIds(Set<Long> trainingAccreditationIds) { this.trainingAccreditationIds = trainingAccreditationIds; }

    public Set<String> getTrainingAccreditationLabels() { return trainingAccreditationLabels; }
    public void setTrainingAccreditationLabels(Set<String> trainingAccreditationLabels) { this.trainingAccreditationLabels = trainingAccreditationLabels; }

    public Set<Long> getTrainingCenterIds() { return trainingCenterIds; }
    public void setTrainingCenterIds(Set<Long> trainingCenterIds) { this.trainingCenterIds = trainingCenterIds; }

    public Set<String> getTrainingCenterLabels() { return trainingCenterLabels; }
    public void setTrainingCenterLabels(Set<String> trainingCenterLabels) { this.trainingCenterLabels = trainingCenterLabels; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
}
