package com.b12.web;

import com.b12.export.ExportFile;
import com.b12.export.ExportFormat;
import com.b12.export.ExportService;
import com.b12.service.SectorService;
import com.b12.web.dto.SectorDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/sectors")
@RequiredArgsConstructor
public class SectorController {

    private final SectorService service;
    private final ExportService exportService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public SectorDtos create(@RequestBody SectorDtos dto) {
        return service.createDto(dto);
    }

    @GetMapping
    public List<SectorDtos> findAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public SectorDtos get(@PathVariable Long id) {
        return service.getDto(id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public SectorDtos update(@PathVariable Long id, @RequestBody SectorDtos dto) {
        return service.updateDto(id, dto);
    }

    @PatchMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public SectorDtos archive(@PathVariable Long id, @RequestParam boolean archived) {
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
        List<SectorDtos> rows = service.findAll();
        if (!includeArchived) rows = rows.stream().filter(r -> !r.isArchived()).toList();
        ExportFile file = exportService.exportSectors(exportFormat, rows, "sectors");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + file.filename())
                .header(HttpHeaders.CONTENT_TYPE, file.contentType())
                .body(file.bytes());
    }

    @PostMapping("/import/preview")
    @PreAuthorize("hasRole('ADMIN')")
    public List<SectorDtos.ImportRow> previewImport(
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        return service.previewImport(file);
    }

    @PostMapping("/export")
    public ResponseEntity<byte[]> exportSelected(@RequestParam String format, @RequestBody List<Long> ids) {
        ExportFormat exportFormat = ExportFormat.from(format);
        List<SectorDtos> rows = service.findAllByIds(ids);
        ExportFile file = exportService.exportSectors(exportFormat, rows, "sectors-selection");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + file.filename())
                .header(HttpHeaders.CONTENT_TYPE, file.contentType())
                .body(file.bytes());
    }
}
