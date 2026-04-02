package com.b12.web.dto;

import com.b12.domain.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;

public class UserDtos {

    // =========================
    // Création utilisateur (ADMIN)
    // =========================
    @Data
    public static class CreateRequest {

        @Email
        @NotBlank
        private String email;

        @NotNull
        private Role role;

        // Mot de passe provisoire défini par l’admin
        @NotBlank
        private String tempPassword;
    }

    // =========================
    // Reset mot de passe (ADMIN)
    // =========================
    @Data
    public static class ResetPasswordRequest {

        @NotBlank
        private String newPassword;

        @NotBlank
        private String confirmPassword;
    }

    // =========================
    // Vue utilisateur (LISTE / DETAIL)
    // =========================
    @Data
    public static class View {

        private Long id;
        private String email;
        private Role role;

        private boolean active;
        private boolean forcePasswordChange;

        private Instant createdAt;
        private Instant updatedAt;
    }
}
