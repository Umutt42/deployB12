package com.b12.domain;

import com.b12.domain.enums.AccreditationRequestStatus;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedBy;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(
    name = "center_accreditation",
    indexes = {
        @Index(name = "idx_ca_training_center_archived",  columnList = "training_center_id, archived"),
        @Index(name = "idx_ca_dates",                     columnList = "start_date, end_date"),
        @Index(name = "idx_ca_status_archived",           columnList = "request_status, archived")
    }
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class CenterAccreditation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // =========================
    // PARENT
    // =========================
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "training_center_id", nullable = false)
    private TrainingCenter trainingCenter;

    // =========================
    // CHAMPS (comme l’admin)
    // =========================
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

    @Column(nullable = false)
    private boolean initial = false;

    @Column(nullable = false)
    private boolean continuous = false;

    @Column(nullable = false)
    private boolean archived = false;

    // =========================
    // RELATIONS FILLES
    // =========================

    @OneToMany(mappedBy = "centerAccreditation", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private Set<TrainingSiteAddress> trainingSiteAddresses = new HashSet<>();

    @OneToMany(mappedBy = "centerAccreditation", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private Set<ContactPerson> contactPeople = new HashSet<>();

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
