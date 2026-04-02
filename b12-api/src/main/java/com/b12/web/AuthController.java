package com.b12.web;

import com.b12.security.JwtUserPrincipal;
import com.b12.service.AuthService;
import com.b12.web.dto.AuthDtos;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    // =========================
    // LOGIN
    // =========================
    @PostMapping("/login")
    public AuthDtos.LoginResponse login(
            @Valid @RequestBody AuthDtos.LoginRequest req
    ) {
        return authService.login(req);
    }

    // =========================
    // CHANGE PASSWORD (user connecté)
    // =========================
    @PostMapping("/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(
            @AuthenticationPrincipal JwtUserPrincipal principal,
            @Valid @RequestBody AuthDtos.ChangePasswordRequest req
    ) {
        if (principal == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "Non authentifié"
            );
        }
        authService.changePassword(principal.getUserId(), req);
    }
    
}
