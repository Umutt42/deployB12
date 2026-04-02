package com.b12.service;

import com.b12.domain.CenterAccreditation;
import com.b12.domain.TrainingAccreditation;
import com.b12.repository.*;
import com.b12.web.dto.TrainingAccreditationDtos;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TrainingAccreditationServiceTest {

    @Mock private TrainingAccreditationRepository taRepo;
    @Mock private CenterAccreditationRepository caRepo;
    @Mock private LicenseTypeRepository licenseTypeRepo;
    @Mock private ThemeRepository themeRepo;
    @Mock private SubThemeRepository subThemeRepo;
    @Mock private TrainerRepository trainerRepo;

    @InjectMocks
    private TrainingAccreditationService service;

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private CenterAccreditation ca(LocalDate start, LocalDate end) {
        CenterAccreditation ca = new CenterAccreditation();
        ca.setId(1L);
        ca.setStartDate(start);
        ca.setEndDate(end);
        return ca;
    }

    private TrainingAccreditationDtos dtoWith(Long caId, String title, LocalDate startDate) {
        TrainingAccreditationDtos dto = new TrainingAccreditationDtos();
        dto.setCenterAccreditationId(caId);
        dto.setTitle(title);
        dto.setStartDate(startDate);
        return dto;
    }

    private void mockSave() {
        when(taRepo.save(any())).thenAnswer(inv -> {
            TrainingAccreditation ta = inv.getArgument(0);
            ta.setId(1L);
            return ta;
        });
    }

    // ─── createDto : validations obligatoires ────────────────────────────────

    @Test
    void createDto_shouldThrow_whenCenterAccreditationIdIsNull() {
        TrainingAccreditationDtos dto = dtoWith(null, "Formation", LocalDate.now());

        assertThatThrownBy(() -> service.createDto(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("centerAccreditationId is required");
    }

    @Test
    void createDto_shouldThrow_whenCenterAccreditationNotFound() {
        when(caRepo.findById(99L)).thenReturn(Optional.empty());
        TrainingAccreditationDtos dto = dtoWith(99L, "Formation", LocalDate.now());

        assertThatThrownBy(() -> service.createDto(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("CenterAccreditation not found: 99");
    }

    @Test
    void createDto_shouldThrow_whenTitleIsNull() {
        when(caRepo.findById(1L)).thenReturn(Optional.of(ca(null, null)));
        TrainingAccreditationDtos dto = dtoWith(1L, null, LocalDate.now());

        assertThatThrownBy(() -> service.createDto(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("title is required");
    }

    @Test
    void createDto_shouldThrow_whenTitleIsBlank() {
        when(caRepo.findById(1L)).thenReturn(Optional.of(ca(null, null)));
        TrainingAccreditationDtos dto = dtoWith(1L, "   ", LocalDate.now());

        assertThatThrownBy(() -> service.createDto(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("title is required");
    }

    // ─── createDto : règle date (TA.startDate doit être < CA.endDate) ─────────

    @Test
    void createDto_shouldThrow_whenStartDateEqualsOrAfterCaEndDate() {
        LocalDate caEnd = LocalDate.of(2025, 12, 31);
        when(caRepo.findById(1L)).thenReturn(Optional.of(ca(null, caEnd)));

        // startDate = caEnd → doit échouer (condition : startDate.isBefore(caEnd))
        TrainingAccreditationDtos dto = dtoWith(1L, "Formation", caEnd);

        assertThatThrownBy(() -> service.createDto(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("doit être antérieure");
    }

    @Test
    void createDto_shouldThrow_whenStartDateAfterCaEndDate() {
        LocalDate caEnd = LocalDate.of(2025, 12, 31);
        when(caRepo.findById(1L)).thenReturn(Optional.of(ca(null, caEnd)));

        TrainingAccreditationDtos dto = dtoWith(1L, "Formation", LocalDate.of(2026, 1, 1));

        assertThatThrownBy(() -> service.createDto(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("doit être antérieure");
    }

    @Test
    void createDto_shouldSucceed_whenStartDateBeforeCaEndDate() {
        LocalDate caEnd = LocalDate.of(2025, 12, 31);
        when(caRepo.findById(1L)).thenReturn(Optional.of(ca(null, caEnd)));
        mockSave();

        TrainingAccreditationDtos dto = dtoWith(1L, "Formation valide", LocalDate.of(2025, 6, 1));

        assertThatNoException().isThrownBy(() -> service.createDto(dto));
        verify(taRepo).save(any());
    }

    @Test
    void createDto_shouldSucceed_whenCaEndDateIsNull() {
        // Pas de date de fin sur le CA → aucune contrainte de date
        when(caRepo.findById(1L)).thenReturn(Optional.of(ca(null, null)));
        mockSave();

        TrainingAccreditationDtos dto = dtoWith(1L, "Formation open-ended", LocalDate.of(2030, 1, 1));

        assertThatNoException().isThrownBy(() -> service.createDto(dto));
    }

    @Test
    void createDto_shouldSucceed_whenStartDateIsNull() {
        // Pas de startDate sur la formation → la contrainte ne s'applique pas
        when(caRepo.findById(1L)).thenReturn(Optional.of(ca(null, LocalDate.of(2025, 12, 31))));
        mockSave();

        TrainingAccreditationDtos dto = dtoWith(1L, "Formation sans date", null);

        assertThatNoException().isThrownBy(() -> service.createDto(dto));
    }

    // ─── getDto ───────────────────────────────────────────────────────────────

    @Test
    void getDto_shouldThrow_whenNotFound() {
        when(taRepo.findByIdWithRelations(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getDto(99L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("TrainingAccreditation not found: 99");
    }

    // ─── findAllByIds ─────────────────────────────────────────────────────────

    @Test
    void findAllByIds_shouldReturnEmpty_whenIdsIsNull() {
        assertThat(service.findAllByIds(null)).isEmpty();
        verifyNoInteractions(taRepo);
    }

    @Test
    void findAllByIds_shouldReturnEmpty_whenIdsIsEmpty() {
        assertThat(service.findAllByIds(List.of())).isEmpty();
        verifyNoInteractions(taRepo);
    }

    // ─── archiveDto ───────────────────────────────────────────────────────────

    @Test
    void archiveDto_shouldThrow_whenNotFound() {
        when(taRepo.findByIdWithRelations(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.archiveDto(99L, true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("TrainingAccreditation not found: 99");
    }

    // ─── delete ───────────────────────────────────────────────────────────────

    @Test
    void delete_shouldThrow_whenNotFound() {
        when(taRepo.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(99L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("TrainingAccreditation not found: 99");
    }
}
