package com.b12.web;

import com.b12.export.ExportFile;
import com.b12.export.ExportFormat;
import com.b12.export.ExportService;
import com.b12.service.TrainingCenterService;
import com.b12.web.dto.TrainingCenterDtos;
import com.b12.web.dto.TrainingCenterMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/training-centers")
@RequiredArgsConstructor
public class TrainingCenterController {

    private final TrainingCenterService service;
    private final ExportService exportService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public TrainingCenterDtos create(@RequestBody TrainingCenterDtos dto) {
        return TrainingCenterMapper.toDto(service.create(dto));
    }

    @GetMapping
    public List<TrainingCenterDtos> findAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public TrainingCenterDtos get(@PathVariable Long id) {
        return service.getDto(id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public TrainingCenterDtos update(@PathVariable Long id, @RequestBody TrainingCenterDtos dto) {
        return TrainingCenterMapper.toDto(service.update(id, dto));
    }

    @PatchMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public TrainingCenterDtos archive(@PathVariable Long id, @RequestParam boolean archived) {
        return TrainingCenterMapper.toDto(service.archive(id, archived));
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
        List<TrainingCenterDtos> rows = service.findAll();
        if (!includeArchived) rows = rows.stream().filter(r -> !r.isArchived()).toList();
        ExportFile file = exportService.exportTrainingCenters(exportFormat, rows, "training-centers");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + file.filename())
                .header(HttpHeaders.CONTENT_TYPE, file.contentType())
                .body(file.bytes());
    }

    @PostMapping("/export")
    public ResponseEntity<byte[]> exportSelected(@RequestParam String format, @RequestBody List<Long> ids) {
        ExportFormat exportFormat = ExportFormat.from(format);
        List<TrainingCenterDtos> rows = service.findAllByIds(ids);
        ExportFile file = exportService.exportTrainingCenters(exportFormat, rows, "training-centers-selection");
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + file.filename())
                .header(HttpHeaders.CONTENT_TYPE, file.contentType())
                .body(file.bytes());
    }
}
