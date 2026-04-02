package com.b12.service;

import com.b12.domain.TrainingAccreditation;
import com.b12.domain.TrainingActivity;
import com.b12.repository.TrainingAccreditationRepository;
import com.b12.repository.TrainingActivityRepository;
import com.b12.security.SecurityUtils;
import com.b12.web.dto.TrainingActivityDtos;
import com.b12.web.dto.TrainingActivityMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TrainingActivityService {

    private final TrainingActivityRepository trainingActivityRepo;
    private final TrainingAccreditationRepository trainingAccreditationRepo;

    // =========================
    // READ
    // =========================

    @Transactional(readOnly = true)
    public List<TrainingActivityDtos> findAll() {
        return trainingActivityRepo.findByArchivedFalse()
                .stream().map(TrainingActivityMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<TrainingActivityDtos> findByDateRange(LocalDate from, LocalDate to) {
        return trainingActivityRepo.findByStartDateBetweenAndArchivedFalse(from, to)
                .stream().map(TrainingActivityMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public TrainingActivityDtos getDto(Long id) {
        TrainingActivity activity = trainingActivityRepo.findByIdWithAccreditation(id)
                .orElseThrow(() -> new IllegalArgumentException("Activité de formation introuvable : " + id));
        return TrainingActivityMapper.toDto(activity);
    }

    @Transactional(readOnly = true)
    public List<TrainingActivityDtos> findAllIncludingArchived() {
        return trainingActivityRepo.findAll()
                .stream().map(TrainingActivityMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<TrainingActivityDtos> findAllByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return trainingActivityRepo.findAllById(ids)
                .stream().map(TrainingActivityMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<TrainingActivityDtos> findByTrainingAccreditation(Long trainingAccreditationId) {
        return trainingActivityRepo.findByTrainingAccreditationId(trainingAccreditationId)
                .stream().map(TrainingActivityMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<TrainingActivityDtos> findEligible(LocalDate date) {
        return trainingAccreditationRepo.findAllEligibleForActivity(date)
                .stream()
                .map(ta -> {
                    TrainingActivityDtos dto = new TrainingActivityDtos();
                    dto.setTrainingAccreditationId(ta.getId());
                    dto.setTrainingAccreditationLabel(ta.getTitle() != null ? ta.getTitle() : "#" + ta.getId());
                    com.b12.domain.CenterAccreditation ca = ta.getCenterAccreditation();
                    if (ca != null) {
                        dto.setCenterAccreditationId(ca.getId());
                        String caCenter = ca.getTrainingCenter() != null ? ca.getTrainingCenter().getName() : "";
                        dto.setCenterAccreditationLabel(caCenter.isBlank() ? "#" + ca.getId() : caCenter);
                    }
                    return dto;
                })
                .toList();
    }

    // =========================
    // CREATE
    // =========================

    @Transactional
    public TrainingActivityDtos createDto(TrainingActivityDtos dto) {
        TrainingActivity activity = buildFromDto(new TrainingActivity(), dto);
        activity.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        activity = trainingActivityRepo.save(activity);
        return TrainingActivityMapper.toDto(activity);
    }

    // =========================
    // UPDATE
    // =========================

    @Transactional
    public TrainingActivityDtos updateDto(Long id, TrainingActivityDtos dto) {
        TrainingActivity activity = trainingActivityRepo.findByIdWithAccreditation(id)
                .orElseThrow(() -> new IllegalArgumentException("Activité de formation introuvable : " + id));
        buildFromDto(activity, dto);
        activity.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        activity = trainingActivityRepo.save(activity);
        return TrainingActivityMapper.toDto(activity);
    }

    // =========================
    // ARCHIVE
    // =========================

    @Transactional
    public TrainingActivityDtos archiveDto(Long id, boolean archived) {
        TrainingActivity activity = trainingActivityRepo.findByIdWithAccreditation(id)
                .orElseThrow(() -> new IllegalArgumentException("Activité de formation introuvable : " + id));
        activity.setArchived(archived);
        activity.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        activity = trainingActivityRepo.save(activity);
        return TrainingActivityMapper.toDto(activity);
    }

    // =========================
    // DELETE
    // =========================

    @Transactional
    public void delete(Long id) {
        TrainingActivity activity = trainingActivityRepo.findByIdWithAccreditation(id)
                .orElseThrow(() -> new IllegalArgumentException("Activité de formation introuvable : " + id));
        trainingActivityRepo.delete(activity);
    }

    // =========================
    // PRIVATE HELPERS
    // =========================

    private TrainingActivity buildFromDto(TrainingActivity activity, TrainingActivityDtos dto) {
        if (dto.getTrainingAccreditationId() == null) {
            throw new IllegalArgumentException("L'identifiant d'agrément formation est requis.");
        }

        LocalDate startDate = dto.getStartDate();
        if (startDate == null) {
            throw new IllegalArgumentException("La date de début est requise.");
        }

        // Vérification que le TA est éligible à la date de début
        TrainingAccreditation ta = trainingAccreditationRepo.findAllEligibleForActivity(startDate)
                .stream()
                .filter(t -> t.getId().equals(dto.getTrainingAccreditationId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "L'agrément formation " + dto.getTrainingAccreditationId()
                        + " n'est pas actif à la date " + startDate));

        activity.setTrainingAccreditation(ta);
        activity.setStartDate(startDate);
        activity.setEndDate(dto.getEndDate());
        activity.setNumberOfParticipants(dto.getNumberOfParticipants());
        activity.setOnline(dto.isOnline());
        activity.setMemberPrice(dto.getMemberPrice() != null ? dto.getMemberPrice() : java.math.BigDecimal.ZERO);
        activity.setNonMemberPrice(dto.getNonMemberPrice() != null ? dto.getNonMemberPrice() : java.math.BigDecimal.ZERO);
        activity.setPhytodama(dto.isPhytodama());
        activity.setStreet(normalizeOptional(dto.getStreet()));
        activity.setNumber(normalizeOptional(dto.getNumber()));
        activity.setPostalCode(normalizeOptional(dto.getPostalCode()));
        activity.setVille(normalizeOptional(dto.getVille()));
        activity.setProvince(normalizeOptional(dto.getProvince()));
        activity.setArchived(dto.isArchived());

        return activity;
    }

    private String normalizeOptional(String s) {
        if (s == null) return null;
        String v = s.trim();
        return v.isEmpty() ? null : v;
    }
}
