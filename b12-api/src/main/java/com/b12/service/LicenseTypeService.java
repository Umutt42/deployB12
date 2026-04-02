package com.b12.service;

import com.b12.domain.LicenseType;
import com.b12.repository.LicenseTypeRepository;
import com.b12.security.SecurityUtils;
import com.b12.web.dto.LicenseTypeDtos;
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
import java.util.List;

import static com.b12.web.dto.LicenseTypeDtos.*;

@Service
@RequiredArgsConstructor
@Transactional
public class LicenseTypeService {

    private final LicenseTypeRepository repo;

    // =========================================================
    // CREATE
    // =========================================================
    public View create(Create dto) {

        String code = normalize(dto.code());

        if (repo.existsByCodeIgnoreCase(code)) {
            throw new IllegalArgumentException("Ce code de phytolicence existe déjà : " + code);
        }

        LicenseType saved = repo.save(LicenseType.builder()
                .code(code)
                .label(normalize(dto.label()))
                .description(trimOrNull(dto.description()))
                .archived(false)
                // ✅ audit
                .updatedBy(SecurityUtils.currentUserEmailOrSystem())
                .build());

        return toView(saved);
    }

    // =========================================================
    // LIST (avec filtre local archived)
    // =========================================================
    @Transactional(readOnly = true)
    public List<View> list(Boolean archived) {
        return repo.findAll().stream()
                .filter(x -> archived == null || x.isArchived() == archived)
                .map(this::toView)
                .toList();
    }

    // =========================================================
    // GET ONE
    // =========================================================
    @Transactional(readOnly = true)
    public View get(Long id) {
        LicenseType lt = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Type de phytolicence introuvable : " + id));
        return toView(lt);
    }

    // =========================================================
    // UPDATE
    // =========================================================
    public View update(Long id, Update dto) {

        LicenseType lt = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Type de phytolicence introuvable : " + id));

        lt.setLabel(normalize(dto.label()));
        lt.setDescription(trimOrNull(dto.description()));
        lt.setArchived(dto.archived());

        // ✅ audit
        lt.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());

        // pas obligatoire ici car lt est managé (transactional),
        // mais on peut save explicitement pour être safe + cohérent
        lt = repo.save(lt);

        return toView(lt);
    }

    // =========================================================
    // ARCHIVE / UNARCHIVE
    // =========================================================
    public View archive(Long id, boolean archived) {

        LicenseType entity = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Type de phytolicence introuvable : " + id));

        entity.setArchived(archived);

        // ✅ audit
        entity.setUpdatedBy(SecurityUtils.currentUserEmailOrSystem());

        entity = repo.save(entity);

        return toView(entity);
    }

    // =========================================================
    // DELETE
    // =========================================================
    public void delete(Long id) {
        if (!repo.existsById(id)) {
            throw new IllegalArgumentException("Type de phytolicence introuvable : " + id);
        }
        repo.deleteById(id);
    }

    // =========================================================
    // EXPORT HELPERS
    // =========================================================
    @Transactional(readOnly = true)
    public List<View> listAll() {
        return repo.findAll().stream()
                .map(this::toView)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<View> listByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return repo.findAllById(ids).stream()
                .map(this::toView)
                .toList();
    }

    // =========================================================
    // IMPORT — PREVIEW (parse uniquement, pas de sauvegarde)
    // =========================================================
    @Transactional(readOnly = true)
    public List<LicenseTypeDtos.ImportRow> previewImport(MultipartFile file) throws IOException {

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        List<String[]> rows = filename.endsWith(".xlsx") || filename.endsWith(".xls")
                ? parseXlsx(file)
                : parseCsv(file);

        int dataStart = (!rows.isEmpty() && rows.get(0).length > 0
                && "code".equalsIgnoreCase(rows.get(0)[0].trim())) ? 1 : 0;

        List<LicenseTypeDtos.ImportRow> result = new ArrayList<>();
        for (int i = dataStart; i < rows.size(); i++) {
            String[] cols = rows.get(i);
            String code  = cols.length > 0 ? cols[0].trim() : "";
            String label = cols.length > 1 ? cols[1].trim() : "";
            String desc  = cols.length > 2 ? cols[2].trim() : "";
            if (code.isEmpty() && label.isEmpty()) continue;
            result.add(new LicenseTypeDtos.ImportRow(code, label, desc.isEmpty() ? null : desc));
        }
        return result;
    }

    // =========================================================
    // IMPORT CSV / XLSX
    // =========================================================
    public LicenseTypeDtos.ImportResult importFile(MultipartFile file) throws IOException {

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        List<String[]> rows = filename.endsWith(".xlsx") || filename.endsWith(".xls")
                ? parseXlsx(file)
                : parseCsv(file);

        int dataStart = (!rows.isEmpty() && rows.get(0).length > 0
                && "code".equalsIgnoreCase(rows.get(0)[0].trim())) ? 1 : 0;

        int total = 0, created = 0, skipped = 0;
        List<LicenseTypeDtos.ImportError> errors = new ArrayList<>();

        for (int i = dataStart; i < rows.size(); i++) {
            String[] cols = rows.get(i);
            int rowNum = i + 1;

            String code  = cols.length > 0 ? cols[0].trim() : "";
            String label = cols.length > 1 ? cols[1].trim() : "";
            String desc  = cols.length > 2 ? cols[2].trim() : "";

            if (code.isEmpty() && label.isEmpty()) continue;
            total++;

            if (code.isEmpty())         { errors.add(new LicenseTypeDtos.ImportError(rowNum, "Code manquant"));           continue; }
            if (label.isEmpty())        { errors.add(new LicenseTypeDtos.ImportError(rowNum, "Label manquant"));          continue; }
            if (code.length()  > 20)    { errors.add(new LicenseTypeDtos.ImportError(rowNum, "Code trop long (max 20)")); continue; }
            if (label.length() > 120)   { errors.add(new LicenseTypeDtos.ImportError(rowNum, "Label trop long (max 120)")); continue; }

            if (repo.existsByCodeIgnoreCase(code)) { skipped++; continue; }

            repo.save(LicenseType.builder()
                    .code(code)
                    .label(label)
                    .description(desc.isEmpty() ? null : desc)
                    .archived(false)
                    .updatedBy(SecurityUtils.currentUserEmailOrSystem())
                    .build());
            created++;
        }

        return new LicenseTypeDtos.ImportResult(total, created, skipped, errors);
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
                result.add(cols);
            }
        }
        return result;
    }

    // =========================================================
    // MAPPING
    // =========================================================
    private View toView(LicenseType lt) {
        return new View(
                lt.getId(),
                lt.getCode(),
                lt.getLabel(),
                lt.getDescription(),
                lt.isArchived(),
                lt.getCreatedAt(),
                lt.getUpdatedAt(),
                // ✅ new field
                lt.getUpdatedBy()
        );
    }

    // =========================================================
    // UTILS
    // =========================================================
    private String normalize(String s) {
        if (s == null || s.trim().isEmpty()) {
            throw new IllegalArgumentException("La valeur est requise.");
        }
        return s.trim();
    }

    private String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
