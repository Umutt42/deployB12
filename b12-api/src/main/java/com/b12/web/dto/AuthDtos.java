package com.b12.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

public class AuthDtos {

    // =========================
    // LOGIN
    // =========================
    @Data
    public static class LoginRequest {
        @Email
        @NotBlank
        private String email;

        @NotBlank
        private String password;
    }

    @Data
    public static class LoginResponse {
        private String accessToken;
        private String email;
        private String role;
        private boolean forcePasswordChange;
    
        public LoginResponse(String accessToken, String email, String role, boolean forcePasswordChange) {
            this.accessToken = accessToken;
            this.email = email;
            this.role = role;
            this.forcePasswordChange = forcePasswordChange;
        }
    }
    

    // =========================
    // CHANGE PASSWORD
    // =========================
    @Data
    public static class ChangePasswordRequest {

        @NotBlank
        private String currentPassword;

        @NotBlank
        @Size(min = 8, message = "Le nouveau mot de passe doit contenir au moins 8 caractères")
        private String newPassword;
    }
}
