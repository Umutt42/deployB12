package com.b12.service;

import com.b12.domain.Role;
import com.b12.domain.User;
import com.b12.repository.UserRepository;
import com.b12.security.JwtService;
import com.b12.web.dto.AuthDtos;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository userRepo;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;

    @InjectMocks
    private AuthService service;

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private User activeUser() {
        User u = new User();
        u.setId(1L);
        u.setEmail("user@test.com");
        u.setRole(Role.USER);
        u.setActive(true);
        u.setPasswordHash("hashed");
        u.setForcePasswordChange(false);
        return u;
    }

    private AuthDtos.LoginRequest loginRequest(String email, String password) {
        AuthDtos.LoginRequest req = new AuthDtos.LoginRequest();
        req.setEmail(email);
        req.setPassword(password);
        return req;
    }

    private AuthDtos.ChangePasswordRequest changeRequest(String current, String newPass) {
        AuthDtos.ChangePasswordRequest req = new AuthDtos.ChangePasswordRequest();
        req.setCurrentPassword(current);
        req.setNewPassword(newPass);
        return req;
    }

    // ─── login ────────────────────────────────────────────────────────────────

    @Test
    void login_shouldThrow_whenUserNotFound() {
        when(userRepo.findByEmailIgnoreCase("unknown@test.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.login(loginRequest("unknown@test.com", "pass")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Identifiants invalides");
    }

    @Test
    void login_shouldThrow_whenUserIsInactive() {
        User u = activeUser();
        u.setActive(false);
        when(userRepo.findByEmailIgnoreCase("user@test.com")).thenReturn(Optional.of(u));

        assertThatThrownBy(() -> service.login(loginRequest("user@test.com", "pass")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("désactivé");
    }

    @Test
    void login_shouldThrow_whenPasswordIsIncorrect() {
        User u = activeUser();
        when(userRepo.findByEmailIgnoreCase("user@test.com")).thenReturn(Optional.of(u));
        when(passwordEncoder.matches("wrongpass", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> service.login(loginRequest("user@test.com", "wrongpass")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Identifiants invalides");
    }

    @Test
    void login_shouldReturnToken_whenCredentialsAreValid() {
        User u = activeUser();
        when(userRepo.findByEmailIgnoreCase("user@test.com")).thenReturn(Optional.of(u));
        when(passwordEncoder.matches("correctpass", "hashed")).thenReturn(true);
        when(jwtService.generateAccessToken(1L, "user@test.com", "USER")).thenReturn("jwt-token");

        AuthDtos.LoginResponse res = service.login(loginRequest("user@test.com", "correctpass"));

        assertThat(res.getAccessToken()).isEqualTo("jwt-token");
        assertThat(res.getEmail()).isEqualTo("user@test.com");
        assertThat(res.getRole()).isEqualTo("USER");
        assertThat(res.isForcePasswordChange()).isFalse();
    }

    @Test
    void login_shouldReturnForcePasswordChangeTrue_whenFirstLogin() {
        User u = activeUser();
        u.setForcePasswordChange(true);
        when(userRepo.findByEmailIgnoreCase("user@test.com")).thenReturn(Optional.of(u));
        when(passwordEncoder.matches("pass", "hashed")).thenReturn(true);
        when(jwtService.generateAccessToken(anyLong(), anyString(), anyString())).thenReturn("token");

        AuthDtos.LoginResponse res = service.login(loginRequest("user@test.com", "pass"));

        assertThat(res.isForcePasswordChange()).isTrue();
    }

    // ─── changePassword ───────────────────────────────────────────────────────

    @Test
    void changePassword_shouldThrow_whenUserNotFound() {
        when(userRepo.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.changePassword(99L, changeRequest("old", "new")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("introuvable");
    }

    @Test
    void changePassword_shouldThrow_whenUserIsInactive() {
        User u = activeUser();
        u.setActive(false);
        when(userRepo.findById(1L)).thenReturn(Optional.of(u));

        assertThatThrownBy(() -> service.changePassword(1L, changeRequest("old", "new")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("désactivé");
    }

    @Test
    void changePassword_shouldThrow_whenCurrentPasswordIsIncorrect() {
        User u = activeUser();
        when(userRepo.findById(1L)).thenReturn(Optional.of(u));
        when(passwordEncoder.matches("wrongcurrent", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> service.changePassword(1L, changeRequest("wrongcurrent", "newpass")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("actuel incorrect");
    }

    @Test
    void changePassword_shouldThrow_whenNewPasswordSameAsCurrent() {
        User u = activeUser();
        when(userRepo.findById(1L)).thenReturn(Optional.of(u));
        // currentPassword valide
        when(passwordEncoder.matches("samepass", "hashed")).thenReturn(true);

        assertThatThrownBy(() -> service.changePassword(1L, changeRequest("samepass", "samepass")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("différent");
    }

    @Test
    void changePassword_shouldSetForcePasswordChangeFalse_afterSuccess() {
        User u = activeUser();
        u.setForcePasswordChange(true);
        when(userRepo.findById(1L)).thenReturn(Optional.of(u));
        when(passwordEncoder.matches("currentpass", "hashed")).thenReturn(true);
        when(passwordEncoder.matches("newpass", "hashed")).thenReturn(false);
        when(passwordEncoder.encode("newpass")).thenReturn("newHashed");

        service.changePassword(1L, changeRequest("currentpass", "newpass"));

        assertThat(u.isForcePasswordChange()).isFalse();
        verify(userRepo).save(u);
    }

    @Test
    void changePassword_shouldUpdatePasswordHash_afterSuccess() {
        User u = activeUser();
        when(userRepo.findById(1L)).thenReturn(Optional.of(u));
        when(passwordEncoder.matches("currentpass", "hashed")).thenReturn(true);
        when(passwordEncoder.matches("newpass", "hashed")).thenReturn(false);
        when(passwordEncoder.encode("newpass")).thenReturn("newHashed");

        service.changePassword(1L, changeRequest("currentpass", "newpass"));

        assertThat(u.getPasswordHash()).isEqualTo("newHashed");
    }
}
