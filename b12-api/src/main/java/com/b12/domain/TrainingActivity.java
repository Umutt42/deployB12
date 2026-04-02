package com.b12.domain;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(
    name = "training_activity",
    indexes = {
        @Index(name = "idx_ta_archived",                  columnList = "archived"),
        @Index(name = "idx_ta_accreditation_archived",    columnList = "training_accreditation_id, archived"),
        @Index(name = "idx_ta_start_date_archived",       columnList = "start_date, archived"),
        @Index(name = "idx_ta_province",                  columnList = "province")
    }
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class TrainingActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // =========================
    // AGRÉMENT FORMATION (principal)
    // =========================
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "training_accreditation_id", nullable = false)
    private TrainingAccreditation trainingAccreditation;

    // =========================
    // CHAMPS PRINCIPAUX
    // =========================
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "number_of_participants")
    private Integer numberOfParticipants;

    @Builder.Default
    @Column(nullable = false)
    private boolean online = false;

    @Builder.Default
    @Column(name = "member_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal memberPrice = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "non_member_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal nonMemberPrice = BigDecimal.ZERO;

    @Builder.Default
    @Column(nullable = false)
    private boolean phytodama = false;

    @Column(length = 200)
    private String street;

    @Column(length = 30)
    private String number;

    @Column(name = "postal_code", length = 20)
    private String postalCode;

    @Column(length = 200)
    private String ville;

    @Column(length = 100)
    private String province;

    @Builder.Default
    @Column(nullable = false)
    private boolean archived = false;

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
