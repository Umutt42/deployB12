package com.b12.web;

import com.b12.export.ExportFile;
import com.b12.export.ExportFormat;
import com.b12.export.ExportService;
import com.b12.service.OrganismService;
import com.b12.web.dto.OrganismDtos;
import com.b12.web.dto.OrganismMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/organisms")
@RequiredArgsConstructor
public class OrganismController {

    private final OrganismService service;
    private final ExportService exportService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public OrganismDtos create(@RequestBody OrganismDtos dto) {
        return OrganismMapper.toDto(service.create(dto));
    }

    @GetMapping
    public List<OrganismDtos> findAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public OrganismDtos get(@PathVariable Long id) {
        return service.getDto(id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public OrganismDtos update(@PathVariable Long id, @RequestBody OrganismDtos dto) {
        return OrganismMapper.toDto(service.update(id, dto));
    }

    @PatchMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public OrganismDtos archive(@PathVariable Long id, @RequestParam boolean archived) {
        return OrganismMapper.toDto(service.archive(id, archived));
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
        List<OrganismDtos> rows = service.findAll();
        if (!includeArchived) rows = rows.stream().filter(r -> !r.isArchived()).toList();
        ExportFile file = exportService.exportOrganisms(exportFormat, rows, "organisms");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + file.filename())
                .header(HttpHeaders.CONTENT_TYPE, file.contentType())
                .body(file.bytes());
    }

    @PostMapping("/import/preview")
    @PreAuthorize("hasRole('ADMIN')")
    public List<OrganismDtos.ImportRow> previewImport(
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        return service.previewImport(file);
    }

    @PostMapping("/export")
    public ResponseEntity<byte[]> exportSelected(@RequestParam String format, @RequestBody List<Long> ids) {
        ExportFormat exportFormat = ExportFormat.from(format);
        List<OrganismDtos> rows = service.findAllByIds(ids);
        ExportFile file = exportService.exportOrganisms(exportFormat, rows, "organisms-selection");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + file.filename())
                .header(HttpHeaders.CONTENT_TYPE, file.contentType())
                .body(file.bytes());
    }
}
