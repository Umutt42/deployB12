package com.b12.web.dto;

import java.util.List;

public record StatsDto(

    // ── Centres de formation ──────────────────────────────
    long trainingCentersActive,
    long trainingCentersArchived,

    // ── Agréments centres ─────────────────────────────────
    long centerAccreditationsActive,
    long centerAccreditationsArchived,
    long centerAccreditationsExpiringIn30Days,
    long centerAccreditationsExpiringIn60Days,
    long caAccepted,
    long caPending,
    long caReceived,
    long caRefused,

    // ── Agréments formation ───────────────────────────────
    long trainingAccreditationsActive,
    long trainingAccreditationsArchived,
    long taAccepted,
    long taPending,
    long taReceived,
    long taRefused,

    // ── Formateurs ────────────────────────────────────────
    long trainersActive,
    long trainersArchived,

    // ── Agréments formation — expirations ─────────────────
    long trainingAccreditationsExpiringIn30Days,
    long trainingAccreditationsExpiringIn60Days,

    // ── Activités de formation ────────────────────────────
    long activitiesThisYear,
    long activitiesTotal,
    List<MonthlyStatDto> activitiesLast12Months,
    List<ProvinceStatDto> activitiesByProvince,

    // ── Données de référence ──────────────────────────────
    long themesTotal,
    long licenseTypesTotal,
    long sectorsTotal,
    long organismsTotal,
    long pilotCentersTotal,
    long subModulesActive,

    // ── Tier 1 — Analyses complémentaires ────────────────
    List<NamedStatDto> activitiesByLicenseType,
    List<NamedStatDto> activitiesByTheme,
    List<NamedStatDto> topTrainers,
    List<NamedStatDto> trainingAccreditationsByCenter,

    // ── Tier 2 — Analyses avancées ───────────────────────
    List<MonthlyStatDto> centerAccreditationsLast12Months,
    List<MonthlyStatDto> trainingAccreditationsLast12Months,
    double avgProcessingDaysCa,
    double avgProcessingDaysTa,
    List<NamedStatDto> activitiesBySector
) {}
