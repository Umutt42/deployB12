package com.b12.config;

import com.b12.security.JwtUserPrincipal;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorAware")
public class JpaAuditConfig {

    @Bean
    public AuditorAware<String> auditorAware() {
        return () -> {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated()) return Optional.empty();

            Object principal = auth.getPrincipal();

            // ✅ ton cas
            if (principal instanceof JwtUserPrincipal p) {
                return Optional.ofNullable(p.getEmail());
            }

            // ✅ fallback
            String name = auth.getName();
            if (name == null || name.isBlank() || "anonymousUser".equals(name)) return Optional.empty();
            return Optional.of(name);
        };
    }
}
