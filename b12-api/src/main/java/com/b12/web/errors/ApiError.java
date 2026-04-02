package com.b12.web.errors;

import java.time.Instant;
import java.util.Map;

public record ApiError(
        String message,
        Map<String, String> fieldErrors,
        Instant timestamp
) {
    public ApiError(String message, Map<String, String> fieldErrors) {
        this(message, fieldErrors, Instant.now());
    }
}
