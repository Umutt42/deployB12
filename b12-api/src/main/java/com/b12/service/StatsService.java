package com.b12.service;

import com.b12.domain.CenterAccreditation;
import com.b12.domain.TrainingAccreditation;
import com.b12.domain.TrainingActivity;
import com.b12.domain.enums.AccreditationRequestStatus;
import com.b12.repository.*;
import com.b12.web.dto.MonthlyStatDto;
import com.b12.web.dto.NamedStatDto;
import com.b12.web.dto.ProvinceStatDto;
import com.b12.web.dto.StatsDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StatsService {

    private final TrainingCenterRepository trainingCenterRepo;
    private final CenterAccreditationRepository centerAccreditationRepo;
    private final TrainingAccreditationRepository trainingAccreditationRepo;
    private final TrainerRepository trainerRepo;
    private final TrainingActivityRepository trainingActivityRepo;
    private final ThemeRepository themeRepo;
    private final LicenseTypeRepository licenseTypeRepo;
    private final SectorRepository sectorRepo;
    private final OrganismRepository organismRepo;
    private final PilotCenterRepository pilotCenterRepo;
    private final SubModuleRepository subModuleRepo;

    @Transactional(readOnly = true)
    public StatsDto compute() {
        LocalDate today = LocalDate.now();

        // ── Training Centers ────────────────────────────────────
        long tcActive   = trainingCenterRepo.countByArchivedFalse();
        long tcArchived = trainingCenterRepo.count() - tcActive;

        // ── Center Accreditations ───────────────────────────────
        long caActive   = centerAccreditationRepo.countByArchivedFalse();
        long caArchived = centerAccreditationRepo.count() - caActive;
        long caExp30    = centerAccreditationRepo.countByEndDateBetweenAndArchivedFalse(today, today.plusDays(30));
        long caExp60    = centerAccreditationRepo.countByEndDateBetweenAndArchivedFalse(today, today.plusDays(60));
        long caAccepted = centerAccreditationRepo.countByRequestStatusAndArchivedFalse(AccreditationRequestStatus.ACCEPTED);
        long caPending  = centerAccreditationRepo.countByRequestStatusAndArchivedFalse(AccreditationRequestStatus.PENDING);
        long caReceived = centerAccreditationRepo.countByRequestStatusAndArchivedFalse(AccreditationRequestStatus.RECEIVED);
        long caRefused  = centerAccreditationRepo.countByRequestStatusAndArchivedFalse(AccreditationRequestStatus.REFUSED);

        // ── Training Accreditations ─────────────────────────────
        long taActive   = trainingAccreditationRepo.countByArchivedFalse();
        long taArchived = trainingAccreditationRepo.count() - taActive;
        long taAccepted = trainingAccreditationRepo.countByRequestStatusAndArchivedFalse(AccreditationRequestStatus.ACCEPTED);
        long taPending  = trainingAccreditationRepo.countByRequestStatusAndArchivedFalse(AccreditationRequestStatus.PENDING);
        long taReceived = trainingAccreditationRepo.countByRequestStatusAndArchivedFalse(AccreditationRequestStatus.RECEIVED);
        long taRefused  = trainingAccreditationRepo.countByRequestStatusAndArchivedFalse(AccreditationRequestStatus.REFUSED);
        long taExp30    = trainingAccreditationRepo.countByEndDateBetweenAndArchivedFalse(today, today.plusDays(30));
        long taExp60    = trainingAccreditationRepo.countByEndDateBetweenAndArchivedFalse(today, today.plusDays(60));

        // ── Trainers ────────────────────────────────────────────
        long trainersActive   = trainerRepo.countByArchivedFalse();
        long trainersArchived = trainerRepo.count() - trainersActive;

        // ── Training Activities ─────────────────────────────────
        LocalDate yearStart = LocalDate.of(today.getYear(), 1, 1);
        LocalDate yearEnd   = LocalDate.of(today.getYear(), 12, 31);
        long activitiesThisYear = trainingActivityRepo.countByStartDateBetweenAndArchivedFalse(yearStart, yearEnd);
        long activitiesTotal    = trainingActivityRepo.countByArchivedFalse();

        // Monthly stats for last 12 months (activities)
        LocalDate from12Months = today.minusMonths(11).withDayOfMonth(1);
        List<TrainingActivity> recentActivities =
                trainingActivityRepo.findByStartDateBetweenAndArchivedFalse(from12Months, today);

        Map<String, Long> countByYearMonth = recentActivities.stream()
                .filter(a -> a.getStartDate() != null)
                .collect(Collectors.groupingBy(
                        a -> a.getStartDate().getYear() + "-" + a.getStartDate().getMonthValue(),
                        Collectors.counting()
                ));
        List<MonthlyStatDto> activitiesLast12Months = buildMonthlyList(today, countByYearMonth);

        // Activities by province
        List<ProvinceStatDto> activitiesByProvince = trainingActivityRepo.countByProvince().stream()
                .map(row -> new ProvinceStatDto((String) row[0], (Long) row[1]))
                .collect(Collectors.toList());

        // ── Tier 1 analyses ─────────────────────────────────────

        List<NamedStatDto> activitiesByLicenseType = trainingActivityRepo.countByLicenseType().stream()
                .map(row -> new NamedStatDto((String) row[0], (Long) row[1]))
                .collect(Collectors.toList());

        List<NamedStatDto> activitiesByTheme = trainingActivityRepo.countByTheme().stream()
                .map(row -> new NamedStatDto((String) row[0], (Long) row[1]))
                .collect(Collectors.toList());

        List<NamedStatDto> topTrainers = trainingActivityRepo.countByTrainer().stream()
                .limit(10)
                .map(row -> new NamedStatDto((String) row[0], (Long) row[1]))
                .collect(Collectors.toList());

        // Fusion agréments COMPLETE + SUB_MODULES par centre de formation
        Map<String, Long> centerCountMap = new java.util.LinkedHashMap<>();
        trainingAccreditationRepo.countByTrainingCenter()
                .forEach(row -> centerCountMap.merge((String) row[0], (Long) row[1], Long::sum));
        trainingAccreditationRepo.countSubModulesByTrainingCenter()
                .forEach(row -> centerCountMap.merge((String) row[0], (Long) row[1], Long::sum));
        List<NamedStatDto> trainingAccreditationsByCenter = centerCountMap.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(15)
                .map(e -> new NamedStatDto(e.getKey(), e.getValue()))
                .collect(Collectors.toList());

        // ── Tier 2 analyses ─────────────────────────────────────

        // Monthly trend — Center Accreditations
        List<CenterAccreditation> recentCA =
                centerAccreditationRepo.findByStartDateBetweenAndArchivedFalse(from12Months, today);
        Map<String, Long> countCAByMonth = recentCA.stream()
                .filter(ca -> ca.getStartDate() != null)
                .collect(Collectors.groupingBy(
                        ca -> ca.getStartDate().getYear() + "-" + ca.getStartDate().getMonthValue(),
                        Collectors.counting()
                ));
        List<MonthlyStatDto> centerAccreditationsLast12Months = buildMonthlyList(today, countCAByMonth);

        // Monthly trend — Training Accreditations
        List<TrainingAccreditation> recentTA =
                trainingAccreditationRepo.findByStartDateBetweenAndArchivedFalse(from12Months, today);
        Map<String, Long> countTAByMonth = recentTA.stream()
                .filter(ta -> ta.getStartDate() != null)
                .collect(Collectors.groupingBy(
                        ta -> ta.getStartDate().getYear() + "-" + ta.getStartDate().getMonthValue(),
                        Collectors.counting()
                ));
        List<MonthlyStatDto> trainingAccreditationsLast12Months = buildMonthlyList(today, countTAByMonth);

        // Avg processing days (receivedDate → startDate for ACCEPTED)
        double avgProcessingDaysCa = centerAccreditationRepo.findAcceptedWithProcessingDates().stream()
                .mapToLong(ca -> ChronoUnit.DAYS.between(ca.getReceivedDate(), ca.getStartDate()))
                .filter(d -> d >= 0)
                .average()
                .orElse(0);

        double avgProcessingDaysTa = trainingAccreditationRepo.findAcceptedWithProcessingDates().stream()
                .mapToLong(ta -> ChronoUnit.DAYS.between(ta.getReceivedDate(), ta.getStartDate()))
                .filter(d -> d >= 0)
                .average()
                .orElse(0);

        // Activities by sector
        List<NamedStatDto> activitiesBySector = trainingActivityRepo.countBySector().stream()
                .map(row -> new NamedStatDto((String) row[0], ((Number) row[1]).longValue()))
                .collect(Collectors.toList());

        // ── Reference data ──────────────────────────────────────
        long themesTotal       = themeRepo.countByArchivedFalse();
        long licenseTypesTotal = licenseTypeRepo.countByArchivedFalse();
        long sectorsTotal      = sectorRepo.countByArchivedFalse();
        long organismsTotal    = organismRepo.countByArchivedFalse();
        long pilotCentersTotal = pilotCenterRepo.countByArchivedFalse();
        long subModulesActive  = subModuleRepo.countByArchivedFalse();

        return new StatsDto(
                tcActive, tcArchived,
                caActive, caArchived, caExp30, caExp60,
                caAccepted, caPending, caReceived, caRefused,
                taActive, taArchived,
                taAccepted, taPending, taReceived, taRefused,
                trainersActive, trainersArchived,
                taExp30, taExp60,
                activitiesThisYear, activitiesTotal, activitiesLast12Months, activitiesByProvince,
                themesTotal, licenseTypesTotal, sectorsTotal, organismsTotal, pilotCentersTotal, subModulesActive,
                activitiesByLicenseType, activitiesByTheme, topTrainers, trainingAccreditationsByCenter,
                centerAccreditationsLast12Months, trainingAccreditationsLast12Months,
                avgProcessingDaysCa, avgProcessingDaysTa,
                activitiesBySector
        );
    }

    private List<MonthlyStatDto> buildMonthlyList(LocalDate today, Map<String, Long> countByYearMonth) {
        List<MonthlyStatDto> result = new ArrayList<>();
        for (int i = 11; i >= 0; i--) {
            YearMonth ym = YearMonth.from(today).minusMonths(i);
            String key = ym.getYear() + "-" + ym.getMonthValue();
            result.add(new MonthlyStatDto(ym.getYear(), ym.getMonthValue(),
                    countByYearMonth.getOrDefault(key, 0L)));
        }
        return result;
    }
}
