package com.b12.web;

import com.b12.domain.SubTheme;
import com.b12.service.SubThemeService;
import com.b12.web.dto.SubThemeDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/sub-themes")
@RequiredArgsConstructor
public class SubThemeController {

    private final SubThemeService subThemeService;

    // Créer un sous-thème (besoin: themeId + name)
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public SubThemeDtos create(@RequestBody SubThemeDtos dto) {
        SubTheme created = subThemeService.create(dto);
        return toDto(created);
    }

    // Lister les sous-thèmes d’un thème (triés par label)
    // Exemple: GET /api/sub-themes?themeId=1
    @GetMapping
    public List<SubThemeDtos> findByTheme(@RequestParam Long themeId) {
        return subThemeService.findByTheme(themeId)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public SubThemeDtos get(@PathVariable Long id) {
        return toDto(subThemeService.get(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public SubThemeDtos update(@PathVariable Long id, @RequestBody SubThemeDtos dto) {
        return toDto(subThemeService.update(id, dto));
    }

    // Archive / unarchive
    @PatchMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public SubThemeDtos archive(@PathVariable Long id, @RequestParam boolean archived) {
        return toDto(subThemeService.archive(id, archived));
    }

    // =========================================================
    // IMPORT — PREVIEW
    // POST /api/sub-themes/import/preview
    // =========================================================
    @PostMapping("/import/preview")
    @PreAuthorize("hasRole('ADMIN')")
    public List<SubThemeDtos.ImportRow> previewImport(
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        return subThemeService.previewImport(file);
    }

    // --- mapping entity -> dto ---
    private SubThemeDtos toDto(SubTheme st) {
        SubThemeDtos dto = new SubThemeDtos();
        dto.setId(st.getId());
        dto.setName(st.getLabel()); // IMPORTANT: label -> name côté API
        dto.setDescription(st.getDescription());
        dto.setHours(st.getHours());
        dto.setArchived(st.isArchived());
        dto.setThemeId(st.getTheme() != null ? st.getTheme().getId() : null);
        return dto;
    }
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public void delete(@PathVariable Long id) {
        subThemeService.delete(id);
    }

}
