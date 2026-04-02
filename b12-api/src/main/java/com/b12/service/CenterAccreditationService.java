package com.b12.service;

import com.b12.domain.CenterAccreditation;
import com.b12.domain.ContactPerson;
import com.b12.domain.TrainingCenter;
import com.b12.domain.TrainingSiteAddress;
import com.b12.repository.CenterAccreditationRepository;
import com.b12.repository.TrainingCenterRepository;
import com.b12.security.SecurityUtils;
import com.b12.web.dto.CenterAccreditationDtos;
import com.b12.web.dto.CenterAccreditationMapper;
import com.b12.web.dto.ContactPersonDtos;
import com.b12.web.dto.TrainingSiteAddressDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CenterAccreditationService {

    private final CenterAccreditationRepository accreditationRepo;
    private final TrainingCenterRepository trainingCenterRepo;

    /* =========================
       DTO-safe public API
       (mapping dans la transaction)
    ========================= */

    @Transactional
    public CenterAccreditationDtos createDto(CenterAccreditationDtos dto) {
        CenterAccreditation saved = create(dto);
        initCollections(saved);
        return CenterAccreditationMapper.toDto(saved);
    }

    @Transactional(readOnly = true)
    public List<CenterAccreditationDtos> findAll() {
        List<CenterAccreditation> list = accreditationRepo.findAll();
        list.forEach(this::initCollections);
        return list.stream().map(CenterAccreditationMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<CenterAccreditationDtos> findByTrainingCenter(Long trainingCenterId) {
        List<CenterAccreditation> list = accreditationRepo.findByTrainingCenterId(trainingCenterId);
        list.forEach(this::initCollections);
        return list.stream().map(CenterAccreditationMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public CenterAccreditationDtos getDto(Long id) {
        CenterAccreditation a = get(id);
        initCollections(a);
        return CenterAccreditationMapper.toDto(a);
    }

    @Transactional(readOnly = true)
    public List<CenterAccreditationDtos> findActiveAt(LocalDate date) {
        List<CenterAccreditation> list = accreditationRepo.findActiveAt(date);
        list.forEach(this::initCollections);
        return list.stream().map(CenterAccreditationMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<CenterAccreditationDtos> findAllByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        List<CenterAccreditation> list = accreditationRepo.findAllById(ids);
        list.forEach(this::initCollections);
        return list.stream().map(CenterAccreditationMapper::toDto).toList();
    }

    @Transactional
    public CenterAccreditationDtos updateDto(Long id, CenterAccreditationDtos dto) {
        CenterAccreditation saved = update(id, dto);
        initCollections(saved);
        return CenterAccreditationMapper.toDto(saved);
    }

    @Transactional
    public CenterAccreditationDtos archiveDto(Long id, boolean archived) {
        CenterAccreditation saved = archive(id, archived);
        initCollections(saved);
        return CenterAccreditationMapper.toDto(saved);
    }

    /* =========================
       Domain methods (entities)
    ========================= */

    @Transactional
    public CenterAccreditation create(CenterAccreditationDtos dto) {
        if (dto.getTrainingCenterId() == null) {
            throw new IllegalArgumentException("L'identifiant du centre de formation est requis.");
        }

        TrainingCenter tc = trainingCenterRepo.findById(dto.getTrainingCenterId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Centre de formation introuvable : " + dto.getTrainingCenterId()
                ));

        CenterAccreditation a = CenterAccreditation.builder()
                .trainingCenter(tc)
                .receivedDate(dto.getReceivedDate())
                .requestStatus(dto.getRequestStatus())
                .accreditationNumber(normalizeOptional(dto.getAccreditationNumber()))
                .startDate(dto.getStartDate())
                .endDate(dto.getEndDate())
                .initial(dto.isInitial())
                .continuous(dto.isContinuous())
                .archived(false)
                .build();

        a.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        a = accreditationRepo.save(a);

        applyChildren(a, dto);

        a.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        return accreditationRepo.save(a);
    }

    @Transactional(readOnly = true)
    public CenterAccreditation get(Long id) {
        return accreditationRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Agrément centre introuvable : " + id));
    }

    @Transactional
    public CenterAccreditation update(Long id, CenterAccreditationDtos dto) {
        CenterAccreditation a = get(id);

        a.setReceivedDate(dto.getReceivedDate());
        a.setRequestStatus(dto.getRequestStatus());
        a.setAccreditationNumber(normalizeOptional(dto.getAccreditationNumber()));
        a.setStartDate(dto.getStartDate());
        a.setEndDate(dto.getEndDate());
        a.setInitial(dto.isInitial());
        a.setContinuous(dto.isContinuous());
        a.setArchived(dto.isArchived());

        applyChildren(a, dto);

        a.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        return accreditationRepo.save(a);
    }

    @Transactional
    public CenterAccreditation archive(Long id, boolean archived) {
        CenterAccreditation a = get(id);
        a.setArchived(archived);
        a.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        return accreditationRepo.save(a);
    }

    @Transactional
    public void delete(Long id) {
        accreditationRepo.delete(get(id));
    }

    /* =========================
       Children mapping
    ========================= */

    @Transactional
    void applyChildren(CenterAccreditation a, CenterAccreditationDtos dto) {

        // addresses (replace all)
        a.getTrainingSiteAddresses().clear();
        if (dto.getTrainingSiteAddresses() != null) {
            for (TrainingSiteAddressDtos x : dto.getTrainingSiteAddresses()) {
                TrainingSiteAddress addr = TrainingSiteAddress.builder()
                        .centerAccreditation(a)
                        .street(normalizeOptional(x.getStreet()))
                        .number(normalizeOptional(x.getNumber()))
                        .city(normalizeOptional(x.getCity()))
                        .postalCode(normalizeOptional(x.getPostalCode()))
                        .province(normalizeOptional(x.getProvince()))
                        .archived(x.isArchived())
                        .build();
                addr.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
                a.getTrainingSiteAddresses().add(addr);
            }
        }

        // contacts (replace all)
        a.getContactPeople().clear();
        if (dto.getContactPeople() != null) {
            for (ContactPersonDtos x : dto.getContactPeople()) {
                ContactPerson p = ContactPerson.builder()
                        .centerAccreditation(a)
                        .firstName(normalizeOptional(x.getFirstName()))
                        .lastName(normalizeOptional(x.getLastName()))
                        .email(normalizeOptional(x.getEmail()))
                        .phone(normalizeOptional(x.getPhone()))
                        .fonction(normalizeOptional(x.getFonction()))
                        .archived(x.isArchived())
                        .build();
                p.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
                a.getContactPeople().add(p);
            }
        }
    }

    /* =========================
       Lazy init protection
    ========================= */

    private void initCollections(CenterAccreditation a) {
        if (a == null) return;

        // ManyToOne trainingCenter
        if (a.getTrainingCenter() != null) {
            a.getTrainingCenter().getId(); // force init proxy si besoin
        }

        // OneToMany
        if (a.getTrainingSiteAddresses() != null) {
            a.getTrainingSiteAddresses().size();
        }
        if (a.getContactPeople() != null) {
            a.getContactPeople().size();
        }
    }

    private String normalizeOptional(String s) {
        if (s == null) return null;
        String v = s.trim();
        return v.isEmpty() ? null : v;
    }
}
