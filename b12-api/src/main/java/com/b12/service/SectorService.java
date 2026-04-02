package com.b12.service;

import com.b12.domain.Organism;
import com.b12.domain.PilotCenter;
import com.b12.domain.Sector;
import com.b12.repository.OrganismRepository;
import com.b12.repository.PilotCenterRepository;
import com.b12.repository.SectorRepository;
import com.b12.security.SecurityUtils;
import com.b12.web.dto.SectorDtos;
import com.b12.web.dto.SectorMapper;
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
public class SectorService {

    private final SectorRepository sectorRepo;
    private final OrganismRepository organismRepo;
    private final PilotCenterRepository pilotCenterRepo;

    /* =========================
       DTO-safe public API
    ========================= */

    @Transactional
    public SectorDtos createDto(SectorDtos dto) {
        Sector saved = create(dto);
        initCollections(saved);
        return SectorMapper.toDto(saved);
    }

    @Transactional(readOnly = true)
    public List<SectorDtos> findAll() {
        List<Sector> list = sectorRepo.findAll();
        list.forEach(this::initCollections);
        return list.stream().map(SectorMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public SectorDtos getDto(Long id) {
        Sector s = get(id);
        initCollections(s);
        return SectorMapper.toDto(s);
    }

    @Transactional(readOnly = true)
    public List<SectorDtos> findAllByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        List<Sector> list = sectorRepo.findAllById(ids);
        list.forEach(this::initCollections);
        return list.stream().map(SectorMapper::toDto).toList();
    }

    @Transactional
    public SectorDtos updateDto(Long id, SectorDtos dto) {
        Sector saved = update(id, dto);
        initCollections(saved);
        return SectorMapper.toDto(saved);
    }

    @Transactional
    public SectorDtos archiveDto(Long id, boolean archived) {
        Sector saved = archive(id, archived);
        initCollections(saved);
        return SectorMapper.toDto(saved);
    }

    /* =========================
       Domain methods (entities)
    ========================= */

    @Transactional
    public Sector create(SectorDtos dto) {
        String name = normalizeRequired(dto.getName(), "Le nom du secteur est requis.");

        sectorRepo.findByNameIgnoreCase(name).ifPresent(x -> {
            throw new IllegalArgumentException("Ce secteur existe déjà : " + name);
        });

        Sector s = Sector.builder()
                .name(name)
                .description(normalizeOptional(dto.getDescription()))
                .archived(false)
                .build();

        s.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        s = sectorRepo.save(s);

        applyRelations(s, dto);

        s.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        return sectorRepo.save(s);
    }

    @Transactional(readOnly = true)
    public Sector get(Long id) {
        return sectorRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Secteur introuvable : " + id));
    }

    @Transactional
    public Sector update(Long id, SectorDtos dto) {
        Sector s = get(id);

        String newName = normalizeRequired(dto.getName(), "Le nom du secteur est requis.");
        if (!s.getName().equalsIgnoreCase(newName)) {
            sectorRepo.findByNameIgnoreCase(newName).ifPresent(existing -> {
                throw new IllegalArgumentException("Ce secteur existe déjà : " + newName);
            });
            s.setName(newName);
        }

        s.setDescription(normalizeOptional(dto.getDescription()));
        s.setArchived(dto.isArchived());

        applyRelations(s, dto);

        s.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        return sectorRepo.save(s);
    }

    @Transactional
    public Sector archive(Long id, boolean archived) {
        Sector s = get(id);
        s.setArchived(archived);
        s.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        return sectorRepo.save(s);
    }

    @Transactional
    public void delete(Long id) {
        sectorRepo.delete(get(id));
    }

    /**
     * Sector est OWNER des deux relations :
     * - sector_organism (Sector.organisms)
     * - sector_pilot_center (Sector.pilotCenters)
     *
     * On met à jour le côté owner + on synchronise le côté inverse en mémoire
     * uniquement à partir des relations actuelles (pas de findAll()).
     */
    @Transactional
    void applyRelations(Sector s, SectorDtos dto) {

        // ===== organisms =====
        Set<Long> wantedOrgIds = dto.getOrganismIds() == null ? Set.of() : dto.getOrganismIds();
        Set<Organism> wantedOrgs = wantedOrgIds.isEmpty()
                ? Set.of()
                : new HashSet<>(organismRepo.findAllById(wantedOrgIds));

        // remove inverse from orgs no longer selected (from current state)
        for (Organism current : new HashSet<>(s.getOrganisms())) {
            if (!wantedOrgs.contains(current)) {
                current.getSectors().remove(s);
            }
        }

        // add inverse for newly selected
        for (Organism o : wantedOrgs) {
            o.getSectors().add(s);
        }

        // update OWNER side
        s.getOrganisms().clear();
        s.getOrganisms().addAll(wantedOrgs);

        // ===== pilot centers =====
        Set<Long> wantedPcIds = dto.getPilotCenterIds() == null ? Set.of() : dto.getPilotCenterIds();
        Set<PilotCenter> wantedPcs = wantedPcIds.isEmpty()
                ? Set.of()
                : new HashSet<>(pilotCenterRepo.findAllById(wantedPcIds));

        // remove inverse from pcs no longer selected (from current state)
        for (PilotCenter current : new HashSet<>(s.getPilotCenters())) {
            if (!wantedPcs.contains(current)) {
                current.getSectors().remove(s);
            }
        }

        // add inverse for newly selected
        for (PilotCenter pc : wantedPcs) {
            pc.getSectors().add(s);
        }

        // update OWNER side
        s.getPilotCenters().clear();
        s.getPilotCenters().addAll(wantedPcs);
    }

    /* =========================
       Lazy init protection
    ========================= */

    private void initCollections(Sector s) {
        if (s == null) return;

        if (s.getOrganisms() != null) {
            s.getOrganisms().size();
        }
        if (s.getPilotCenters() != null) {
            s.getPilotCenters().size();
        }
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

    // =========================================================
    // IMPORT — PREVIEW (parse uniquement, pas de sauvegarde)
    // =========================================================
    public List<SectorDtos.ImportRow> previewImport(MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        List<String[]> rows = filename.endsWith(".xlsx") || filename.endsWith(".xls")
                ? parseXlsx(file)
                : parseCsv(file);

        int dataStart = (!rows.isEmpty() && rows.get(0).length > 0
                && "name".equalsIgnoreCase(rows.get(0)[0].trim())) ? 1 : 0;

        List<SectorDtos.ImportRow> result = new ArrayList<>();
        for (int i = dataStart; i < rows.size(); i++) {
            String[] cols = rows.get(i);
            String name = cols.length > 0 ? cols[0].trim() : "";
            String desc = cols.length > 1 ? cols[1].trim() : "";
            if (name.isEmpty()) continue;
            result.add(new SectorDtos.ImportRow(name, desc.isEmpty() ? null : desc));
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
                if (cols.length == 1 && cols[0].contains(",")) {
                    cols = parseCsvLine(cols[0]);
                }
                result.add(cols);
            }
        }
        return result;
    }
}
