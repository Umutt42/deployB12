package com.b12.service;

import com.b12.domain.SubTheme;
import com.b12.domain.Theme;
import com.b12.repository.ThemeRepository;
import com.b12.web.dto.ThemeDtos;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ThemeServiceTest {

    @Mock
    private ThemeRepository themeRepo;

    @InjectMocks
    private ThemeService service;

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private Theme themeWithNoSubThemes(Long id, String label) {
        Theme t = new Theme();
        t.setId(id);
        t.setLabel(label);
        t.setSubThemes(new ArrayList<>());
        return t;
    }

    private Theme themeWithSubThemes(Long id, String label) {
        SubTheme sub = new SubTheme();
        Theme t = new Theme();
        t.setId(id);
        t.setLabel(label);
        t.setSubThemes(new ArrayList<>(List.of(sub)));
        return t;
    }

    // ─── create ───────────────────────────────────────────────────────────────

    @Test
    void create_shouldThrow_whenLabelIsNull() {
        ThemeDtos dto = new ThemeDtos();
        dto.setName(null);

        assertThatThrownBy(() -> service.create(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("required");
    }

    @Test
    void create_shouldThrow_whenLabelIsBlank() {
        ThemeDtos dto = new ThemeDtos();
        dto.setName("   ");

        assertThatThrownBy(() -> service.create(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("required");
    }

    @Test
    void create_shouldThrow_whenLabelAlreadyExists() {
        when(themeRepo.findByLabelIgnoreCase("Phytolicence"))
                .thenReturn(Optional.of(themeWithNoSubThemes(1L, "Phytolicence")));

        ThemeDtos dto = new ThemeDtos();
        dto.setName("Phytolicence");

        assertThatThrownBy(() -> service.create(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void create_shouldSave_whenLabelIsUnique() {
        when(themeRepo.findByLabelIgnoreCase("Nouveau thème")).thenReturn(Optional.empty());
        Theme saved = themeWithNoSubThemes(1L, "Nouveau thème");
        when(themeRepo.save(any())).thenReturn(saved);

        ThemeDtos dto = new ThemeDtos();
        dto.setName("Nouveau thème");

        Theme result = service.create(dto);

        assertThat(result.getLabel()).isEqualTo("Nouveau thème");
        verify(themeRepo).save(any());
    }

    @Test
    void create_shouldTrimLabelBeforeSaving() {
        when(themeRepo.findByLabelIgnoreCase("Thème trimmé")).thenReturn(Optional.empty());
        Theme saved = themeWithNoSubThemes(1L, "Thème trimmé");
        when(themeRepo.save(any())).thenReturn(saved);

        ThemeDtos dto = new ThemeDtos();
        dto.setName("  Thème trimmé  ");

        service.create(dto);

        verify(themeRepo).save(argThat(t -> "Thème trimmé".equals(t.getLabel())));
    }

    // ─── delete ───────────────────────────────────────────────────────────────

    @Test
    void delete_shouldThrow_whenThemeHasSubThemes() {
        when(themeRepo.findByIdWithSubThemes(1L))
                .thenReturn(Optional.of(themeWithSubThemes(1L, "Avec sous-thèmes")));

        assertThatThrownBy(() -> service.delete(1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("sous-thèmes");
    }

    @Test
    void delete_shouldSucceed_whenThemeHasNoSubThemes() {
        Theme theme = themeWithNoSubThemes(1L, "Sans sous-thèmes");
        when(themeRepo.findByIdWithSubThemes(1L)).thenReturn(Optional.of(theme));

        assertThatNoException().isThrownBy(() -> service.delete(1L));
        verify(themeRepo).delete(theme);
    }

    @Test
    void delete_shouldThrow_whenThemeNotFound() {
        when(themeRepo.findByIdWithSubThemes(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(99L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Theme not found: 99");
    }

    // ─── update ───────────────────────────────────────────────────────────────

    @Test
    void update_shouldThrow_whenNewLabelAlreadyTakenByAnotherTheme() {
        Theme current = themeWithNoSubThemes(1L, "Thème A");
        Theme existing = themeWithNoSubThemes(2L, "Thème B");
        when(themeRepo.findByIdWithSubThemes(1L)).thenReturn(Optional.of(current));
        when(themeRepo.findByLabelIgnoreCase("Thème B")).thenReturn(Optional.of(existing));

        ThemeDtos dto = new ThemeDtos();
        dto.setName("Thème B");

        assertThatThrownBy(() -> service.update(1L, dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void update_shouldSucceed_whenLabelIsUnchanged() {
        Theme current = themeWithNoSubThemes(1L, "Thème A");
        when(themeRepo.findByIdWithSubThemes(1L)).thenReturn(Optional.of(current));
        when(themeRepo.save(any())).thenReturn(current);

        ThemeDtos dto = new ThemeDtos();
        dto.setName("Thème A"); // même label en casse différente

        assertThatNoException().isThrownBy(() -> service.update(1L, dto));
        // Pas de vérification d'unicité quand le label ne change pas
        verify(themeRepo, never()).findByLabelIgnoreCase(any());
    }

    @Test
    void update_shouldSucceed_whenNewLabelIsAvailable() {
        Theme current = themeWithNoSubThemes(1L, "Thème A");
        when(themeRepo.findByIdWithSubThemes(1L)).thenReturn(Optional.of(current));
        when(themeRepo.findByLabelIgnoreCase("Thème C")).thenReturn(Optional.empty());
        when(themeRepo.save(any())).thenReturn(current);

        ThemeDtos dto = new ThemeDtos();
        dto.setName("Thème C");

        assertThatNoException().isThrownBy(() -> service.update(1L, dto));
        assertThat(current.getLabel()).isEqualTo("Thème C");
    }

    // ─── findAllByIds ─────────────────────────────────────────────────────────

    @Test
    void findAllByIds_shouldReturnEmpty_whenIdsIsNull() {
        assertThat(service.findAllByIds(null)).isEmpty();
        verifyNoInteractions(themeRepo);
    }

    @Test
    void findAllByIds_shouldReturnEmpty_whenIdsIsEmpty() {
        assertThat(service.findAllByIds(List.of())).isEmpty();
        verifyNoInteractions(themeRepo);
    }
}
