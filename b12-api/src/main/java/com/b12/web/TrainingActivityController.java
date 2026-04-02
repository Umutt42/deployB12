package com.b12.web;

import com.b12.export.ExportFile;
import com.b12.export.ExportFormat;
import com.b12.export.ExportService;
import com.b12.service.TrainingActivityService;
import com.b12.web.dto.TrainingActivityDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/training-activities")
@RequiredArgsConstructor
public class TrainingActivityController {

    private final TrainingActivityService service;
    private final ExportService exportService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public TrainingActivityDtos create(@RequestBody TrainingActivityDtos dto) {
        return service.createDto(dto);
    }

    @GetMapping
    public List<TrainingActivityDtos> getAll() {
        return service.findAll();
    }

    @GetMapping("/by-training-accreditation/{trainingAccreditationId}")
    public List<TrainingActivityDtos> byTrainingAccreditation(@PathVariable Long trainingAccreditationId) {
        return service.findByTrainingAccreditation(trainingAccreditationId);
    }

    @GetMapping("/eligible")
    public List<TrainingActivityDtos> eligible(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.findEligible(date);
    }

    @GetMapping("/calendar")
    public List<TrainingActivityDtos> calendar(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.findByDateRange(from, to);
    }

    @GetMapping("/{id}")
    public TrainingActivityDtos get(@PathVariable Long id) {
        return service.getDto(id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public TrainingActivityDtos update(@PathVariable Long id, @RequestBody TrainingActivityDtos dto) {
        return service.updateDto(id, dto);
    }

    @PatchMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public TrainingActivityDtos archive(@PathVariable Long id, @RequestParam boolean archived) {
        return service.archiveDto(id, archived);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    // =========================================================
    // EXPORT GLOBAL
    // GET /api/training-activities/export?format=csv|xlsx|pdf
    // =========================================================
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportAll(
            @RequestParam String format,
            @RequestParam(required = false, defaultValue = "false") boolean includeArchived
    ) {
        ExportFormat exportFormat = ExportFormat.from(format);
        List<TrainingActivityDtos> rows = includeArchived
                ? service.findAllIncludingArchived()
                : service.findAll();
        ExportFile file = exportService.exportTrainingActivities(exportFormat, rows, "training-activities");
        return buildResponse(file);
    }

    // =========================================================
    // EXPORT SÉLECTION
    // POST /api/training-activities/export?format=csv|xlsx|pdf
    // Body: [1,2,3]
    // =========================================================
    @PostMapping("/export")
    public ResponseEntity<byte[]> exportSelected(
            @RequestParam String format,
            @RequestBody List<Long> ids
    ) {
        ExportFormat exportFormat = ExportFormat.from(format);
        List<TrainingActivityDtos> rows = service.findAllByIds(ids);
        ExportFile file = exportService.exportTrainingActivities(exportFormat, rows, "training-activities-selection");
        return buildResponse(file);
    }

    private static ResponseEntity<byte[]> buildResponse(ExportFile file) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + file.filename())
                .header(HttpHeaders.CONTENT_TYPE, file.contentType())
                .body(file.bytes());
    }
}
