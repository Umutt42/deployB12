package com.b12.web;

import com.b12.export.ExportFile;
import com.b12.export.ExportFormat;
import com.b12.export.ExportService;
import com.b12.service.TrainingAccreditationService;
import com.b12.web.dto.TrainingAccreditationDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/training-accreditations")
@RequiredArgsConstructor
public class TrainingAccreditationController {

    private final TrainingAccreditationService service;
    private final ExportService exportService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public TrainingAccreditationDtos create(@RequestBody TrainingAccreditationDtos dto) {
        return service.createDto(dto);
    }

    @GetMapping
    public List<TrainingAccreditationDtos> getAll() {
        return service.findAll();
    }

    @GetMapping("/by-center-accreditation/{centerAccreditationId}")
    public List<TrainingAccreditationDtos> byCenterAccreditation(@PathVariable Long centerAccreditationId) {
        return service.findByCenterAccreditation(centerAccreditationId);
    }

    @GetMapping("/{id}")
    public TrainingAccreditationDtos get(@PathVariable Long id) {
        return service.getDto(id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public TrainingAccreditationDtos update(@PathVariable Long id, @RequestBody TrainingAccreditationDtos dto) {
        return service.updateDto(id, dto);
    }

    @PatchMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public TrainingAccreditationDtos archive(@PathVariable Long id, @RequestParam boolean archived) {
        return service.archiveDto(id, archived);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    // =========================================================
    // EXPORT GLOBAL
    // GET /api/training-accreditations/export?format=csv|xlsx|pdf
    // =========================================================
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportAll(
            @RequestParam String format,
            @RequestParam(required = false, defaultValue = "false") boolean includeArchived
    ) {
        ExportFormat exportFormat = ExportFormat.from(format);
        List<TrainingAccreditationDtos> rows = service.findAll();
        if (!includeArchived) rows = rows.stream().filter(r -> !r.isArchived()).toList();
        ExportFile file = exportService.exportTrainingAccreditations(exportFormat, rows, "training-accreditations");
        return buildResponse(file);
    }

    // =========================================================
    // EXPORT SÉLECTION
    // POST /api/training-accreditations/export?format=csv|xlsx|pdf
    // Body: [1,2,3]
    // =========================================================
    @PostMapping("/export")
    public ResponseEntity<byte[]> exportSelected(
            @RequestParam String format,
            @RequestBody List<Long> ids
    ) {
        ExportFormat exportFormat = ExportFormat.from(format);
        List<TrainingAccreditationDtos> rows = service.findAllByIds(ids);
        ExportFile file = exportService.exportTrainingAccreditations(exportFormat, rows, "training-accreditations-selection");
        return buildResponse(file);
    }

    private static ResponseEntity<byte[]> buildResponse(ExportFile file) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + file.filename())
                .header(HttpHeaders.CONTENT_TYPE, file.contentType())
                .body(file.bytes());
    }
}
