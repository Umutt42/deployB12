package com.b12.domain;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedBy;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(
        name = "pilot_center",
        uniqueConstraints = @UniqueConstraint(name = "uk_pilot_center_name", columnNames = "name")
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class PilotCenter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ✅ NOM (colonne "NOM")
    @Column(nullable = false, unique = true, length = 220)
    private String name;

    // ✅ GROUPE CP
    @Column(name = "cp_group", length = 120)
    private String cpGroup;

    // ✅ DESCRIPTION
    @Column(length = 1500)
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

    // PilotCenter <-> Sector (Many-to-Many)
    @ManyToMany(mappedBy = "pilotCenters")
    @Builder.Default
    private Set<Sector> sectors = new HashSet<>();

    // PilotCenter <-> Organism (Many-to-Many)
    @ManyToMany(mappedBy = "pilotCenters")
    @Builder.Default
    private Set<Organism> organisms = new HashSet<>();

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
