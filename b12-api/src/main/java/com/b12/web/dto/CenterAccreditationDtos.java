package com.b12.web.dto;

import com.b12.domain.enums.AccreditationRequestStatus;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Set;

public class CenterAccreditationDtos {

    private Long id;
    private Long trainingCenterId;

    private LocalDate receivedDate;
    private AccreditationRequestStatus requestStatus;
    private String accreditationNumber;
    private LocalDate startDate;
    private LocalDate endDate;

    private boolean initial;
    private boolean continuous;
    private boolean archived;

    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private String updatedBy;
    private String createdBy;

    private Set<TrainingSiteAddressDtos> trainingSiteAddresses;
    private Set<ContactPersonDtos> contactPeople;

    public CenterAccreditationDtos() {}

    // getters/setters (je te les mets full)
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getTrainingCenterId() { return trainingCenterId; }
    public void setTrainingCenterId(Long trainingCenterId) { this.trainingCenterId = trainingCenterId; }

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

    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public Set<TrainingSiteAddressDtos> getTrainingSiteAddresses() { return trainingSiteAddresses; }
    public void setTrainingSiteAddresses(Set<TrainingSiteAddressDtos> trainingSiteAddresses) { this.trainingSiteAddresses = trainingSiteAddresses; }

    public Set<ContactPersonDtos> getContactPeople() { return contactPeople; }
    public void setContactPeople(Set<ContactPersonDtos> contactPeople) { this.contactPeople = contactPeople; }
}
