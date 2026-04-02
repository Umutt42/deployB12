package com.b12.service;

import com.b12.domain.PilotCenter;
import com.b12.domain.Sector;
import com.b12.domain.TrainingCenter;
import com.b12.repository.PilotCenterRepository;
import com.b12.repository.SectorRepository;
import com.b12.repository.TrainingCenterRepository;
import com.b12.security.SecurityUtils;
import com.b12.web.dto.TrainingCenterDtos;
import com.b12.web.dto.TrainingCenterMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TrainingCenterService {

    private final TrainingCenterRepository trainingCenterRepo;
    private final SectorRepository sectorRepo;
    private final PilotCenterRepository pilotCenterRepo;

    // ✅ IMPORTANT : transaction pour éviter "no session" + self-invocation issue
    @Transactional
    public TrainingCenter create(TrainingCenterDtos dto) {
        String name = normalizeRequired(dto.getName(), "Le nom du centre de formation est requis.");
        String companyNumber = normalizeRequired(dto.getCompanyNumber(), "Le numéro d'entreprise est requis.");

        trainingCenterRepo.findByNameIgnoreCase(name).ifPresent(x -> {
            throw new IllegalArgumentException("Un centre de formation avec ce nom existe déjà : " + name);
        });

        trainingCenterRepo.findByCompanyNumberIgnoreCase(companyNumber).ifPresent(x -> {
            throw new IllegalArgumentException("Un centre de formation avec ce numéro d'entreprise existe déjà : " + companyNumber);
        });

        TrainingCenter tc = TrainingCenter.builder()
                .name(name)
                .companyNumber(companyNumber)
                .archived(false)

                // ✅ A1 : siège social (TrainingCenter = “centre”, agrément = sites/adresses)
                .hqStreet(normalizeOptional(dto.getHqStreet()))
                .hqNumber(normalizeOptional(dto.getHqNumber()))
                .hqPostalCode(normalizeOptional(dto.getHqPostalCode()))
                .hqCity(normalizeOptional(dto.getHqCity()))
                .hqProvince(normalizeOptional(dto.getHqProvince()))
                .build();

        tc.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        tc = trainingCenterRepo.save(tc);

        applyRelations(tc, dto);

        tc.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        tc = trainingCenterRepo.save(tc);

        // ✅ initialise lazy collections si le mapper les lit
        initCollections(tc);

        return tc;
    }

    @Transactional(readOnly = true)
    public List<TrainingCenterDtos> findAll() {
        return trainingCenterRepo.findAll().stream()
                .map(TrainingCenterMapper::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public TrainingCenter get(Long id) {
        return trainingCenterRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Centre de formation introuvable : " + id));
    }

    // ✅ méthode DTO "safe" (recommandée pour le controller GET /{id})
    @Transactional(readOnly = true)
    public TrainingCenterDtos getDto(Long id) {
        TrainingCenter tc = get(id);
        initCollections(tc);
        return TrainingCenterMapper.toDto(tc);
    }

    @Transactional
    public TrainingCenter update(Long id, TrainingCenterDtos dto) {
        TrainingCenter tc = get(id);

        String newName = normalizeRequired(dto.getName(), "Le nom du centre de formation est requis.");
        String newCompanyNumber = normalizeRequired(dto.getCompanyNumber(), "Le numéro d'entreprise est requis.");

        if (!tc.getName().equalsIgnoreCase(newName)) {
            trainingCenterRepo.findByNameIgnoreCase(newName).ifPresent(existing -> {
                throw new IllegalArgumentException("Un centre de formation avec ce nom existe déjà : " + newName);
            });
            tc.setName(newName);
        }

        if (!tc.getCompanyNumber().equalsIgnoreCase(newCompanyNumber)) {
            trainingCenterRepo.findByCompanyNumberIgnoreCase(newCompanyNumber).ifPresent(existing -> {
                throw new IllegalArgumentException("Un centre de formation avec ce numéro d'entreprise existe déjà : " + newCompanyNumber);
            });
            tc.setCompanyNumber(newCompanyNumber);
        }

        // ✅ A1 : siège social
        tc.setHqStreet(normalizeOptional(dto.getHqStreet()));
        tc.setHqNumber(normalizeOptional(dto.getHqNumber()));
        tc.setHqPostalCode(normalizeOptional(dto.getHqPostalCode()));
        tc.setHqCity(normalizeOptional(dto.getHqCity()));
        tc.setHqProvince(normalizeOptional(dto.getHqProvince()));

        tc.setArchived(dto.isArchived());

        applyRelations(tc, dto);

        tc.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        tc = trainingCenterRepo.save(tc);

        initCollections(tc);

        return tc;
    }

    @Transactional
    public TrainingCenter archive(Long id, boolean archived) {
        TrainingCenter tc = get(id);
        tc.setArchived(archived);
        tc.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        tc = trainingCenterRepo.save(tc);

        initCollections(tc);
        return tc;
    }

    @Transactional(readOnly = true)
    public List<TrainingCenterDtos> findAllByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return trainingCenterRepo.findAllById(ids).stream()
                .map(tc -> {
                    initCollections(tc);
                    return TrainingCenterMapper.toDto(tc);
                })
                .toList();
    }

    @Transactional
    public void delete(Long id) {
        trainingCenterRepo.delete(get(id));
    }

    /**
     * Relations:
     * - TrainingCenter <-> Sector (Many-to-Many)
     * - TrainingCenter <-> PilotCenter (Many-to-Many)
     *
     * NOTE: @Transactional ici n'est pas fiable si self-invocation.
     * On garde la transaction au niveau create/update.
     */
    void applyRelations(TrainingCenter tc, TrainingCenterDtos dto) {

        // sectors
        Set<Long> sectorIds = dto.getSectorIds() == null ? Set.of() : dto.getSectorIds();
        Set<Sector> sectors = sectorIds.isEmpty()
                ? Set.of()
                : new HashSet<>(sectorRepo.findAllById(sectorIds));

        tc.getSectors().clear();
        tc.getSectors().addAll(sectors);

        // pilot centers
        Set<Long> pcIds = dto.getPilotCenterIds() == null ? Set.of() : dto.getPilotCenterIds();
        Set<PilotCenter> pcs = pcIds.isEmpty()
                ? Set.of()
                : new HashSet<>(pilotCenterRepo.findAllById(pcIds));

        tc.getPilotCenters().clear();
        tc.getPilotCenters().addAll(pcs);
    }

    private void initCollections(TrainingCenter tc) {
        // ⚠️ ne change rien en DB, ça force juste l'initialisation lazy pendant la session
        if (tc.getSectors() != null) tc.getSectors().size();
        if (tc.getPilotCenters() != null) tc.getPilotCenters().size();
    }

    private String normalizeRequired(String s, String msg) {
        if (s == null || s.trim().isEmpty()) throw new IllegalArgumentException(msg);
        return s.trim();
    }

    private String normalizeOptional(String s) {
        if (s == null) return null;
        String v = s.trim();
        return v.isEmpty() ? null : v;
    }
}
