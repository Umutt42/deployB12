package com.b12.web.dto;

import java.util.List;

public class DataMigrationDtos {

    // =========================
    // RÉSULTAT GÉNÉRIQUE
    // =========================

    public record ImportError(int row, String field, String message) {}

    public record ImportResult(
            int total,
            int created,
            int skipped,
            List<ImportError> errors
    ) {}

    // =========================
    // APERÇU (preview sans sauvegarde)
    // =========================

    public record PreviewResult(
            int total,
            int valid,
            int withErrors,
            List<ImportError> errors
    ) {}

    // =========================
    // CENTRES DE FORMATION
    // =========================

    public record TrainingCenterRow(
            int rowNum,
            String name,
            String companyNumber,
            String hqStreet,
            String hqNumber,
            String hqPostalCode,
            String hqCity,
            String hqProvince,
            String sectors,
            String pilotCenters
    ) {}

    // =========================
    // AGRÉMENTS CENTRES
    // =========================

    public record CenterAccreditationRow(
            int rowNum,
            String trainingCenterCompanyNumber,
            String accreditationNumber,
            String receivedDate,
            String requestStatus,
            String startDate,
            String endDate,
            String initial,
            String continuous
    ) {}

    public record TrainingSiteAddressRow(
            int rowNum,
            String centerAccreditationNumber,
            String street,
            String number,
            String postalCode,
            String city,
            String province
    ) {}

    public record ContactPersonRow(
            int rowNum,
            String centerAccreditationNumber,
            String firstName,
            String lastName,
            String email,
            String phone,
            String fonction
    ) {}

    // =========================
    // AGRÉMENTS FORMATIONS
    // =========================

    public record TrainingAccreditationRow(
            int rowNum,
            String centerAccreditationNumber,
            String accreditationNumber,
            String title,
            String durationHours,
            String price,
            String trainingPoints,
            String receivedDate,
            String requestStatus,
            String startDate,
            String endDate,
            String initial,
            String continuous,
            String subsidized,
            String comment,
            String publicCible,
            String licenseTypeCodes,
            String themeLabels,
            String subThemes,
            String partnerAccreditationNumbers
    ) {}

    public record TrainerLinkRow(
            int rowNum,
            String accreditationNumber,
            String email,
            String firstName,
            String lastName,
            String phone,
            String phytolicenceNumber
    ) {}

    // =========================
    // ACTIVITÉS DE FORMATION
    // =========================

    public record TrainingActivityRow(
            int rowNum,
            String trainingAccreditationNumber,
            String startDate,
            String endDate,
            String numberOfParticipants,
            String online,
            String phytodama,
            String memberPrice,
            String nonMemberPrice,
            String street,
            String number,
            String postalCode,
            String ville,
            String province
    ) {}
}
