package com.b12.domain;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedBy;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(
    name = "trainer",
    indexes = {
        @Index(name = "idx_trainer_archived",       columnList = "archived"),
        @Index(name = "idx_trainer_accreditation",  columnList = "training_accreditation_id")
    }
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class Trainer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Column(length = 180)
    private String email;

    @Column(length = 50)
    private String phone;

    @Column(name = "phytolicence_number", length = 100)
    private String phytolicenceNumber;

    @Column(length = 1000)
    private String comment;

    @Column(nullable = false)
    private boolean archived = false;

    @ManyToOne(optional = true, fetch = FetchType.LAZY)
    @JoinColumn(name = "training_accreditation_id")
    private TrainingAccreditation trainingAccreditation;

    @ManyToMany
    @JoinTable(
            name = "trainer_organism",
            joinColumns = @JoinColumn(name = "trainer_id"),
            inverseJoinColumns = @JoinColumn(name = "organism_id")
    )
    @Builder.Default
    private Set<Organism> partnerOrganisms = new HashSet<>();

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
