package com.b12.security;

import java.io.Serializable;
import java.security.Principal;

public class JwtUserPrincipal implements Serializable, Principal {
    private final Long userId;
    private final String email;
    private final String role;

    public JwtUserPrincipal(Long userId, String email, String role) {
        this.userId = userId;
        this.email = email;
        this.role = role;
    }

    public Long getUserId() { return userId; }
    public String getEmail() { return email; }
    public String getRole() { return role; }

    // ✅ IMPORTANT : Spring Security pourra récupérer un "name" propre
    @Override
    public String getName() {
        return email;
    }
}
