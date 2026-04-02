package com.b12.service;

import com.b12.domain.Organism;
import com.b12.domain.PilotCenter;
import com.b12.domain.Sector;
import com.b12.repository.OrganismRepository;
import com.b12.repository.PilotCenterRepository;
import com.b12.repository.SectorRepository;
import com.b12.security.SecurityUtils;
import com.b12.web.dto.OrganismDtos;
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
public class OrganismService {

    private final OrganismRepository organismRepo;
    private final SectorRepository sectorRepo;
    private final PilotCenterRepository pilotCenterRepo;

    /**
     * IMPORTANT:
     * - On garde la transaction ouverte pendant toute la création + gestion relations,
     *   sinon Hibernate peut jeter LazyInitializationException (no session).
     */
    @Transactional
    public Organism create(OrganismDtos dto) {
        String name = normalizeRequired(dto.getName(), "Le nom de l'organisme est requis.");

        organismRepo.findByNameIgnoreCase(name).ifPresent(x -> {
            throw new IllegalArgumentException("Cet organisme existe déjà : " + name);
        });

        Organism o = Organism.builder()
                .name(name)
                .abbreviation(normalizeOptional(dto.getAbbreviation()))
                .archived(false)
                .build();

        o.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        o = organismRepo.save(o); // id dispo si besoin

        applyRelations(o, dto);

        o.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        o = organismRepo.save(o);

        // Optionnel: si ton mapper/DTO touche aux collections lazy juste après, on les initialise ici.
        initCollections(o);

        return o;
    }

    @Transactional(readOnly = true)
    public List<com.b12.web.dto.OrganismDtos> findAll() {
        return organismRepo.findAll().stream()
                .map(com.b12.web.dto.OrganismMapper::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public Organism get(Long id) {
        return organismRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Organisme introuvable : " + id));
    }

    /**
     * IMPORTANT:
     * - Transaction ouverte pendant update + relations, sinon LazyInitializationException possible.
     */
    @Transactional
    public Organism update(Long id, OrganismDtos dto) {
        Organism o = get(id);

        String newName = normalizeRequired(dto.getName(), "Le nom de l'organisme est requis.");
        if (!o.getName().equalsIgnoreCase(newName)) {
            organismRepo.findByNameIgnoreCase(newName).ifPresent(existing -> {
                throw new IllegalArgumentException("Cet organisme existe déjà : " + newName);
            });
            o.setName(newName);
        }

        o.setAbbreviation(normalizeOptional(dto.getAbbreviation()));
        o.setArchived(dto.isArchived());

        applyRelations(o, dto);

        o.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        o = organismRepo.save(o);

        initCollections(o);
        return o;
    }

    @Transactional
    public Organism archive(Long id, boolean archived) {
        Organism o = get(id);
        o.setArchived(archived);
        o.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        o = organismRepo.save(o);
        initCollections(o);
        return o;
    }

    @Transactional
    public void delete(Long id) {
        organismRepo.delete(get(id));
    }

    /**
     * Règle:
     * - Sector est OWNER des liens sector <-> organism (table sector_organism)
     * - Organism est OWNER des liens organism <-> pilot_center (table organism_pilot_center)
     *
     * IMPORTANT:
     * - Ne PAS toucher à pc.getOrganisms() (mappedBy) ici => ça force souvent du LAZY
     *   et ce n'est pas nécessaire pour persister la relation (owner = Organism.pilotCenters).
     */
    void applyRelations(Organism o, OrganismDtos dto) {

        // ===== 1) sectorIds -> modifier côté OWNER: Sector.organisms =====
        Set<Long> wantedSectorIds = dto.getSectorIds() == null ? Set.of() : dto.getSectorIds();
        Set<Sector> wantedSectors = wantedSectorIds.isEmpty()
                ? Set.of()
                : new HashSet<>(sectorRepo.findAllById(wantedSectorIds));

        // remove organism from sectors no longer selected (OWNER side)
        for (Sector current : new HashSet<>(o.getSectors())) {
            if (!wantedSectors.contains(current)) {
                current.getOrganisms().remove(o);
                sectorRepo.save(current);
            }
        }

        // add organism to newly selected sectors (OWNER side)
        for (Sector s : wantedSectors) {
            if (!s.getOrganisms().contains(o)) {
                s.getOrganisms().add(o);
                sectorRepo.save(s);
            }
        }

        // keep inverse side in sync (in-memory)
        o.getSectors().clear();
        o.getSectors().addAll(wantedSectors);

        // ===== 2) pilotCenterIds -> modifier côté OWNER: Organism.pilotCenters =====
        Set<Long> wantedPcIds = dto.getPilotCenterIds() == null ? Set.of() : dto.getPilotCenterIds();
        Set<PilotCenter> wantedPcs = wantedPcIds.isEmpty()
                ? Set.of()
                : new HashSet<>(pilotCenterRepo.findAllById(wantedPcIds));

        // clear and set on OWNER side (suffisant pour persister la relation)
        o.getPilotCenters().clear();
        o.getPilotCenters().addAll(wantedPcs);

        // ❌ On ne fait PAS:
        // pc.getOrganisms().add/remove => mappedBy + LAZY + pas nécessaire pour sauver.
    }

    /**
     * Évite les surprises si un mapper/DTO accède aux collections après retour service.
     * (Ça ne change rien côté DB, c'est juste une init en mémoire.)
     */
    private void initCollections(Organism o) {
        if (o == null) return;
        // touch collections to initialize within transaction
        o.getSectors().size();
        o.getPilotCenters().size();
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
    @Transactional(readOnly = true)
    public List<com.b12.web.dto.OrganismDtos> findAllByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return organismRepo.findAllById(ids).stream()
                .map(com.b12.web.dto.OrganismMapper::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
public OrganismDtos getDto(Long id) {
    Organism o = organismRepo.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Organisme introuvable : " + id));

    // init LAZY dans la transaction
    o.getSectors().size();
    o.getPilotCenters().size();

    return com.b12.web.dto.OrganismMapper.toDto(o);
}

    // =========================================================
    // IMPORT — PREVIEW (parse uniquement, pas de sauvegarde)
    // =========================================================
    public List<OrganismDtos.ImportRow> previewImport(MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        List<String[]> rows = filename.endsWith(".xlsx") || filename.endsWith(".xls")
                ? parseXlsx(file)
                : parseCsv(file);

        int dataStart = (!rows.isEmpty() && rows.get(0).length > 0
                && "name".equalsIgnoreCase(rows.get(0)[0].trim())) ? 1 : 0;

        List<OrganismDtos.ImportRow> result = new ArrayList<>();
        for (int i = dataStart; i < rows.size(); i++) {
            String[] cols = rows.get(i);
            String name  = cols.length > 0 ? cols[0].trim() : "";
            String abbr  = cols.length > 1 ? cols[1].trim() : "";
            if (name.isEmpty()) continue;
            result.add(new OrganismDtos.ImportRow(name, abbr.isEmpty() ? null : abbr));
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

}
