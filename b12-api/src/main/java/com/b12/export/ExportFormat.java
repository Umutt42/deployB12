package com.b12.export;

public enum ExportFormat {
    CSV,
    XLSX,
    PDF;

    public static ExportFormat from(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("Le format est requis (csv|xlsx|pdf).");
        }
        return switch (raw.trim().toLowerCase()) {
            case "csv" -> CSV;
            case "xlsx", "excel" -> XLSX;
            case "pdf" -> PDF;
            default -> throw new IllegalArgumentException("Format non supporté : " + raw);
        };
    }
}
