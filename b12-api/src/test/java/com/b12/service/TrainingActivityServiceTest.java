package com.b12.service;

import com.b12.domain.TrainingAccreditation;
import com.b12.domain.TrainingActivity;
import com.b12.repository.TrainingAccreditationRepository;
import com.b12.repository.TrainingActivityRepository;
import com.b12.web.dto.TrainingActivityDtos;
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
class TrainingActivityServiceTest {

    @Mock
    private TrainingActivityRepository activityRepo;

    @Mock
    private TrainingAccreditationRepository taRepo;

    @InjectMocks
    private TrainingActivityService service;

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private TrainingAccreditation ta(Long id, String number, String title) {
        TrainingAccreditation ta = new TrainingAccreditation();
        ta.setId(id);
        ta.setAccreditationNumber(number);
        ta.setTitle(title);
        return ta;
    }

    private TrainingActivity savedActivity(TrainingAccreditation ta) {
        TrainingActivity a = new TrainingActivity();
        a.setId(10L);
        a.setTrainingAccreditation(ta);
        a.setStartDate(LocalDate.of(2025, 6, 1));
        return a;
    }

    // ─── createDto : validations ──────────────────────────────────────────────

    @Test
    void createDto_shouldThrow_whenTrainingAccreditationIdIsNull() {
        TrainingActivityDtos dto = new TrainingActivityDtos();
        dto.setStartDate(LocalDate.now());

        assertThatThrownBy(() -> service.createDto(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("trainingAccreditationId is required");
    }

    @Test
    void createDto_shouldThrow_whenStartDateIsNull() {
        TrainingActivityDtos dto = new TrainingActivityDtos();
        dto.setTrainingAccreditationId(1L);

        assertThatThrownBy(() -> service.createDto(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("startDate is required");
    }

    @Test
    void createDto_shouldThrow_whenTaNotEligibleAtDate() {
        LocalDate date = LocalDate.of(2025, 6, 1);
        TrainingActivityDtos dto = new TrainingActivityDtos();
        dto.setTrainingAccreditationId(99L);
        dto.setStartDate(date);

        when(taRepo.findAllEligibleForActivity(date)).thenReturn(List.of());

        assertThatThrownBy(() -> service.createDto(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not active at date");
    }

    @Test
    void createDto_shouldThrow_whenTaExistsButNotForThisId() {
        LocalDate date = LocalDate.of(2025, 6, 1);
        TrainingActivityDtos dto = new TrainingActivityDtos();
        dto.setTrainingAccreditationId(99L);
        dto.setStartDate(date);

        // Il y a un TA éligible, mais pas celui demandé (id=1 au lieu de 99)
        when(taRepo.findAllEligibleForActivity(date)).thenReturn(List.of(ta(1L, "ACC-001", "Formation")));

        assertThatThrownBy(() -> service.createDto(dto))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not active at date");
    }

    @Test
    void createDto_shouldSucceed_whenTaIsEligible() {
        LocalDate date = LocalDate.of(2025, 6, 1);
        TrainingAccreditation eligible = ta(1L, "ACC-001", "Formation test");
        TrainingActivityDtos dto = new TrainingActivityDtos();
        dto.setTrainingAccreditationId(1L);
        dto.setStartDate(date);

        when(taRepo.findAllEligibleForActivity(date)).thenReturn(List.of(eligible));
        when(activityRepo.save(any())).thenAnswer(inv -> {
            TrainingActivity a = inv.getArgument(0);
            a.setId(10L);
            return a;
        });

        TrainingActivityDtos result = service.createDto(dto);

        assertThat(result).isNotNull();
        verify(activityRepo).save(any(TrainingActivity.class));
    }

    // ─── getDto ───────────────────────────────────────────────────────────────

    @Test
    void getDto_shouldThrow_whenNotFound() {
        when(activityRepo.findByIdWithAccreditation(42L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getDto(42L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("TrainingActivity not found: 42");
    }

    @Test
    void getDto_shouldReturnDto_whenFound() {
        TrainingAccreditation taEntity = ta(1L, "ACC-001", "Test");
        TrainingActivity activity = savedActivity(taEntity);
        when(activityRepo.findByIdWithAccreditation(10L)).thenReturn(Optional.of(activity));

        TrainingActivityDtos result = service.getDto(10L);

        assertThat(result).isNotNull();
        assertThat(result.getTrainingAccreditationId()).isEqualTo(1L);
    }

    // ─── archiveDto ───────────────────────────────────────────────────────────

    @Test
    void archiveDto_shouldSetArchivedTrue() {
        TrainingAccreditation taEntity = ta(1L, "ACC-001", "Test");
        TrainingActivity activity = savedActivity(taEntity);
        activity.setArchived(false);

        when(activityRepo.findByIdWithAccreditation(10L)).thenReturn(Optional.of(activity));
        when(activityRepo.save(any())).thenReturn(activity);

        service.archiveDto(10L, true);

        assertThat(activity.isArchived()).isTrue();
        verify(activityRepo).save(activity);
    }

    @Test
    void archiveDto_shouldSetArchivedFalse_whenUnarchiving() {
        TrainingAccreditation taEntity = ta(1L, "ACC-001", "Test");
        TrainingActivity activity = savedActivity(taEntity);
        activity.setArchived(true);

        when(activityRepo.findByIdWithAccreditation(10L)).thenReturn(Optional.of(activity));
        when(activityRepo.save(any())).thenReturn(activity);

        service.archiveDto(10L, false);

        assertThat(activity.isArchived()).isFalse();
    }

    @Test
    void archiveDto_shouldThrow_whenNotFound() {
        when(activityRepo.findByIdWithAccreditation(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.archiveDto(99L, true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("TrainingActivity not found: 99");
    }

    // ─── delete ───────────────────────────────────────────────────────────────

    @Test
    void delete_shouldThrow_whenNotFound() {
        when(activityRepo.findByIdWithAccreditation(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(99L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("TrainingActivity not found: 99");
    }

    @Test
    void delete_shouldCallRepositoryDelete_whenFound() {
        TrainingAccreditation taEntity = ta(1L, "ACC-001", "Test");
        TrainingActivity activity = savedActivity(taEntity);

        when(activityRepo.findByIdWithAccreditation(10L)).thenReturn(Optional.of(activity));

        service.delete(10L);

        verify(activityRepo).delete(activity);
    }

    // ─── findEligible : label ─────────────────────────────────────────────────

    @Test
    void findEligible_shouldBuildLabel_withAccreditationNumberAndTitle() {
        LocalDate date = LocalDate.of(2025, 6, 1);
        when(taRepo.findAllEligibleForActivity(date))
                .thenReturn(List.of(ta(1L, "ACC-001", "Phytolicence formation")));

        List<TrainingActivityDtos> result = service.findEligible(date);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getTrainingAccreditationLabel())
                .isEqualTo("ACC-001 — Phytolicence formation");
    }

    @Test
    void findEligible_shouldUseFallbackId_whenNoAccreditationNumber() {
        LocalDate date = LocalDate.of(2025, 6, 1);
        when(taRepo.findAllEligibleForActivity(date))
                .thenReturn(List.of(ta(7L, null, "Formation sans numéro")));

        List<TrainingActivityDtos> result = service.findEligible(date);

        assertThat(result.get(0).getTrainingAccreditationLabel())
                .isEqualTo("#7 — Formation sans numéro");
    }

    @Test
    void findEligible_shouldReturnEmptyList_whenNoneEligible() {
        LocalDate date = LocalDate.of(2025, 6, 1);
        when(taRepo.findAllEligibleForActivity(date)).thenReturn(List.of());

        assertThat(service.findEligible(date)).isEmpty();
    }

    @Test
    void findEligible_shouldOmitDash_whenTitleIsBlank() {
        LocalDate date = LocalDate.of(2025, 6, 1);
        when(taRepo.findAllEligibleForActivity(date))
                .thenReturn(List.of(ta(1L, "ACC-001", "")));

        List<TrainingActivityDtos> result = service.findEligible(date);

        assertThat(result.get(0).getTrainingAccreditationLabel()).isEqualTo("ACC-001");
    }
}
