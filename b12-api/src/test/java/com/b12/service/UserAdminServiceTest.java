package com.b12.service;

import com.b12.domain.Role;
import com.b12.domain.User;
import com.b12.repository.UserRepository;
import com.b12.web.dto.UserDtos;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserAdminServiceTest {

    @Mock private UserRepository userRepo;
    @Mock private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserAdminService service;

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private User adminUser(Long id) {
        User u = new User();
        u.setId(id);
        u.setEmail("admin@test.com");
        u.setRole(Role.ADMIN);
        u.setActive(true);
        u.setForcePasswordChange(false);
        return u;
    }

    // ─── create ───────────────────────────────────────────────────────────────

    @Test
    void create_shouldThrow_whenRequestIsNull() {
        assertThatThrownBy(() -> service.create(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Request is required");
    }

    @Test
    void create_shouldThrow_whenEmailIsNull() {
        UserDtos.CreateRequest req = new UserDtos.CreateRequest();
        req.setEmail(null);
        req.setRole(Role.USER);
        req.setTempPassword("pass123");

        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Email is required");
    }

    @Test
    void create_shouldThrow_whenEmailIsBlank() {
        UserDtos.CreateRequest req = new UserDtos.CreateRequest();
        req.setEmail("   ");
        req.setRole(Role.USER);
        req.setTempPassword("pass123");

        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Email is required");
    }

    @Test
    void create_shouldThrow_whenRoleIsNull() {
        UserDtos.CreateRequest req = new UserDtos.CreateRequest();
        req.setEmail("new@test.com");
        req.setRole(null);
        req.setTempPassword("pass123");

        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Role is required");
    }

    @Test
    void create_shouldThrow_whenEmailAlreadyExists() {
        when(userRepo.existsByEmailIgnoreCase("existing@test.com")).thenReturn(true);

        UserDtos.CreateRequest req = new UserDtos.CreateRequest();
        req.setEmail("existing@test.com");
        req.setRole(Role.USER);
        req.setTempPassword("pass123");

        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Email déjà utilisé");
    }

    @Test
    void create_shouldSetForcePasswordChangeTrue() {
        when(userRepo.existsByEmailIgnoreCase(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepo.save(any())).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(1L);
            return u;
        });

        UserDtos.CreateRequest req = new UserDtos.CreateRequest();
        req.setEmail("new@test.com");
        req.setRole(Role.USER);
        req.setTempPassword("pass123");

        service.create(req);

        verify(userRepo).save(argThat(User::isForcePasswordChange));
    }

    @Test
    void create_shouldNormalizeEmailToLowercase() {
        when(userRepo.existsByEmailIgnoreCase("user@test.com")).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepo.save(any())).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(1L);
            return u;
        });

        UserDtos.CreateRequest req = new UserDtos.CreateRequest();
        req.setEmail("  USER@TEST.COM  ");
        req.setRole(Role.ADMIN);
        req.setTempPassword("pass123");

        service.create(req);

        verify(userRepo).save(argThat(u -> "user@test.com".equals(u.getEmail())));
    }

    // ─── setActive ────────────────────────────────────────────────────────────

    @Test
    void setActive_shouldThrow_whenDeactivatingLastAdmin() {
        when(userRepo.findById(1L)).thenReturn(Optional.of(adminUser(1L)));
        when(userRepo.countByRole(Role.ADMIN)).thenReturn(1L);

        assertThatThrownBy(() -> service.setActive(1L, false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("dernier administrateur");
    }

    @Test
    void setActive_shouldSucceed_whenThereAreMultipleAdmins() {
        User admin = adminUser(1L);
        when(userRepo.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepo.countByRole(Role.ADMIN)).thenReturn(2L);
        when(userRepo.save(any())).thenReturn(admin);

        assertThatNoException().isThrownBy(() -> service.setActive(1L, false));
        assertThat(admin.isActive()).isFalse();
    }

    @Test
    void setActive_shouldNotCheckAdminCount_whenActivating() {
        User admin = adminUser(1L);
        admin.setActive(false);
        when(userRepo.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepo.save(any())).thenReturn(admin);

        service.setActive(1L, true);

        verify(userRepo, never()).countByRole(any());
        assertThat(admin.isActive()).isTrue();
    }

    // ─── setRole ─────────────────────────────────────────────────────────────

    @Test
    void setRole_shouldThrow_whenRoleIsBlank() {
        assertThatThrownBy(() -> service.setRole(1L, ""))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("role is required");
    }

    @Test
    void setRole_shouldThrow_whenRoleIsInvalid() {
        assertThatThrownBy(() -> service.setRole(1L, "SUPERADMIN"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Rôle invalide");
    }

    @Test
    void setRole_shouldThrow_whenRemovingAdminRoleFromLastAdmin() {
        User admin = adminUser(1L);
        when(userRepo.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepo.countByRole(Role.ADMIN)).thenReturn(1L);

        assertThatThrownBy(() -> service.setRole(1L, "USER"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("dernier administrateur");
    }

    @Test
    void setRole_shouldSucceed_whenMultipleAdmins() {
        User admin = adminUser(1L);
        when(userRepo.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepo.countByRole(Role.ADMIN)).thenReturn(2L);
        when(userRepo.save(any())).thenReturn(admin);

        service.setRole(1L, "USER");

        assertThat(admin.getRole()).isEqualTo(Role.USER);
    }

    @Test
    void setRole_shouldDoNothing_whenRoleIsUnchanged() {
        User admin = adminUser(1L); // déjà ADMIN
        when(userRepo.findById(1L)).thenReturn(Optional.of(admin));

        service.setRole(1L, "ADMIN");

        verify(userRepo, never()).save(any());
    }

    // ─── delete ───────────────────────────────────────────────────────────────

    @Test
    void delete_shouldThrow_whenSelfDeletion() {
        assertThatThrownBy(() -> service.delete(1L, 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("propre compte");
    }

    @Test
    void delete_shouldThrow_whenDeletingLastAdmin() {
        User admin = adminUser(1L);
        when(userRepo.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepo.countByRole(Role.ADMIN)).thenReturn(1L);

        assertThatThrownBy(() -> service.delete(1L, 99L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("dernier administrateur");
    }

    @Test
    void delete_shouldSucceed_whenMultipleAdmins() {
        User admin = adminUser(1L);
        when(userRepo.findById(1L)).thenReturn(Optional.of(admin));
        when(userRepo.countByRole(Role.ADMIN)).thenReturn(2L);

        assertThatNoException().isThrownBy(() -> service.delete(1L, 99L));
        verify(userRepo).delete(admin);
    }

    @Test
    void delete_shouldThrow_whenUserNotFound() {
        when(userRepo.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(99L, 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found: 99");
    }

    // ─── resetPassword ────────────────────────────────────────────────────────

    @Test
    void resetPassword_shouldThrow_whenRequestIsNull() {
        assertThatThrownBy(() -> service.resetPassword(1L, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Request is required");
    }

    @Test
    void resetPassword_shouldThrow_whenPasswordsMismatch() {
        // La validation se fait AVANT le findById, donc pas besoin de stub
        UserDtos.ResetPasswordRequest req = new UserDtos.ResetPasswordRequest();
        req.setNewPassword("newpass123");
        req.setConfirmPassword("different");

        assertThatThrownBy(() -> service.resetPassword(1L, req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ne correspondent pas");
    }

    @Test
    void resetPassword_shouldSetForcePasswordChangeTrue() {
        User u = new User();
        u.setId(1L);
        u.setForcePasswordChange(false);
        when(userRepo.findById(1L)).thenReturn(Optional.of(u));
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");

        UserDtos.ResetPasswordRequest req = new UserDtos.ResetPasswordRequest();
        req.setNewPassword("newpass123");
        req.setConfirmPassword("newpass123");

        service.resetPassword(1L, req);

        assertThat(u.isForcePasswordChange()).isTrue();
        verify(userRepo).save(u);
    }
}
