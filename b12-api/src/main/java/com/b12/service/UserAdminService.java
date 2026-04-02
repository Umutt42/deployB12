package com.b12.service;

import com.b12.domain.Role;
import com.b12.domain.User;
import com.b12.repository.UserRepository;
import com.b12.web.dto.UserDtos;
import com.b12.web.dto.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserAdminService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    // =========================
    // LIST
    // =========================
    @Transactional(readOnly = true)
    public List<UserDtos.View> list() {
        return userRepository.findAllByOrderByEmailAsc()
                .stream()
                .map(UserMapper::toView)
                .toList();
    }

    // =========================
    // CREATE (ADMIN)
    // =========================
    @Transactional
    public UserDtos.View create(UserDtos.CreateRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("Requête invalide.");
        }

        String email = normalizeEmail(req.getEmail());
        Role role = req.getRole();
        if (role == null) {
            throw new IllegalArgumentException("Le rôle est requis.");
        }

        String tempPassword = normalizePassword(req.getTempPassword());

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Email déjà utilisé: " + email);
        }

        User u = new User();
        u.setEmail(email);
        u.setRole(role);
        u.setActive(true);

        // mot de passe provisoire défini par l’admin
        u.setPasswordHash(passwordEncoder.encode(tempPassword));

        // Force changement au premier login
        u.setForcePasswordChange(true);

        return UserMapper.toView(userRepository.save(u));
    }

    // =========================
    // ACTIVER / DESACTIVER
    // =========================
    @Transactional
    public UserDtos.View setActive(Long id, boolean active) {
        User u = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable : " + id));

        // Sécurité: empêcher de désactiver le dernier ADMIN actif
        if (!active && u.getRole() == Role.ADMIN) {
            long admins = userRepository.countByRole(Role.ADMIN);
            if (admins <= 1) {
                throw new IllegalArgumentException("Impossible de désactiver le dernier administrateur.");
            }
        }

        u.setActive(active);
        return UserMapper.toView(userRepository.save(u));
    }

    // =========================
    // SET ROLE (ADMIN)
    // PATCH /api/admin/users/{id}/role?role=ADMIN|USER|VISITOR
    // =========================
    @Transactional
    public UserDtos.View setRole(Long id, String role) {
        if (role == null || role.isBlank()) {
            throw new IllegalArgumentException("Le rôle est requis.");
        }

        Role newRole;
        try {
            newRole = Role.valueOf(role.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Rôle invalide: " + role);
        }

        User u = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable : " + id));

        Role oldRole = u.getRole();
        if (oldRole == newRole) {
            return UserMapper.toView(u);
        }

        // Sécurité: empêcher de retirer ADMIN au dernier ADMIN
        if (oldRole == Role.ADMIN && newRole != Role.ADMIN) {
            long admins = userRepository.countByRole(Role.ADMIN);
            if (admins <= 1) {
                throw new IllegalArgumentException("Impossible de retirer le rôle ADMIN au dernier administrateur.");
            }
        }

        u.setRole(newRole);
        return UserMapper.toView(userRepository.save(u));
    }

    // =========================
    // RESET PASSWORD (ADMIN)
    // =========================
    @Transactional
    public void resetPassword(Long id, UserDtos.ResetPasswordRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("Requête invalide.");
        }

        String newPassword = normalizePassword(req.getNewPassword());

        if (req.getConfirmPassword() == null || req.getConfirmPassword().isBlank()) {
            throw new IllegalArgumentException("La confirmation du mot de passe est requise.");
        }

        if (!newPassword.equals(req.getConfirmPassword().trim())) {
            throw new IllegalArgumentException("Les mots de passe ne correspondent pas");
        }

        User u = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable : " + id));

        u.setPasswordHash(passwordEncoder.encode(newPassword));

        // reset => on re-force le changement de mot de passe
        u.setForcePasswordChange(true);

        userRepository.save(u);
    }

    // =========================
    // DELETE (ADMIN)
    // =========================
    @Transactional
    public void delete(Long id, Long currentUserId) {
        if (id == null) throw new IllegalArgumentException("L'identifiant utilisateur est requis.");

        if (currentUserId != null && id.equals(currentUserId)) {
            throw new IllegalArgumentException("Vous ne pouvez pas supprimer votre propre compte.");
        }

        User u = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable : " + id));

        // Sécurité: empêcher de supprimer le dernier ADMIN
        if (u.getRole() == Role.ADMIN) {
            long admins = userRepository.countByRole(Role.ADMIN);
            if (admins <= 1) {
                throw new IllegalArgumentException("Impossible de supprimer le dernier administrateur.");
            }
        }

        userRepository.delete(u);
    }

    // =========================
    // Helpers
    // =========================
    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("L'adresse e-mail est requise.");
        }
        return email.trim().toLowerCase();
    }

    private String normalizePassword(String password) {
        if (password == null || password.isBlank()) {
            throw new IllegalArgumentException("Le mot de passe est requis.");
        }
        // tu peux rajouter des règles de complexité ici plus tard
        return password.trim();
    }
}
