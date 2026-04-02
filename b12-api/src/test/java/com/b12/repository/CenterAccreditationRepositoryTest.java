package com.b12.repository;

import com.b12.domain.CenterAccreditation;
import com.b12.domain.TrainingCenter;
import com.b12.domain.enums.AccreditationRequestStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@TestPropertySource(properties = "spring.sql.init.mode=never")
class CenterAccreditationRepositoryTest {

    @Autowired TestEntityManager em;
    @Autowired CenterAccreditationRepository repo;

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private TrainingCenter saveCenter(String name, String companyNumber) {
        TrainingCenter tc = new TrainingCenter();
        tc.setName(name);
        tc.setCompanyNumber(companyNumber);
        tc.setArchived(false);
        return em.persistAndFlush(tc);
    }

    private CenterAccreditation saveCa(TrainingCenter tc, LocalDate start, LocalDate end,
                                        boolean archived, AccreditationRequestStatus status) {
        CenterAccreditation ca = new CenterAccreditation();
        ca.setTrainingCenter(tc);
        ca.setStartDate(start);
        ca.setEndDate(end);
        ca.setArchived(archived);
        ca.setRequestStatus(status);
        return em.persistAndFlush(ca);
    }

    // ─── findByEndDateBeforeAndArchivedFalse ─────────────────────────────────

    @Test
    void findExpired_shouldReturnCa_whenEndDateIsBeforeTodayAndNotArchived() {
        TrainingCenter tc = saveCenter("Centre A", "BE001");
        CenterAccreditation ca = saveCa(tc,
                LocalDate.of(2023, 1, 1), LocalDate.of(2023, 12, 31),
                false, null);

        List<CenterAccreditation> result =
                repo.findByEndDateBeforeAndArchivedFalse(LocalDate.of(2024, 6, 1));

        assertThat(result).extracting(CenterAccreditation::getId).contains(ca.getId());
    }

    @Test
    void findExpired_shouldExcludeCa_whenAlreadyArchived() {
        TrainingCenter tc = saveCenter("Centre B", "BE002");
        saveCa(tc,
                LocalDate.of(2023, 1, 1), LocalDate.of(2023, 12, 31),
                true, null); // déjà archivé

        List<CenterAccreditation> result =
                repo.findByEndDateBeforeAndArchivedFalse(LocalDate.of(2024, 6, 1));

        assertThat(result).isEmpty();
    }

    @Test
    void findExpired_shouldExcludeCa_whenEndDateIsInTheFuture() {
        TrainingCenter tc = saveCenter("Centre C", "BE003");
        saveCa(tc,
                LocalDate.of(2025, 1, 1), LocalDate.of(2026, 12, 31),
                false, null); // encore valide

        List<CenterAccreditation> result =
                repo.findByEndDateBeforeAndArchivedFalse(LocalDate.of(2025, 6, 1));

        assertThat(result).isEmpty();
    }

    @Test
    void findExpired_shouldReturnOnlyExpiredAndNotArchived_whenMixed() {
        TrainingCenter tc = saveCenter("Centre D", "BE004");

        CenterAccreditation expired = saveCa(tc,
                LocalDate.of(2023, 1, 1), LocalDate.of(2023, 12, 31),
                false, null);
        saveCa(tc,
                LocalDate.of(2025, 1, 1), LocalDate.of(2026, 12, 31),
                false, null); // pas encore expiré

        List<CenterAccreditation> result =
                repo.findByEndDateBeforeAndArchivedFalse(LocalDate.of(2024, 6, 1));

        assertThat(result).extracting(CenterAccreditation::getId).containsOnly(expired.getId());
    }

    // ─── findActiveAt ─────────────────────────────────────────────────────────

    @Test
    void findActiveAt_shouldReturnCa_whenStatusIsAcceptedAndDateInRange() {
        TrainingCenter tc = saveCenter("Centre E", "BE005");
        CenterAccreditation ca = saveCa(tc,
                LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31),
                false, AccreditationRequestStatus.ACCEPTED);

        List<CenterAccreditation> result = repo.findActiveAt(LocalDate.of(2025, 6, 15));

        assertThat(result).extracting(CenterAccreditation::getId).contains(ca.getId());
    }

    @Test
    void findActiveAt_shouldExcludeCa_whenStatusIsPending() {
        TrainingCenter tc = saveCenter("Centre F", "BE006");
        saveCa(tc,
                LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31),
                false, AccreditationRequestStatus.PENDING);

        List<CenterAccreditation> result = repo.findActiveAt(LocalDate.of(2025, 6, 15));

        assertThat(result).isEmpty();
    }

    @Test
    void findActiveAt_shouldExcludeCa_whenDateBeforeStartDate() {
        TrainingCenter tc = saveCenter("Centre G", "BE007");
        saveCa(tc,
                LocalDate.of(2025, 7, 1), LocalDate.of(2025, 12, 31),
                false, AccreditationRequestStatus.ACCEPTED);

        List<CenterAccreditation> result = repo.findActiveAt(LocalDate.of(2025, 6, 15));

        assertThat(result).isEmpty();
    }

    @Test
    void findActiveAt_shouldExcludeCa_whenDateAfterEndDate() {
        TrainingCenter tc = saveCenter("Centre H", "BE008");
        saveCa(tc,
                LocalDate.of(2025, 1, 1), LocalDate.of(2025, 6, 1),
                false, AccreditationRequestStatus.ACCEPTED);

        List<CenterAccreditation> result = repo.findActiveAt(LocalDate.of(2025, 6, 15));

        assertThat(result).isEmpty();
    }

    @Test
    void findActiveAt_shouldReturnCa_whenStartAndEndDatesAreNull() {
        // Pas de bornes de dates → toujours actif (si ACCEPTED)
        TrainingCenter tc = saveCenter("Centre I", "BE009");
        CenterAccreditation ca = saveCa(tc, null, null, false, AccreditationRequestStatus.ACCEPTED);

        List<CenterAccreditation> result = repo.findActiveAt(LocalDate.of(2025, 6, 15));

        assertThat(result).extracting(CenterAccreditation::getId).contains(ca.getId());
    }

    @Test
    void findActiveAt_shouldReturnCa_whenDateIsOnBoundaryDates() {
        LocalDate start = LocalDate.of(2025, 6, 15);
        LocalDate end = LocalDate.of(2025, 6, 15);
        TrainingCenter tc = saveCenter("Centre J", "BE010");
        CenterAccreditation ca = saveCa(tc, start, end, false, AccreditationRequestStatus.ACCEPTED);

        List<CenterAccreditation> result = repo.findActiveAt(LocalDate.of(2025, 6, 15));

        assertThat(result).extracting(CenterAccreditation::getId).contains(ca.getId());
    }
}
