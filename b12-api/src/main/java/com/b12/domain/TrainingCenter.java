package com.b12.domain;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedBy;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(
        name = "training_center",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_training_center_name", columnNames = "name"),
                @UniqueConstraint(name = "uk_training_center_company_number", columnNames = "company_number")
        }
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class TrainingCenter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Nom du centre
    @Column(nullable = false, length = 220)
    private String name;

    // Numéro d'entreprise (BCE)
    @Column(name = "company_number", nullable = false, length = 30)
    private String companyNumber;

    @Column(nullable = false)
    private boolean archived = false;
    // ✅ SIÈGE SOCIAL
@Column(name = "hq_street", length = 180)
private String hqStreet;

@Column(name = "hq_number", length = 30)
private String hqNumber;

@Column(name = "hq_postal_code", length = 20)
private String hqPostalCode;

@Column(name = "hq_city", length = 120)
private String hqCity;

@Column(name = "hq_province", length = 120)
private String hqProvince;


    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "updated_by", length = 180)
    private String updatedBy;

    @Column(name = "created_by", length = 180)
    @CreatedBy
    private String createdBy;

    // =========================
    // RELATIONS (OWNER SIDE)
    // =========================

    // TrainingCenter <-> Sector
    @ManyToMany
    @JoinTable(
            name = "training_center_sector",
            joinColumns = @JoinColumn(name = "training_center_id"),
            inverseJoinColumns = @JoinColumn(name = "sector_id")
    )
    @Builder.Default
    private Set<Sector> sectors = new HashSet<>();

    // TrainingCenter <-> PilotCenter
    @ManyToMany
    @JoinTable(
            name = "training_center_pilot_center",
            joinColumns = @JoinColumn(name = "training_center_id"),
            inverseJoinColumns = @JoinColumn(name = "pilot_center_id")
    )
    @Builder.Default
    private Set<PilotCenter> pilotCenters = new HashSet<>();

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
