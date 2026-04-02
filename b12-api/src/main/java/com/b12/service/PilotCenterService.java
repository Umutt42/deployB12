package com.b12.service;

import com.b12.domain.Organism;
import com.b12.domain.PilotCenter;
import com.b12.domain.Sector;
import com.b12.repository.OrganismRepository;
import com.b12.repository.PilotCenterRepository;
import com.b12.repository.SectorRepository;
import com.b12.security.SecurityUtils;
import com.b12.web.dto.PilotCenterDtos;
import com.b12.web.dto.PilotCenterMapper;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class PilotCenterService {

    private final PilotCenterRepository pilotCenterRepo;
    private final SectorRepository sectorRepo;
    private final OrganismRepository organismRepo;

    // =========================
    // CREATE / UPDATE / ARCHIVE
    // =========================

    @Transactional
    public PilotCenter create(PilotCenterDtos dto) {
        String name = normalizeRequired(dto.getName(), "Le nom du centre pilote est requis.");

        pilotCenterRepo.findByNameIgnoreCase(name).ifPresent(x -> {
            throw new IllegalArgumentException("Ce centre pilote existe déjà : " + name);
        });

        PilotCenter pc = PilotCenter.builder()
                .name(name)
                .cpGroup(normalizeOptional(dto.getCpGroup()))
                .description(normalizeOptional(dto.getDescription()))
                .archived(false)
                .build();

        pc.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        pc = pilotCenterRepo.save(pc);

        applyRelations(pc, dto);

        pc.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        pc = pilotCenterRepo.save(pc);

        initCollections(pc);
        return pc;
    }

    @Transactional
    public PilotCenter update(Long id, PilotCenterDtos dto) {
        PilotCenter pc = get(id);

        String newName = normalizeRequired(dto.getName(), "Le nom du centre pilote est requis.");
        if (!pc.getName().equalsIgnoreCase(newName)) {
            pilotCenterRepo.findByNameIgnoreCase(newName).ifPresent(existing -> {
                throw new IllegalArgumentException("Ce centre pilote existe déjà : " + newName);
            });
            pc.setName(newName);
        }

        pc.setCpGroup(normalizeOptional(dto.getCpGroup()));
        pc.setDescription(normalizeOptional(dto.getDescription()));
        pc.setArchived(dto.isArchived());

        applyRelations(pc, dto);

        pc.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        pc = pilotCenterRepo.save(pc);

        initCollections(pc);
        return pc;
    }

    @Transactional
    public PilotCenter archive(Long id, boolean archived) {
        PilotCenter pc = get(id);
        pc.setArchived(archived);
        pc.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        pc = pilotCenterRepo.save(pc);

        initCollections(pc);
        return pc;
    }

    @Transactional
    public void delete(Long id) {
        pilotCenterRepo.delete(get(id));
    }

    // =========================
    // DTO SAFE METHODS (controller-friendly)
    // =========================

    @Transactional
    public PilotCenterDtos createDto(PilotCenterDtos dto) {
        return PilotCenterMapper.toDto(create(dto));
    }

    @Transactional
    public PilotCenterDtos updateDto(Long id, PilotCenterDtos dto) {
        return PilotCenterMapper.toDto(update(id, dto));
    }

    @Transactional
    public PilotCenterDtos archiveDto(Long id, boolean archived) {
        return PilotCenterMapper.toDto(archive(id, archived));
    }

    @Transactional(readOnly = true)
    public List<PilotCenterDtos> findAll() {
        // ✅ ici OK : transaction ouverte pendant le mapping
        return pilotCenterRepo.findAll().stream()
                .map(pc -> {
                    initCollections(pc);
                    return PilotCenterMapper.toDto(pc);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PilotCenterDtos> findAllByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return pilotCenterRepo.findAllById(ids).stream()
                .map(pc -> {
                    initCollections(pc);
                    return PilotCenterMapper.toDto(pc);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public PilotCenter get(Long id) {
        return pilotCenterRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Centre pilote introuvable : " + id));
    }

    @Transactional(readOnly = true)
    public PilotCenterDtos getDto(Long id) {
        PilotCenter pc = get(id);
        initCollections(pc);
        return PilotCenterMapper.toDto(pc);
    }

    // =========================
    // RELATIONS
    // =========================

    /**
     * Règle:
     * - Sector est OWNER des liens sector <-> pilot_center (table sector_pilot_center)
     * - Organism est OWNER des liens organism <-> pilot_center (table organism_pilot_center)
     *
     * ⚠️ Pas de @Transactional ici: self-invocation = pas fiable.
     * La transaction est portée par create/update.
     */
    void applyRelations(PilotCenter pc, PilotCenterDtos dto) {

        // ===== 1) sectorIds -> modifier côté OWNER: Sector.pilotCenters =====
        Set<Long> wantedSectorIds = dto.getSectorIds() == null ? Set.of() : dto.getSectorIds();
        Set<Sector> wantedSectors = wantedSectorIds.isEmpty()
                ? Set.of()
                : new HashSet<>(sectorRepo.findAllById(wantedSectorIds));

        // remove pc from sectors no longer selected (OWNER side)
        for (Sector current : new HashSet<>(pc.getSectors())) {
            if (!wantedSectors.contains(current)) {
                current.getPilotCenters().remove(pc);
                sectorRepo.save(current);
            }
        }

        // add pc to newly selected sectors (OWNER side)
        for (Sector s : wantedSectors) {
            if (!s.getPilotCenters().contains(pc)) {
                s.getPilotCenters().add(pc);
                sectorRepo.save(s);
            }
        }

        // keep inverse side in sync
        pc.getSectors().clear();
        pc.getSectors().addAll(wantedSectors);

        // ===== 2) organismIds -> modifier côté OWNER: Organism.pilotCenters =====
        Set<Long> wantedOrgIds = dto.getOrganismIds() == null ? Set.of() : dto.getOrganismIds();
        Set<Organism> wantedOrgs = wantedOrgIds.isEmpty()
                ? Set.of()
                : new HashSet<>(organismRepo.findAllById(wantedOrgIds));

        // remove pc from old organisms (OWNER side)
        for (Organism org : new HashSet<>(pc.getOrganisms())) {
            if (!wantedOrgs.contains(org)) {
                org.getPilotCenters().remove(pc);
                organismRepo.save(org);
            }
        }

        // add pc to new organisms (OWNER side)
        for (Organism org : wantedOrgs) {
            if (!org.getPilotCenters().contains(pc)) {
                org.getPilotCenters().add(pc);
                organismRepo.save(org);
            }
        }

        // keep inverse side in sync
        pc.getOrganisms().clear();
        pc.getOrganisms().addAll(wantedOrgs);
    }

    private void initCollections(PilotCenter pc) {
        // force init lazy within session
        if (pc.getSectors() != null) pc.getSectors().size();
        if (pc.getOrganisms() != null) pc.getOrganisms().size();
    }

    // =========================================================
    // IMPORT — PREVIEW (parse uniquement, pas de sauvegarde)
    // =========================================================
    public List<PilotCenterDtos.ImportRow> previewImport(MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        List<String[]> rows = filename.endsWith(".xlsx") || filename.endsWith(".xls")
                ? parseXlsx(file)
                : parseCsv(file);

        int dataStart = (!rows.isEmpty() && rows.get(0).length > 0
                && "name".equalsIgnoreCase(rows.get(0)[0].trim())) ? 1 : 0;

        List<PilotCenterDtos.ImportRow> result = new ArrayList<>();
        for (int i = dataStart; i < rows.size(); i++) {
            String[] cols = rows.get(i);
            String name    = cols.length > 0 ? cols[0].trim() : "";
            String cpGroup = cols.length > 1 ? cols[1].trim() : "";
            String desc    = cols.length > 2 ? cols[2].trim() : "";
            if (name.isEmpty()) continue;
            result.add(new PilotCenterDtos.ImportRow(name,
                    cpGroup.isEmpty() ? null : cpGroup,
                    desc.isEmpty()    ? null : desc));
        }
        return result;
    }

    private List<String[]> parseCsv(MultipartFile file) throws IOException {
        List<String[]> result = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) continue;
                result.add(parseCsvLine(line));
            }
        }
        return result;
    }

    private String[] parseCsvLine(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                fields.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        fields.add(current.toString());
        return fields.toArray(new String[0]);
    }

    private List<String[]> parseXlsx(MultipartFile file) throws IOException {
        List<String[]> result = new ArrayList<>();
        try (XSSFWorkbook wb = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);
            for (Row row : sheet) {
                int lastCell = row.getLastCellNum();
                if (lastCell < 0) continue;
                String[] cols = new String[lastCell];
                for (int i = 0; i < lastCell; i++) {
                    Cell cell = row.getCell(i);
                    cols[i] = cell == null ? "" : cell.toString().trim();
                }
                // Si une seule cellule non-vide contenant des virgules → traiter comme ligne CSV
                if (cols.length == 1 && cols[0].contains(",")) {
                    cols = parseCsvLine(cols[0]);
                }
                result.add(cols);
            }
        }
        return result;
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
