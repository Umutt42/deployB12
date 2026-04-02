package com.b12.service;

import com.b12.domain.SubTheme;
import com.b12.domain.Theme;
import com.b12.repository.SubThemeRepository;
import com.b12.repository.ThemeRepository;
import com.b12.web.dto.SubThemeDtos;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SubThemeService {

    private final SubThemeRepository subThemeRepository;
    private final ThemeRepository themeRepository;

    public SubTheme create(SubThemeDtos dto) {
        if (dto.getThemeId() == null) {
            throw new IllegalArgumentException("L'identifiant de la thématique est requis.");
        }

        Theme theme = themeRepository.findById(dto.getThemeId())
                .orElseThrow(() -> new IllegalArgumentException("Thématique introuvable : " + dto.getThemeId()));

        String label = normalize(dto.getName());

        SubTheme subTheme = SubTheme.builder()
                .theme(theme)
                .label(label)
                .description(dto.getDescription())
                .hours(dto.getHours())
                .archived(false)
                .build();

        try {
            return subThemeRepository.save(subTheme);
        } catch (DataIntegrityViolationException e) {
            // contrainte unique (theme_id + label)
            throw new IllegalArgumentException(
                    "Ce sous-thème existe déjà pour cette thématique : " + label
            );
        }
    }

    public List<SubTheme> findByTheme(Long themeId) {
        if (themeId == null) {
            throw new IllegalArgumentException("L'identifiant de la thématique est requis.");
        }
        return subThemeRepository.findByThemeIdOrderByLabelAsc(themeId);
    }

    public SubTheme get(Long id) {
        return subThemeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Sous-thème introuvable : " + id));
    }

    public SubTheme archive(Long id, boolean archived) {
        SubTheme st = get(id);
        st.setArchived(archived);
        return subThemeRepository.save(st);
    }

    public SubTheme update(Long id, SubThemeDtos dto) {
        SubTheme st = get(id);
    
        // Changer éventuellement le thème
        if (dto.getThemeId() != null &&
                !dto.getThemeId().equals(st.getTheme().getId())) {
    
            Theme newTheme = themeRepository.findById(dto.getThemeId())
                    .orElseThrow(() ->
                            new IllegalArgumentException("Thématique introuvable : " + dto.getThemeId()));
            st.setTheme(newTheme);
        }
    
        if (dto.getName() != null) {
            st.setLabel(normalize(dto.getName()));
        }
    
        if (dto.getDescription() != null) {
            st.setDescription(dto.getDescription());
        }
    
        if (dto.getHours() != null) {
            st.setHours(dto.getHours());
        }
    
        // ✅ IMPORTANT : gérer archived
        if (dto.isArchived() != st.isArchived()) {
            st.setArchived(dto.isArchived());
        }
    
        try {
            return subThemeRepository.save(st);
        } catch (DataIntegrityViolationException e) {
            throw new IllegalArgumentException(
                    "Ce sous-thème existe déjà pour cette thématique : " + st.getLabel()
            );
        }
    }
    

    // =========================================================
    // IMPORT — PREVIEW (parse uniquement, pas de sauvegarde)
    // =========================================================
    public List<SubThemeDtos.ImportRow> previewImport(MultipartFile file) throws IOException {

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        List<String[]> rows = filename.endsWith(".xlsx") || filename.endsWith(".xls")
                ? parseXlsx(file)
                : parseCsv(file);

        int dataStart = (!rows.isEmpty() && rows.get(0).length > 0
                && "name".equalsIgnoreCase(rows.get(0)[0].trim())) ? 1 : 0;

        List<SubThemeDtos.ImportRow> result = new ArrayList<>();
        for (int i = dataStart; i < rows.size(); i++) {
            String[] cols = rows.get(i);
            String name     = cols.length > 0 ? cols[0].trim() : "";
            String desc     = cols.length > 1 ? cols[1].trim() : "";
            String hoursStr = cols.length > 2 ? cols[2].trim() : "";
            if (name.isEmpty()) continue;

            Integer hours = null;
            if (!hoursStr.isEmpty()) {
                try { hours = (int) Math.round(Double.parseDouble(hoursStr.replace(",", "."))); }
                catch (NumberFormatException ignored) {}
            }
            result.add(new SubThemeDtos.ImportRow(name, desc.isEmpty() ? null : desc, hours));
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

    private String normalize(String s) {
        if (s == null || s.trim().isEmpty()) {
            throw new IllegalArgumentException("Le nom du sous-thème est requis.");
        }
        return s.trim();
    }
    public void delete(Long id) {
        SubTheme st = get(id);
    
        // Optionnel: empêcher suppression si pas archivé (sécurité admin)
        // if (!st.isArchived()) {
        //     throw new IllegalArgumentException("Impossible de supprimer un sous-thème non archivé.");
        // }
    
        subThemeRepository.delete(st);
    }
    
}
