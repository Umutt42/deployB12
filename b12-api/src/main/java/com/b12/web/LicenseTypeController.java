package com.b12.web;

import com.b12.export.ExportFile;
import com.b12.export.ExportFormat;
import com.b12.export.ExportService;
import com.b12.service.LicenseTypeService;
import com.b12.web.dto.LicenseTypeDtos;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

import static com.b12.web.dto.LicenseTypeDtos.*;

@RestController
@RequestMapping("/api/license-types")
@RequiredArgsConstructor
public class LicenseTypeController {

    private final LicenseTypeService service;
    private final ExportService exportService;

    // =========================
    // CREATE
    // =========================
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public View create(@Valid @RequestBody Create dto) {
        return service.create(dto);
    }

    // =========================
    // LIST (avec filtre archived)
    // =========================
    @GetMapping
    public List<View> list(@RequestParam(required = false) Boolean archived) {
        return service.list(archived);
    }

    // =========================
    // GET ONE
    // =========================
    @GetMapping("/{id}")
    public View get(@PathVariable Long id) {
        return service.get(id);
    }

    // =========================
    // UPDATE
    // =========================
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public View update(@PathVariable Long id, @Valid @RequestBody Update dto) {
        return service.update(id, dto);
    }

    // =========================
    // ARCHIVE / UNARCHIVE
    // =========================
    @PatchMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public View archive(
            @PathVariable Long id,
            @RequestParam boolean archived
    ) {
        return service.archive(id, archived);
    }

    // =========================
    // DELETE
    // =========================
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    // =========================================================
    // EXPORT GLOBAL (toute la table)
    // GET /api/license-types/export?format=csv|xlsx|pdf
    // =========================================================
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportAll(
            @RequestParam String format,
            @RequestParam(required = false, defaultValue = "false") boolean includeArchived
    ) {
        ExportFormat exportFormat = ExportFormat.from(format);

        List<View> rows = service.listAll();
        if (!includeArchived) rows = rows.stream().filter(r -> !r.archived()).toList();

        ExportFile file = exportService.exportLicenseTypes(
                exportFormat,
                rows,
                "license-types"
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=" + file.filename())
                .header(HttpHeaders.CONTENT_TYPE, file.contentType())
                .body(file.bytes());
    }

    // =========================================================
    // EXPORT SELECTION (lignes cochées)
    // POST /api/license-types/export?format=csv|xlsx|pdf
    // Body: [1,2,3]
    // =========================================================
    // =========================================================
    // IMPORT — PREVIEW (parse + retourne les lignes, sans sauvegarde)
    // POST /api/license-types/import/preview
    // Body: multipart/form-data, param "file"
    // =========================================================
    @PostMapping("/import/preview")
    @PreAuthorize("hasRole('ADMIN')")
    public List<LicenseTypeDtos.ImportRow> previewImport(
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        return service.previewImport(file);
    }

    // =========================================================
    // IMPORT CSV / XLSX (sauvegarde directe — conservé pour usage futur)
    // POST /api/license-types/import
    // Body: multipart/form-data, param "file"
    // =========================================================
    @PostMapping("/import")
    @PreAuthorize("hasRole('ADMIN')")
    public LicenseTypeDtos.ImportResult importFile(
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        return service.importFile(file);
    }

    @PostMapping("/export")
    public ResponseEntity<byte[]> exportSelected(
            @RequestParam String format,
            @RequestBody List<Long> ids
    ) {
        ExportFormat exportFormat = ExportFormat.from(format);

        List<View> rows = service.listByIds(ids);

        ExportFile file = exportService.exportLicenseTypes(
                exportFormat,
                rows,
                "license-types-selection"
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=" + file.filename())
                .header(HttpHeaders.CONTENT_TYPE, file.contentType())
                .body(file.bytes());
    }
}
