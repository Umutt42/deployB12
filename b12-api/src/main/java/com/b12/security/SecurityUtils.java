package com.b12.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class SecurityUtils {
    private SecurityUtils() {}

    public static String currentUserEmailOrSystem() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return "system";
        Object principal = auth.getPrincipal();
        // selon ton projet, ça peut être email direct ou UserDetails
        return auth.getName(); // souvent email/username
    }
}
