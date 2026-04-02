package com.b12.web;

import com.b12.export.ChartExportService;
import com.b12.service.StatsService;
import com.b12.web.dto.StatsDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/charts")
@RequiredArgsConstructor
public class ChartExportController {

    private final StatsService statsService;
    private final ChartExportService chartExportService;

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportPdf() {
        StatsDto stats = statsService.compute();
        byte[] pdf = chartExportService.exportChartsPdf(stats);
        String filename = "rapport-graphiques-" + LocalDate.now() + ".pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
