package com.b12.web;

import com.b12.security.JwtUserPrincipal;
import com.b12.service.UserAdminService;
import com.b12.web.dto.UserDtos;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class UserAdminController {

    private final UserAdminService service;

    // =========================
    // LIST
    // =========================
    @GetMapping
    public List<UserDtos.View> list() {
        return service.list();
    }

    // =========================
    // CREATE
    // =========================
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserDtos.View create(@Valid @RequestBody UserDtos.CreateRequest req) {
        return service.create(req);
    }

    // =========================
    // ACTIVER / DESACTIVER
    // =========================
    @PatchMapping("/{id}/active")
    public UserDtos.View setActive(
            @PathVariable Long id,
            @RequestParam boolean active
    ) {
        return service.setActive(id, active);
    }

    // =========================
    // RESET PASSWORD (ADMIN)
    // =========================
    @PostMapping("/{id}/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(
            @PathVariable Long id,
            @Valid @RequestBody UserDtos.ResetPasswordRequest req
    ) {
        service.resetPassword(id, req);
    }

    // =========================
    // DELETE USER (ADMIN)
    // =========================
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal JwtUserPrincipal principal,
            @PathVariable Long id
    ) {
        Long currentUserId = principal != null ? principal.getUserId() : null;
        service.delete(id, currentUserId);
    }
    @PatchMapping("/{id}/role")
public UserDtos.View setRole(@PathVariable Long id, @RequestParam String role) {
    return service.setRole(id, role);
}

}
