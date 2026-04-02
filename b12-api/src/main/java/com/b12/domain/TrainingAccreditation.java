package com.b12.domain;

import com.b12.domain.enums.AccreditationRequestStatus;
import com.b12.domain.enums.TrainingAccreditationType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;
import org.springframework.data.annotation.CreatedBy;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(
    name = "training_accreditation",
    indexes = {
        @Index(name = "idx_tra_center_accreditation_archived", columnList = "center_accreditation_id, archived"),
        @Index(name = "idx_tra_dates",                         columnList = "start_date, end_date"),
        @Index(name = "idx_tra_status_archived",               columnList = "request_status, archived")
    }
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class TrainingAccreditation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // =========================
    // TYPE : COMPLET ou SOUS_MODULES
    // =========================
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "type")
    private TrainingAccreditationType type = TrainingAccreditationType.COMPLETE;

    // =========================
    // AGRÉMENT CENTRE (principal — null si type = SUB_MODULES)
    // =========================
    @ManyToOne(optional = true, fetch = FetchType.LAZY)
    @JoinColumn(name = "center_accreditation_id", nullable = true)
    private CenterAccreditation centerAccreditation;

    // =========================
    // SOUS-MODULES (actifs si type = SUB_MODULES, min 2)
    // =========================
    @ManyToMany
    @JoinTable(
            name = "training_accreditation_sub_module",
            joinColumns = @JoinColumn(name = "training_accreditation_id"),
            inverseJoinColumns = @JoinColumn(name = "sub_module_id")
    )
    @BatchSize(size = 50)
    @Builder.Default
    private Set<SubModule> subModules = new HashSet<>();

    // =========================
    // ORGANISMES PARTENAIRES
    // (autres agréments centre actifs)
    // =========================
    @ManyToMany
    @JoinTable(
            name = "training_accreditation_partner",
            joinColumns = @JoinColumn(name = "training_accreditation_id"),
            inverseJoinColumns = @JoinColumn(name = "center_accreditation_id")
    )
    @BatchSize(size = 50)
    @Builder.Default
    private Set<CenterAccreditation> partnerAccreditations = new HashSet<>();

    // =========================
    // CHAMPS PRINCIPAUX
    // =========================
    @Column(nullable = false, columnDefinition = "TEXT")
    private String title;

    @Column(name = "duration_hours")
    private Double durationHours;

    @Column(name = "price")
    private Double price;

    @Column(name = "training_points")
    private Integer trainingPoints;

    @Column(name = "received_date")
    private LocalDate receivedDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "request_status", length = 30)
    private AccreditationRequestStatus requestStatus;

    @Column(name = "accreditation_number", length = 60)
    private String accreditationNumber;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Builder.Default
    @Column(nullable = false)
    private boolean initial = false;

    @Builder.Default
    @Column(nullable = false)
    private boolean continuous = false;

    @Builder.Default
    @Column(nullable = false)
    private boolean subsidized = false;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(name = "public_cible", columnDefinition = "TEXT")
    private String publicCible;

    @Builder.Default
    @Column(nullable = false)
    private boolean archived = false;

    // =========================
    // RELATIONS
    // =========================
    @ManyToMany
    @JoinTable(
            name = "training_accreditation_license_type",
            joinColumns = @JoinColumn(name = "training_accreditation_id"),
            inverseJoinColumns = @JoinColumn(name = "license_type_id")
    )
    @BatchSize(size = 50)
    @Builder.Default
    private Set<LicenseType> licenseTypes = new HashSet<>();

    @ManyToMany
    @JoinTable(
            name = "training_accreditation_theme",
            joinColumns = @JoinColumn(name = "training_accreditation_id"),
            inverseJoinColumns = @JoinColumn(name = "theme_id")
    )
    @BatchSize(size = 50)
    @Builder.Default
    private Set<Theme> themes = new HashSet<>();

    @ManyToMany
    @JoinTable(
            name = "training_accreditation_sub_theme",
            joinColumns = @JoinColumn(name = "training_accreditation_id"),
            inverseJoinColumns = @JoinColumn(name = "sub_theme_id")
    )
    @BatchSize(size = 50)
    @Builder.Default
    private Set<SubTheme> subThemes = new HashSet<>();

    @ManyToMany
    @JoinTable(
            name = "training_accreditation_trainer",
            joinColumns = @JoinColumn(name = "training_accreditation_id"),
            inverseJoinColumns = @JoinColumn(name = "trainer_id")
    )
    @BatchSize(size = 50)
    @Builder.Default
    private Set<Trainer> trainers = new HashSet<>();

    // =========================
    // AUDIT
    // =========================
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "updated_by", length = 180)
    private String updatedBy;

    @Column(name = "created_by", length = 180)
    @CreatedBy
    private String createdBy;

    @PrePersist
    void prePersist() {
        var now = OffsetDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
