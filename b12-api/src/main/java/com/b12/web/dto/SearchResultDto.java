package com.b12.web.dto;

public record SearchResultDto(
        String type,
        Long   id,
        String label,
        String sublabel,
        String route
) {}
