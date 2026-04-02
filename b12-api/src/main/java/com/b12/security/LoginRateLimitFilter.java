package com.b12.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class LoginRateLimitFilter extends OncePerRequestFilter {

    private static final int  MAX_ATTEMPTS   = 5;
    private static final long BLOCK_DURATION = 15 * 60 * 1000L; // 15 minutes en ms

    private record Attempt(int count, long blockedAt) {}

    private final ConcurrentHashMap<String, Attempt> attempts = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().equals("/api/auth/login")
            || !request.getMethod().equals("POST");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        String ip = getClientIp(request);
        Attempt current = attempts.get(ip);

        if (current != null && current.count() >= MAX_ATTEMPTS) {
            long elapsed = Instant.now().toEpochMilli() - current.blockedAt();
            if (elapsed < BLOCK_DURATION) {
                long remaining = (BLOCK_DURATION - elapsed) / 1000;
                response.setStatus(429);
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.getWriter().write(
                    "{\"message\":\"Trop de tentatives. Réessayez dans " + remaining + " secondes.\"}"
                );
                return;
            }
            // Blocage expiré → on repart à zéro
            attempts.remove(ip);
        }

        // Wrapper pour intercepter le status de la réponse
        StatusCapturingWrapper wrapped = new StatusCapturingWrapper(response);
        chain.doFilter(request, wrapped);

        if (wrapped.getStatus() == 401) {
            attempts.merge(ip, new Attempt(1, Instant.now().toEpochMilli()),
                (old, neu) -> new Attempt(old.count() + 1, Instant.now().toEpochMilli()));
        } else if (wrapped.getStatus() == 200) {
            attempts.remove(ip);
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    // Wrapper minimal pour capturer le status HTTP sans modifier la réponse
    private static class StatusCapturingWrapper extends jakarta.servlet.http.HttpServletResponseWrapper {
        private int status = 200;

        StatusCapturingWrapper(HttpServletResponse response) {
            super(response);
        }

        @Override
        public void setStatus(int sc) {
            this.status = sc;
            super.setStatus(sc);
        }

        @Override
        public void sendError(int sc) throws IOException {
            this.status = sc;
            super.sendError(sc);
        }

        @Override
        public void sendError(int sc, String msg) throws IOException {
            this.status = sc;
            super.sendError(sc, msg);
        }

        @Override
        public int getStatus() {
            return status;
        }
    }
}
