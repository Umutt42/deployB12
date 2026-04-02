package com.b12.service;

import com.b12.domain.CenterAccreditation;
import com.b12.repository.CenterAccreditationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AccreditationSchedulerTest {

    @Mock
    private CenterAccreditationRepository repo;

    @InjectMocks
    private AccreditationScheduler scheduler;

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private CenterAccreditation expiredCa(Long id) {
        CenterAccreditation ca = new CenterAccreditation();
        ca.setId(id);
        ca.setArchived(false);
        ca.setUpdatedBy("admin@test.com");
        return ca;
    }

    // ─── archiveExpiredAccreditations ─────────────────────────────────────────

    @Test
    void archiveExpiredAccreditations_shouldArchiveAllExpiredCas() {
        CenterAccreditation ca1 = expiredCa(1L);
        CenterAccreditation ca2 = expiredCa(2L);
        when(repo.findByEndDateBeforeAndArchivedFalse(any(LocalDate.class)))
                .thenReturn(List.of(ca1, ca2));

        scheduler.archiveExpiredAccreditations();

        assertThat(ca1.isArchived()).isTrue();
        assertThat(ca2.isArchived()).isTrue();
    }

    @Test
    void archiveExpiredAccreditations_shouldSetUpdatedByToSystem() {
        CenterAccreditation ca = expiredCa(1L);
        when(repo.findByEndDateBeforeAndArchivedFalse(any(LocalDate.class)))
                .thenReturn(List.of(ca));

        scheduler.archiveExpiredAccreditations();

        assertThat(ca.getUpdatedBy()).isEqualTo("system");
    }

    @Test
    void archiveExpiredAccreditations_shouldCallSaveAll_withExpiredCas() {
        CenterAccreditation ca1 = expiredCa(1L);
        CenterAccreditation ca2 = expiredCa(2L);
        when(repo.findByEndDateBeforeAndArchivedFalse(any(LocalDate.class)))
                .thenReturn(List.of(ca1, ca2));

        scheduler.archiveExpiredAccreditations();

        verify(repo).saveAll(List.of(ca1, ca2));
    }

    @Test
    void archiveExpiredAccreditations_shouldDoNothing_whenNoExpiredCas() {
        when(repo.findByEndDateBeforeAndArchivedFalse(any(LocalDate.class)))
                .thenReturn(List.of());

        scheduler.archiveExpiredAccreditations();

        verify(repo, never()).saveAll(any());
    }

    @Test
    void archiveExpiredAccreditations_shouldPassTodayAsDate() {
        when(repo.findByEndDateBeforeAndArchivedFalse(any(LocalDate.class)))
                .thenReturn(List.of());

        LocalDate before = LocalDate.now();
        scheduler.archiveExpiredAccreditations();
        LocalDate after = LocalDate.now();

        verify(repo).findByEndDateBeforeAndArchivedFalse(
                argThat(date -> !date.isBefore(before) && !date.isAfter(after))
        );
    }
}
