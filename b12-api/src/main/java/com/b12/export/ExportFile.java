package com.b12.export;

public record ExportFile(
        byte[] bytes,
        String filename,
        String contentType
) {}
