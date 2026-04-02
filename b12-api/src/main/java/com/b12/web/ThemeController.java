package com.b12.web;

import com.b12.export.ExportFile;
import com.b12.export.ExportFormat;
import com.b12.export.ExportService;
import com.b12.service.ThemeService;
import com.b12.web.dto.ThemeDtos;
import com.b12.web.dto.ThemeMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/themes")
@RequiredArgsConstructor
public class ThemeController {

    private final ThemeService themeService;
    private final ExportService exportService;

    // =========================
    // CREATE
    // =========================
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ThemeDtos create(@RequestBody ThemeDtos dto) {
        return ThemeMapper.toDto(themeService.create(dto));
    }

    // =========================
    // LIST
    // =========================
    @GetMapping
    public List<ThemeDtos> findAll() {
        return themeService.findAll();
    }

    // =========================
    // GET ONE
    // =========================
    @GetMapping("/{id}")
    public ThemeDtos get(@PathVariable Long id) {
        return ThemeMapper.toDto(themeService.get(id));
    }

    // =========================
    // UPDATE
    // =========================
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ThemeDtos update(@PathVariable Long id, @RequestBody ThemeDtos dto) {
        return ThemeMapper.toDto(themeService.update(id, dto));
    }

    // =========================
    // ARCHIVE / UNARCHIVE
    // =========================
    @PatchMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public ThemeDtos archive(
            @PathVariable Long id,
            @RequestParam boolean archived
    ) {
        return ThemeMapper.toDto(themeService.archive(id, archived));
    }

    // =========================
    // DELETE
    // =========================
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public void delete(@PathVariable Long id) {
        themeService.delete(id);
    }

    // =========================================================
    // EXPORT GLOBAL (toute la table)
    // GET /api/themes/export?format=csv|xlsx|pdf
    // =========================================================
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportAll(
            @RequestParam String format,
            @RequestParam(required = false, defaultValue = "false") boolean includeArchived
    ) {
        ExportFormat exportFormat = ExportFormat.from(format);

        List<ThemeDtos> rows = themeService.findAll();
        if (!includeArchived) rows = rows.stream().filter(r -> !r.isArchived()).toList();

        ExportFile file = exportService.exportThemes(
                exportFormat,
                rows,
                "themes"
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=" + file.filename())
                .header(HttpHeaders.CONTENT_TYPE, file.contentType())
                .body(file.bytes());
    }

    // =========================================================
    // EXPORT SELECTION (lignes cochées)
    // POST /api/themes/export?format=csv|xlsx|pdf
    // Body: [1,2,3]
    // =========================================================
    @PostMapping("/export")
    public ResponseEntity<byte[]> exportSelected(
            @RequestParam String format,
            @RequestBody List<Long> ids
    ) {
        ExportFormat exportFormat = ExportFormat.from(format);

        List<ThemeDtos> rows = themeService.findAllByIds(ids);

        ExportFile file = exportService.exportThemes(
                exportFormat,
                rows,
                "themes-selection"
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=" + file.filename())
                .header(HttpHeaders.CONTENT_TYPE, file.contentType())
                .body(file.bytes());
    }
}
