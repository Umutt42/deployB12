package com.b12.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public class LicenseTypeDtos {

    public record Create(
            @NotBlank @Size(max = 20) String code,
            @NotBlank @Size(max = 120) String label,
            @Size(max = 500) String description
    ) {}

    public record Update(
            @NotBlank @Size(max = 120) String label,
            @Size(max = 500) String description,
            boolean archived
    ) {}

    public record View(
            Long id,
            String code,
            String label,
            String description,
            boolean archived,
            Instant createdAt,
            Instant updatedAt,
            String updatedBy
    ) {}

    public record ImportRow(String code, String label, String description) {}

    public record ImportError(int row, String message) {}

    public record ImportResult(
            int total,
            int created,
            int skipped,
            List<ImportError> errors
    ) {}
}
