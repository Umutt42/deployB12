package com.b12.web;

import com.b12.export.ExportFile;
import com.b12.export.ExportFormat;
import com.b12.export.ExportService;
import com.b12.service.CenterAccreditationService;
import com.b12.web.dto.CenterAccreditationDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

import java.util.List;

@RestController
@RequestMapping("/api/center-accreditations")
@RequiredArgsConstructor
public class CenterAccreditationController {

    private final CenterAccreditationService service;
    private final ExportService exportService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public CenterAccreditationDtos create(@RequestBody CenterAccreditationDtos dto) {
        return service.createDto(dto);
    }

    @GetMapping
    public List<CenterAccreditationDtos> getAll() {
        return service.findAll();
    }

    @GetMapping("/by-training-center/{trainingCenterId}")
    public List<CenterAccreditationDtos> byTrainingCenter(@PathVariable Long trainingCenterId) {
        return service.findByTrainingCenter(trainingCenterId);
    }

    @GetMapping("/active-at")
    public List<CenterAccreditationDtos> activeAt(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return service.findActiveAt(date);
    }

    @GetMapping("/{id}")
    public CenterAccreditationDtos get(@PathVariable Long id) {
        return service.getDto(id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public CenterAccreditationDtos update(@PathVariable Long id, @RequestBody CenterAccreditationDtos dto) {
        return service.updateDto(id, dto);
    }

    @PatchMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public CenterAccreditationDtos archive(@PathVariable Long id, @RequestParam boolean archived) {
        return service.archiveDto(id, archived);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportAll(@RequestParam String format,
            @RequestParam(required = false, defaultValue = "false") boolean includeArchived) {
        ExportFormat exportFormat = ExportFormat.from(format);
        List<CenterAccreditationDtos> rows = service.findAll();
        if (!includeArchived) rows = rows.stream().filter(r -> !r.isArchived()).toList();
        ExportFile file = exportService.exportCenterAccreditations(exportFormat, rows, "center-accreditations");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + file.filename())
                .header(HttpHeaders.CONTENT_TYPE, file.contentType())
                .body(file.bytes());
    }

    @PostMapping("/export")
    public ResponseEntity<byte[]> exportSelected(@RequestParam String format, @RequestBody List<Long> ids) {
        ExportFormat exportFormat = ExportFormat.from(format);
        List<CenterAccreditationDtos> rows = service.findAllByIds(ids);
        ExportFile file = exportService.exportCenterAccreditations(exportFormat, rows, "center-accreditations-selection");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + file.filename())
                .header(HttpHeaders.CONTENT_TYPE, file.contentType())
                .body(file.bytes());
    }
}
