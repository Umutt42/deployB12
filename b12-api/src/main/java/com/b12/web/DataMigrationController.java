package com.b12.web;

import com.b12.service.DataMigrationService;
import com.b12.web.dto.DataMigrationDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/import")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class DataMigrationController {

    private final DataMigrationService service;

    // ==========================================================================
    // TEMPLATES — télécharger les fichiers Excel pré-remplis
    // ==========================================================================

    @GetMapping("/template/training-centers.xlsx")
    public ResponseEntity<byte[]> templateTrainingCenters() throws IOException {
        return xlsxResponse(service.generateTrainingCenterTemplate(), "template_centres_de_formation.xlsx");
    }

    @GetMapping("/template/center-accreditations.xlsx")
    public ResponseEntity<byte[]> templateCenterAccreditations() throws IOException {
        return xlsxResponse(service.generateCenterAccreditationTemplate(), "template_agrements_centres.xlsx");
    }

    @GetMapping("/template/training-accreditations.xlsx")
    public ResponseEntity<byte[]> templateTrainingAccreditations() throws IOException {
        return xlsxResponse(service.generateTrainingAccreditationTemplate(), "template_agrements_formations.xlsx");
    }

    @GetMapping("/template/training-activities.xlsx")
    public ResponseEntity<byte[]> templateTrainingActivities() throws IOException {
        return xlsxResponse(service.generateTrainingActivityTemplate(), "template_activites_formations.xlsx");
    }

    // ==========================================================================
    // CENTRES DE FORMATION
    // ==========================================================================

    @PostMapping("/training-centers/preview")
    public DataMigrationDtos.PreviewResult previewTrainingCenters(
            @RequestParam("file") MultipartFile file) throws IOException {
        return service.previewTrainingCenters(file);
    }

    @PostMapping("/training-centers")
    public DataMigrationDtos.ImportResult importTrainingCenters(
            @RequestParam("file") MultipartFile file) throws IOException {
        return service.importTrainingCenters(file);
    }

    // ==========================================================================
    // AGRÉMENTS CENTRES
    // ==========================================================================

    @PostMapping("/center-accreditations/preview")
    public DataMigrationDtos.PreviewResult previewCenterAccreditations(
            @RequestParam("file") MultipartFile file) throws IOException {
        return service.previewCenterAccreditations(file);
    }

    @PostMapping("/center-accreditations")
    public DataMigrationDtos.ImportResult importCenterAccreditations(
            @RequestParam("file") MultipartFile file) throws IOException {
        return service.importCenterAccreditations(file);
    }

    // ==========================================================================
    // AGRÉMENTS FORMATIONS
    // ==========================================================================

    @PostMapping("/training-accreditations/preview")
    public DataMigrationDtos.PreviewResult previewTrainingAccreditations(
            @RequestParam("file") MultipartFile file) throws IOException {
        return service.previewTrainingAccreditations(file);
    }

    @PostMapping("/training-accreditations")
    public DataMigrationDtos.ImportResult importTrainingAccreditations(
            @RequestParam("file") MultipartFile file) throws IOException {
        return service.importTrainingAccreditations(file);
    }

    // ==========================================================================
    // ACTIVITÉS DE FORMATION
    // ==========================================================================

    @PostMapping("/training-activities/preview")
    public DataMigrationDtos.PreviewResult previewTrainingActivities(
            @RequestParam("file") MultipartFile file) throws IOException {
        return service.previewTrainingActivities(file);
    }

    @PostMapping("/training-activities")
    public DataMigrationDtos.ImportResult importTrainingActivities(
            @RequestParam("file") MultipartFile file) throws IOException {
        return service.importTrainingActivities(file);
    }

    // ==========================================================================
    // HELPER
    // ==========================================================================

    private ResponseEntity<byte[]> xlsxResponse(byte[] bytes, String filename) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename)
                .header(HttpHeaders.CONTENT_TYPE,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                .body(bytes);
    }
}
