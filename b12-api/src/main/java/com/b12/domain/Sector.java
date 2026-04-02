package com.b12.domain;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedBy;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(
        name = "sector",
        uniqueConstraints = @UniqueConstraint(name = "uk_sector_name", columnNames = "name")
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class Sector {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ✅ “NOM” dans l’admin officiel
    @Column(nullable = false, unique = true, length = 180)
    private String name;

    @Column(length = 1000)
    private String description;

    @Column(nullable = false)
    private boolean archived = false;

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
    // RELATIONS
    // =========================

    // Sector <-> Organism (Many-to-Many)
    @ManyToMany
    @JoinTable(
            name = "sector_organism",
            joinColumns = @JoinColumn(name = "sector_id"),
            inverseJoinColumns = @JoinColumn(name = "organism_id")
    )
    @Builder.Default
    private Set<Organism> organisms = new HashSet<>();

    // Sector <-> PilotCenter (Many-to-Many)
    @ManyToMany
    @JoinTable(
            name = "sector_pilot_center",
            joinColumns = @JoinColumn(name = "sector_id"),
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
