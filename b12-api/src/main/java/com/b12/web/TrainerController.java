package com.b12.web;

import com.b12.domain.Organism;
import com.b12.domain.Trainer;
import com.b12.domain.TrainingAccreditation;
import com.b12.domain.TrainingCenter;
import com.b12.export.ExportFile;
import com.b12.export.ExportFormat;
import com.b12.export.ExportService;
import com.b12.repository.OrganismRepository;
import com.b12.repository.TrainerRepository;
import com.b12.repository.TrainingAccreditationRepository;
import com.b12.security.SecurityUtils;
import com.b12.web.dto.TrainerDtos;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/trainers")
@RequiredArgsConstructor
public class TrainerController {

    private final TrainerRepository trainerRepo;
    private final TrainingAccreditationRepository trainingAccreditationRepo;
    private final OrganismRepository organismRepo;
    private final ExportService exportService;

    @GetMapping
    @Transactional(readOnly = true)
    public List<TrainerDtos> getAll() {
        // Reverse-lookup ManyToMany : trainerId → Set<TrainingAccreditation>
        Map<Long, Set<TrainingAccreditation>> taByTrainer = new HashMap<>();
        for (TrainingAccreditation ta : trainingAccreditationRepo.findAllWithTrainers()) {
            for (Trainer tr : ta.getTrainers()) {
                taByTrainer.computeIfAbsent(tr.getId(), k -> new HashSet<>()).add(ta);
            }
        }
        return trainerRepo.findByArchivedFalseWithRelations().stream()
                .map(t -> toDto(t, taByTrainer.getOrDefault(t.getId(), Set.of())))
                .toList();
    }

    @GetMapping("/by-center-accreditation/{centerAccreditationId}")
    @Transactional(readOnly = true)
    public List<TrainerDtos> getByCenterAccreditation(@PathVariable Long centerAccreditationId) {
        List<Trainer> trainers = trainerRepo.findByCenterAccreditationId(centerAccreditationId);
        Map<Long, Set<TrainingAccreditation>> taByTrainer = new HashMap<>();
        for (TrainingAccreditation ta : trainingAccreditationRepo.findAllWithTrainers()) {
            for (Trainer tr : ta.getTrainers()) {
                taByTrainer.computeIfAbsent(tr.getId(), k -> new HashSet<>()).add(ta);
            }
        }
        return trainers.stream()
                .map(t -> toDto(t, taByTrainer.getOrDefault(t.getId(), Set.of())))
                .toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public TrainerDtos get(@PathVariable Long id) {
        Trainer t = trainerRepo.findByIdWithRelations(id)
                .orElseThrow(() -> new IllegalArgumentException("Formateur introuvable : " + id));
        Set<TrainingAccreditation> linked = new HashSet<>(trainingAccreditationRepo.findByTrainer(t));
        return toDto(t, linked);
    }

    @PostMapping
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public TrainerDtos create(@RequestBody TrainerDtos dto) {
        Trainer t = new Trainer();
        applyDto(dto, t);
        t.setArchived(false);
        t.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        Trainer saved = trainerRepo.save(t);
        syncAccreditationLinks(saved, dto.getTrainingAccreditationIds());
        Set<TrainingAccreditation> linked = new HashSet<>(trainingAccreditationRepo.findByTrainer(saved));
        return toDto(saved, linked);
    }

    @PutMapping("/{id}")
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public TrainerDtos update(@PathVariable Long id, @RequestBody TrainerDtos dto) {
        Trainer t = trainerRepo.findByIdWithRelations(id)
                .orElseThrow(() -> new IllegalArgumentException("Formateur introuvable : " + id));
        applyDto(dto, t);
        t.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        Trainer saved = trainerRepo.save(t);
        syncAccreditationLinks(saved, dto.getTrainingAccreditationIds());
        Set<TrainingAccreditation> linked = new HashSet<>(trainingAccreditationRepo.findByTrainer(saved));
        return toDto(saved, linked);
    }

    @PatchMapping("/{id}/archive")
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public TrainerDtos archive(@PathVariable Long id, @RequestParam boolean archived) {
        Trainer t = trainerRepo.findByIdWithRelations(id)
                .orElseThrow(() -> new IllegalArgumentException("Formateur introuvable : " + id));
        t.setArchived(archived);
        t.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());
        return toDto(trainerRepo.save(t), Set.of());
    }

    @DeleteMapping("/{id}")
    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public void delete(@PathVariable Long id) {
        trainerRepo.delete(trainerRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Formateur introuvable : " + id)));
    }

    // ─── Export ──────────────────────────────────────────────────

    @GetMapping("/export")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> exportAll(
            @RequestParam String format,
            @RequestParam(required = false, defaultValue = "false") boolean includeArchived
    ) {
        ExportFormat exportFormat = ExportFormat.from(format);
        List<TrainerDtos> rows = buildTrainerDtos(includeArchived);
        ExportFile file = exportService.exportTrainers(exportFormat, rows, "trainers");
        return buildExportResponse(file);
    }

    @PostMapping("/export")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> exportSelected(
            @RequestParam String format,
            @RequestBody List<Long> ids
    ) {
        ExportFormat exportFormat = ExportFormat.from(format);
        Map<Long, Set<TrainingAccreditation>> taByTrainer = new HashMap<>();
        for (TrainingAccreditation ta : trainingAccreditationRepo.findAllWithTrainers()) {
            for (Trainer tr : ta.getTrainers()) {
                taByTrainer.computeIfAbsent(tr.getId(), k -> new HashSet<>()).add(ta);
            }
        }
        List<TrainerDtos> rows = trainerRepo.findAllById(ids).stream()
                .map(t -> toDto(t, taByTrainer.getOrDefault(t.getId(), Set.of())))
                .toList();
        ExportFile file = exportService.exportTrainers(exportFormat, rows, "trainers-selection");
        return buildExportResponse(file);
    }

    private List<TrainerDtos> buildTrainerDtos(boolean includeArchived) {
        Map<Long, Set<TrainingAccreditation>> taByTrainer = new HashMap<>();
        for (TrainingAccreditation ta : trainingAccreditationRepo.findAllWithTrainers()) {
            for (Trainer tr : ta.getTrainers()) {
                taByTrainer.computeIfAbsent(tr.getId(), k -> new HashSet<>()).add(ta);
            }
        }
        List<Trainer> trainers = includeArchived
                ? trainerRepo.findAllWithRelations()
                : trainerRepo.findByArchivedFalseWithRelations();
        return trainers.stream()
                .map(t -> toDto(t, taByTrainer.getOrDefault(t.getId(), Set.of())))
                .toList();
    }

    private static ResponseEntity<byte[]> buildExportResponse(ExportFile file) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + file.filename())
                .header(HttpHeaders.CONTENT_TYPE, file.contentType())
                .body(file.bytes());
    }

    // ─── Import preview ──────────────────────────────────────────

    @PostMapping("/import/preview")
    @PreAuthorize("hasRole('ADMIN')")
    public List<TrainerDtos.ImportRow> previewImport(
            @RequestParam("file") MultipartFile file) throws IOException {

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        List<String[]> rows = filename.endsWith(".xlsx") || filename.endsWith(".xls")
                ? parseXlsx(file)
                : parseCsv(file);

        // Skip header if first cell matches a known header keyword
        String firstCell = (!rows.isEmpty() && rows.get(0).length > 0) ? rows.get(0)[0].trim().toLowerCase() : "";
        int dataStart = (firstCell.equals("firstname") || firstCell.equals("prénom") || firstCell.equals("prenom")) ? 1 : 0;

        List<TrainerDtos.ImportRow> result = new ArrayList<>();
        for (int i = dataStart; i < rows.size(); i++) {
            String[] cols = rows.get(i);
            String firstName         = cols.length > 0 ? cols[0].trim() : "";
            String lastName          = cols.length > 1 ? cols[1].trim() : "";
            String email             = cols.length > 2 ? cols[2].trim() : "";
            String phone             = cols.length > 3 ? cols[3].trim() : "";
            String phytolicenceNumber = cols.length > 4 ? cols[4].trim() : "";
            if (firstName.isEmpty() && lastName.isEmpty()) continue;
            result.add(new TrainerDtos.ImportRow(
                    firstName.isEmpty() ? null : firstName,
                    lastName.isEmpty() ? null : lastName,
                    email.isEmpty() ? null : email,
                    phone.isEmpty() ? null : phone,
                    phytolicenceNumber.isEmpty() ? null : phytolicenceNumber
            ));
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
                current = new StringBuilder();
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

    // ─── Helpers ─────────────────────────────────────────────────

    private void applyDto(TrainerDtos dto, Trainer t) {
        t.setFirstName(dto.getFirstName());
        t.setLastName(dto.getLastName());
        t.setEmail(nullIfBlank(dto.getEmail()));
        t.setPhone(nullIfBlank(dto.getPhone()));
        t.setPhytolicenceNumber(nullIfBlank(dto.getPhytolicenceNumber()));
        t.setComment(nullIfBlank(dto.getComment()));

        // Agrément formation : FK supprimée, gérée via ManyToMany uniquement
        t.setTrainingAccreditation(null);

        // Organismes partenaires (ManyToMany)
        Set<Long> orgIds = dto.getPartnerOrganismIds() != null ? dto.getPartnerOrganismIds() : Set.of();
        if (orgIds.isEmpty()) {
            t.setPartnerOrganisms(new HashSet<>());
        } else {
            List<Organism> orgs = organismRepo.findAllById(orgIds);
            t.setPartnerOrganisms(new HashSet<>(orgs));
        }
    }

    /** Synchronise les liens ManyToMany Trainer ↔ TrainingAccreditation. */
    private void syncAccreditationLinks(Trainer trainer, Set<Long> newAccreditationIds) {
        Set<Long> newIds = newAccreditationIds != null ? new HashSet<>(newAccreditationIds) : new HashSet<>();
        List<TrainingAccreditation> currentlyLinked = trainingAccreditationRepo.findByTrainer(trainer);
        Set<Long> currentIds = currentlyLinked.stream().map(TrainingAccreditation::getId).collect(Collectors.toSet());

        for (TrainingAccreditation ta : currentlyLinked) {
            if (!newIds.contains(ta.getId())) {
                ta.getTrainers().removeIf(tr -> tr.getId().equals(trainer.getId()));
                trainingAccreditationRepo.save(ta);
            }
        }
        for (Long accId : newIds) {
            if (!currentIds.contains(accId)) {
                TrainingAccreditation ta = trainingAccreditationRepo.findById(accId)
                        .orElseThrow(() -> new IllegalArgumentException("Agrément formation introuvable : " + accId));
                ta.getTrainers().add(trainer);
                trainingAccreditationRepo.save(ta);
            }
        }
    }

    private TrainerDtos toDto(Trainer t, Set<TrainingAccreditation> linkedAccreditations) {
        TrainerDtos dto = new TrainerDtos();
        dto.setId(t.getId());
        dto.setFirstName(t.getFirstName());
        dto.setLastName(t.getLastName());
        dto.setEmail(t.getEmail());
        dto.setPhone(t.getPhone());
        dto.setPhytolicenceNumber(t.getPhytolicenceNumber());
        dto.setComment(t.getComment());
        dto.setArchived(t.isArchived());

        // Agrément FK (pour le formulaire de modification du formateur)
        if (t.getTrainingAccreditation() != null) {
            dto.setTrainingAccreditationId(t.getTrainingAccreditation().getId());
            String label = t.getTrainingAccreditation().getTitle();
            if (t.getTrainingAccreditation().getAccreditationNumber() != null) {
                label = t.getTrainingAccreditation().getAccreditationNumber() + " — " + label;
            }
            dto.setTrainingAccreditationLabel(label);
        }

        // Agréments formation liés (FK + ManyToMany fusionnés) — pour la liste
        Set<TrainingAccreditation> allLinked = new HashSet<>(linkedAccreditations);
        if (t.getTrainingAccreditation() != null) allLinked.add(t.getTrainingAccreditation());
        if (!allLinked.isEmpty()) {
            dto.setTrainingAccreditationIds(allLinked.stream().map(TrainingAccreditation::getId).collect(Collectors.toSet()));
            dto.setTrainingAccreditationLabels(allLinked.stream().map(ta -> {
                String label = ta.getTitle();
                if (ta.getAccreditationNumber() != null) label = ta.getAccreditationNumber() + " — " + label;
                return label;
            }).collect(Collectors.toSet()));
        } else {
            dto.setTrainingAccreditationIds(Set.of());
            dto.setTrainingAccreditationLabels(Set.of());
        }

        if (t.getPartnerOrganisms() != null && !t.getPartnerOrganisms().isEmpty()) {
            dto.setPartnerOrganismIds(t.getPartnerOrganisms().stream().map(Organism::getId).collect(Collectors.toSet()));
            dto.setPartnerOrganismLabels(t.getPartnerOrganisms().stream().map(Organism::getName).collect(Collectors.toSet()));
        } else {
            dto.setPartnerOrganismIds(Set.of());
            dto.setPartnerOrganismLabels(Set.of());
        }

        // Centres de formation (via agrément formation → agrément centre → centre)
        Set<Long> tcIds = new HashSet<>();
        Set<String> tcLabels = new HashSet<>();
        for (TrainingAccreditation ta : allLinked) {
            if (ta.getCenterAccreditation() != null && ta.getCenterAccreditation().getTrainingCenter() != null) {
                TrainingCenter tc = ta.getCenterAccreditation().getTrainingCenter();
                if (tc.getId() != null) {
                    tcIds.add(tc.getId());
                    tcLabels.add(tc.getName());
                }
            }
        }
        dto.setTrainingCenterIds(tcIds);
        dto.setTrainingCenterLabels(tcLabels);

        dto.setCreatedAt(t.getCreatedAt());
        dto.setUpdatedAt(t.getUpdatedAt());
        dto.setCreatedBy(t.getCreatedBy());
        dto.setUpdatedBy(t.getUpdatedBy());
        return dto;
    }

    private String nullIfBlank(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
