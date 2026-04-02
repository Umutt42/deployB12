package com.b12.domain;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedBy;

import java.time.OffsetDateTime;

@Entity
@Table(
    name = "contact_person",
    indexes = {
        @Index(name = "idx_contact_center_accreditation", columnList = "center_accreditation_id")
    }
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class ContactPerson {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // parent accreditation
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "center_accreditation_id", nullable = false)
    private CenterAccreditation centerAccreditation;

    @Column(length = 120)
    private String firstName;

    @Column(length = 120)
    private String lastName;

    @Column(length = 180)
    private String email;

    @Column(length = 40)
    private String phone;

    @Column(length = 120)
    private String fonction;

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
