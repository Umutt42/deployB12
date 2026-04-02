package com.b12.domain;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedBy;

import java.time.OffsetDateTime;

@Entity
@Table(
    name = "training_site_address",
    indexes = {
        @Index(name = "idx_tsa_center_accreditation", columnList = "center_accreditation_id")
    }
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class TrainingSiteAddress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // parent accreditation
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "center_accreditation_id", nullable = false)
    private CenterAccreditation centerAccreditation;

    @Column(length = 180)
    private String street;

    @Column(length = 30)
    private String number;

    @Column(length = 120)
    private String city;

    @Column(name = "postal_code", length = 20)
    private String postalCode;

    @Column(length = 120)
    private String province;

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
