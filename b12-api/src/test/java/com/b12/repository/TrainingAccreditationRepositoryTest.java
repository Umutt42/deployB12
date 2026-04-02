package com.b12.repository;

import com.b12.domain.CenterAccreditation;
import com.b12.domain.TrainingAccreditation;
import com.b12.domain.TrainingCenter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests de la requête findAllEligibleForActivity — cœur du métier.
 *
 * Règle : un TA est éligible si TA.startDate <= date <= TA.endDate
 *         ET CA.startDate <= date <= CA.endDate (NULL = pas de borne).
 */
@DataJpaTest
@TestPropertySource(properties = "spring.sql.init.mode=never")
class TrainingAccreditationRepositoryTest {

    @Autowired TestEntityManager em;
    @Autowired TrainingAccreditationRepository repo;

    private static final LocalDate TEST_DATE = LocalDate.of(2025, 6, 15);

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private TrainingCenter saveCenter(String name, String companyNumber) {
        TrainingCenter tc = new TrainingCenter();
        tc.setName(name);
        tc.setCompanyNumber(companyNumber);
        tc.setArchived(false);
        return em.persistAndFlush(tc);
    }

    private CenterAccreditation saveCa(TrainingCenter tc, LocalDate start, LocalDate end) {
        CenterAccreditation ca = new CenterAccreditation();
        ca.setTrainingCenter(tc);
        ca.setStartDate(start);
        ca.setEndDate(end);
        ca.setArchived(false);
        return em.persistAndFlush(ca);
    }

    private TrainingAccreditation saveTa(CenterAccreditation ca, LocalDate start, LocalDate end) {
        TrainingAccreditation ta = new TrainingAccreditation();
        ta.setCenterAccreditation(ca);
        ta.setTitle("Formation test");
        ta.setStartDate(start);
        ta.setEndDate(end);
        ta.setArchived(false);
        return em.persistAndFlush(ta);
    }

    // ─── Tests ───────────────────────────────────────────────────────────────

    @Test
    void shouldReturnTa_whenBothTaAndCaCoverTheDate() {
        TrainingCenter tc = saveCenter("Centre A", "BE001");
        CenterAccreditation ca = saveCa(tc, LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31));
        TrainingAccreditation ta = saveTa(ca, LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31));

        List<TrainingAccreditation> result = repo.findAllEligibleForActivity(TEST_DATE);

        assertThat(result).extracting(TrainingAccreditation::getId).contains(ta.getId());
    }

    @Test
    void shouldExcludeTa_whenTaStartDateAfterTestDate() {
        TrainingCenter tc = saveCenter("Centre B", "BE002");
        CenterAccreditation ca = saveCa(tc, LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31));
        saveTa(ca, LocalDate.of(2025, 7, 1), LocalDate.of(2025, 12, 31)); // commence après le test_date

        List<TrainingAccreditation> result = repo.findAllEligibleForActivity(TEST_DATE);

        assertThat(result).isEmpty();
    }

    @Test
    void shouldExcludeTa_whenTaEndDateBeforeTestDate() {
        TrainingCenter tc = saveCenter("Centre C", "BE003");
        CenterAccreditation ca = saveCa(tc, LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31));
        saveTa(ca, LocalDate.of(2025, 1, 1), LocalDate.of(2025, 6, 1)); // finit avant le test_date

        List<TrainingAccreditation> result = repo.findAllEligibleForActivity(TEST_DATE);

        assertThat(result).isEmpty();
    }

    @Test
    void shouldExcludeTa_whenCaStartDateAfterTestDate() {
        TrainingCenter tc = saveCenter("Centre D", "BE004");
        CenterAccreditation ca = saveCa(tc, LocalDate.of(2025, 7, 1), LocalDate.of(2026, 12, 31)); // CA commence après
        saveTa(ca, LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31));

        List<TrainingAccreditation> result = repo.findAllEligibleForActivity(TEST_DATE);

        assertThat(result).isEmpty();
    }

    @Test
    void shouldExcludeTa_whenCaEndDateBeforeTestDate() {
        TrainingCenter tc = saveCenter("Centre E", "BE005");
        CenterAccreditation ca = saveCa(tc, LocalDate.of(2025, 1, 1), LocalDate.of(2025, 6, 1)); // CA finit avant
        saveTa(ca, LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31));

        List<TrainingAccreditation> result = repo.findAllEligibleForActivity(TEST_DATE);

        assertThat(result).isEmpty();
    }

    @Test
    void shouldReturnTa_whenAllDatesAreNull() {
        // TA + CA sans borne de dates → toujours éligible
        TrainingCenter tc = saveCenter("Centre F", "BE006");
        CenterAccreditation ca = saveCa(tc, null, null);
        TrainingAccreditation ta = saveTa(ca, null, null);

        List<TrainingAccreditation> result = repo.findAllEligibleForActivity(TEST_DATE);

        assertThat(result).extracting(TrainingAccreditation::getId).contains(ta.getId());
    }

    @Test
    void shouldReturnTa_whenOnlyTaStartDateIsNull() {
        // Pas de date de début → TA eligible depuis toujours (jusqu'à endDate)
        TrainingCenter tc = saveCenter("Centre G", "BE007");
        CenterAccreditation ca = saveCa(tc, LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31));
        TrainingAccreditation ta = saveTa(ca, null, LocalDate.of(2025, 12, 31));

        List<TrainingAccreditation> result = repo.findAllEligibleForActivity(TEST_DATE);

        assertThat(result).extracting(TrainingAccreditation::getId).contains(ta.getId());
    }

    @Test
    void shouldReturnOnlyEligibleTas_whenMixed() {
        TrainingCenter tc = saveCenter("Centre H", "BE008");
        CenterAccreditation ca = saveCa(tc, LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31));

        // Éligible
        TrainingAccreditation eligible = saveTa(ca, LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31));
        // Non éligible (TA finit avant la date)
        saveTa(ca, LocalDate.of(2025, 1, 1), LocalDate.of(2025, 6, 1));

        List<TrainingAccreditation> result = repo.findAllEligibleForActivity(TEST_DATE);

        assertThat(result).extracting(TrainingAccreditation::getId).containsOnly(eligible.getId());
    }

    @Test
    void shouldReturnTa_whenDateIsExactlyOnTaBoundaries() {
        // date = TA.startDate = TA.endDate (cas limite)
        LocalDate boundary = LocalDate.of(2025, 6, 15);
        TrainingCenter tc = saveCenter("Centre I", "BE009");
        CenterAccreditation ca = saveCa(tc, LocalDate.of(2025, 1, 1), LocalDate.of(2025, 12, 31));
        TrainingAccreditation ta = saveTa(ca, boundary, boundary);

        List<TrainingAccreditation> result = repo.findAllEligibleForActivity(boundary);

        assertThat(result).extracting(TrainingAccreditation::getId).contains(ta.getId());
    }
}
