package com.b12.web.dto;

import com.b12.domain.CenterAccreditation;
import com.b12.domain.ContactPerson;
import com.b12.domain.TrainingSiteAddress;

import java.util.stream.Collectors;

public final class CenterAccreditationMapper {

    private CenterAccreditationMapper() {}

    public static CenterAccreditationDtos toDto(CenterAccreditation a) {
        if (a == null) return null;

        CenterAccreditationDtos dto = new CenterAccreditationDtos();
        dto.setId(a.getId());
        dto.setTrainingCenterId(a.getTrainingCenter().getId());

        dto.setReceivedDate(a.getReceivedDate());
        dto.setRequestStatus(a.getRequestStatus());
        dto.setAccreditationNumber(a.getAccreditationNumber());
        dto.setStartDate(a.getStartDate());
        dto.setEndDate(a.getEndDate());

        dto.setInitial(a.isInitial());
        dto.setContinuous(a.isContinuous());
        dto.setArchived(a.isArchived());

        dto.setCreatedAt(a.getCreatedAt());
        dto.setUpdatedAt(a.getUpdatedAt());
        dto.setUpdatedBy(a.getUpdatedBy());
        dto.setCreatedBy(a.getCreatedBy());

        dto.setTrainingSiteAddresses(
                a.getTrainingSiteAddresses().stream().map(CenterAccreditationMapper::toAddressDto).collect(Collectors.toSet())
        );

        dto.setContactPeople(
                a.getContactPeople().stream().map(CenterAccreditationMapper::toContactDto).collect(Collectors.toSet())
        );

        return dto;
    }

    private static TrainingSiteAddressDtos toAddressDto(TrainingSiteAddress x) {
        TrainingSiteAddressDtos d = new TrainingSiteAddressDtos();
        d.setId(x.getId());
        d.setStreet(x.getStreet());
        d.setNumber(x.getNumber());
        d.setCity(x.getCity());
        d.setPostalCode(x.getPostalCode());
        d.setProvince(x.getProvince());
        d.setArchived(x.isArchived());
        d.setCreatedAt(x.getCreatedAt());
        d.setUpdatedAt(x.getUpdatedAt());
        d.setUpdatedBy(x.getUpdatedBy());
        d.setCreatedBy(x.getCreatedBy());
        return d;
    }

    private static ContactPersonDtos toContactDto(ContactPerson x) {
        ContactPersonDtos d = new ContactPersonDtos();
        d.setId(x.getId());
        d.setFirstName(x.getFirstName());
        d.setLastName(x.getLastName());
        d.setEmail(x.getEmail());
        d.setPhone(x.getPhone());
        d.setFonction(x.getFonction());
        d.setArchived(x.isArchived());
        d.setCreatedAt(x.getCreatedAt());
        d.setUpdatedAt(x.getUpdatedAt());
        d.setUpdatedBy(x.getUpdatedBy());
        d.setCreatedBy(x.getCreatedBy());
        return d;
    }
}
