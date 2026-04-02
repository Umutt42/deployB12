package com.b12.service;

import com.b12.domain.User;
import com.b12.repository.UserRepository;
import com.b12.security.JwtService;
import com.b12.web.dto.AuthDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    // =========================
    // LOGIN
    // =========================
    public AuthDtos.LoginResponse login(AuthDtos.LoginRequest req) {
        User user = userRepository.findByEmailIgnoreCase(req.getEmail().trim())
                .orElseThrow(() -> new IllegalArgumentException("Identifiants invalides"));

        if (!user.isActive()) {
            throw new IllegalArgumentException("Compte désactivé");
        }

        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Identifiants invalides");
        }

        String token = jwtService.generateAccessToken(
                user.getId(),
                user.getEmail(),
                user.getRole().name()
        );

        return new AuthDtos.LoginResponse(
            token,
            user.getEmail(),
            user.getRole().name(),
            user.isForcePasswordChange()
    );
    
    }

    // =========================
    // CHANGE PASSWORD
    // =========================
    public void changePassword(Long userId, AuthDtos.ChangePasswordRequest req) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        if (!user.isActive()) {
            throw new IllegalArgumentException("Compte désactivé");
        }

        // Vérifier ancien mot de passe
        if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Mot de passe actuel incorrect");
        }

        // Éviter mot de passe identique
        if (passwordEncoder.matches(req.getNewPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Le nouveau mot de passe doit être différent");
        }

        // Encoder et sauvegarder
        user.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
        // ✅ Important : une fois changé, on ne force plus
        user.setForcePasswordChange(false);
        userRepository.save(user);
    }
    
}
