package com.b12.web.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Set;

@Getter
@Setter
@NoArgsConstructor
public class TrainingActivityDtos {

    private Long id;

    // Agrément formation lié
    private Long trainingAccreditationId;
    private String trainingAccreditationLabel; // lecture seule : titre + numéro agrément

    // Agrément centre (via agrément formation)
    private Long centerAccreditationId;
    private String centerAccreditationLabel; // lecture seule

    // Données issues de l'agrément formation (lecture seule)
    private boolean initial;
    private boolean continuous;
    private Double durationHours;
    private Set<String> themeLabels;
    private Set<String> subThemeLabels;
    private Set<String> licenseTypeLabels;
    private Set<String> partnerAccreditationLabels;

    // Données issues du centre de formation (lecture seule)
    private Set<String> pilotCenterLabels;
    private Set<String> sectorLabels;

    // Champs principaux
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer numberOfParticipants;
    private boolean online;
    private BigDecimal memberPrice;
    private BigDecimal nonMemberPrice;
    private boolean phytodama;
    private String street;
    private String number;
    private String postalCode;
    private String ville;
    private String province;
    private boolean archived;

    // Audit
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private String updatedBy;
    private String createdBy;
}
