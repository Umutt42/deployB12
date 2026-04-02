package com.b12.service;

import com.b12.domain.*;
import com.b12.web.dto.SearchResultDto;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class GlobalSearchService {

    private static final int MAX = 5;

    @PersistenceContext
    private EntityManager em;

    public List<SearchResultDto> search(String rawQ) {
        if (rawQ == null || rawQ.trim().length() < 2) return List.of();
        final String like = "%" + rawQ.trim().toLowerCase() + "%";
        final List<SearchResultDto> out = new ArrayList<>();

        searchTrainingCenters(like, out);
        searchCenterAccreditations(like, out);
        searchTrainingAccreditations(like, out);
        searchTrainingActivities(like, out);
        searchTrainers(like, out);
        searchThemes(like, out);
        searchLicenseTypes(like, out);
        searchOrganisms(like, out);
        searchSectors(like, out);
        searchPilotCenters(like, out);

        return out;
    }

    // ─── Centres de formation ────────────────────────────────────────

    private void searchTrainingCenters(String like, List<SearchResultDto> out) {
        em.createQuery("""
                SELECT t FROM TrainingCenter t
                WHERE LOWER(t.name) LIKE :q
                   OR LOWER(t.hqCity) LIKE :q
                ORDER BY t.name
                """, TrainingCenter.class)
                .setParameter("q", like)
                .setMaxResults(MAX)
                .getResultList()
                .forEach(t -> out.add(new SearchResultDto(
                        "Centres de formation", t.getId(), t.getName(),
                        t.getHqCity(),
                        "/training-centers/" + t.getId())));
    }

    // ─── Agréments centres ───────────────────────────────────────────

    private void searchCenterAccreditations(String like, List<SearchResultDto> out) {
        em.createQuery("""
                SELECT c FROM CenterAccreditation c
                JOIN FETCH c.trainingCenter tc
                WHERE LOWER(c.accreditationNumber) LIKE :q
                   OR LOWER(tc.name) LIKE :q
                ORDER BY c.accreditationNumber
                """, CenterAccreditation.class)
                .setParameter("q", like)
                .setMaxResults(MAX)
                .getResultList()
                .forEach(c -> out.add(new SearchResultDto(
                        "Agréments centres", c.getId(),
                        c.getAccreditationNumber() != null ? c.getAccreditationNumber() : "#" + c.getId(),
                        c.getTrainingCenter().getName(),
                        "/center-accreditations/" + c.getId())));
    }

    // ─── Agréments formations ────────────────────────────────────────

    private void searchTrainingAccreditations(String like, List<SearchResultDto> out) {
        em.createQuery("""
                SELECT t FROM TrainingAccreditation t
                JOIN FETCH t.centerAccreditation ca
                JOIN FETCH ca.trainingCenter tc
                WHERE LOWER(t.title) LIKE :q
                   OR LOWER(t.accreditationNumber) LIKE :q
                ORDER BY t.title
                """, TrainingAccreditation.class)
                .setParameter("q", like)
                .setMaxResults(MAX)
                .getResultList()
                .forEach(t -> out.add(new SearchResultDto(
                        "Agréments formations", t.getId(), t.getTitle(),
                        t.getCenterAccreditation().getTrainingCenter().getName(),
                        "/training-accreditations/" + t.getId())));
    }

    // ─── Activités de formation ──────────────────────────────────────

    private void searchTrainingActivities(String like, List<SearchResultDto> out) {
        em.createQuery("""
                SELECT a FROM TrainingActivity a
                JOIN FETCH a.trainingAccreditation ta
                WHERE LOWER(a.ville) LIKE :q
                   OR LOWER(a.street) LIKE :q
                   OR LOWER(a.province) LIKE :q
                ORDER BY a.startDate DESC
                """, TrainingActivity.class)
                .setParameter("q", like)
                .setMaxResults(MAX)
                .getResultList()
                .forEach(a -> {
                    String sub = (a.getStartDate() != null ? a.getStartDate().toString() : "")
                            + (a.getVille() != null ? " — " + a.getVille() : "");
                    out.add(new SearchResultDto(
                            "Activités de formation", a.getId(),
                            a.getTrainingAccreditation().getTitle(),
                            sub.isBlank() ? null : sub,
                            "/training-activities/" + a.getId()));
                });
    }

    // ─── Formateur·trices ────────────────────────────────────────────

    private void searchTrainers(String like, List<SearchResultDto> out) {
        em.createQuery("""
                SELECT t FROM Trainer t
                WHERE LOWER(t.firstName) LIKE :q
                   OR LOWER(t.lastName) LIKE :q
                   OR LOWER(CONCAT(t.firstName, ' ', t.lastName)) LIKE :q
                   OR LOWER(t.email) LIKE :q
                   OR LOWER(t.phytolicenceNumber) LIKE :q
                ORDER BY t.lastName, t.firstName
                """, Trainer.class)
                .setParameter("q", like)
                .setMaxResults(MAX)
                .getResultList()
                .forEach(t -> out.add(new SearchResultDto(
                        "Formateur·trices", t.getId(),
                        t.getFirstName() + " " + t.getLastName(),
                        t.getEmail(),
                        "/trainers/" + t.getId())));
    }

    // ─── Thématiques ────────────────────────────────────────────────

    private void searchThemes(String like, List<SearchResultDto> out) {
        em.createQuery("""
                SELECT t FROM Theme t
                WHERE LOWER(t.label) LIKE :q
                   OR LOWER(t.description) LIKE :q
                ORDER BY t.label
                """, Theme.class)
                .setParameter("q", like)
                .setMaxResults(MAX)
                .getResultList()
                .forEach(t -> {
                    String desc = t.getDescription();
                    String sub  = desc != null && desc.length() > 60 ? desc.substring(0, 60) + "…" : desc;
                    out.add(new SearchResultDto(
                            "Thématiques", t.getId(), t.getLabel(), sub,
                            "/thematics/" + t.getId()));
                });
    }

    // ─── Types de phytolicence ───────────────────────────────────────

    private void searchLicenseTypes(String like, List<SearchResultDto> out) {
        em.createQuery("""
                SELECT lt FROM LicenseType lt
                WHERE LOWER(lt.code) LIKE :q
                   OR LOWER(lt.label) LIKE :q
                ORDER BY lt.code
                """, LicenseType.class)
                .setParameter("q", like)
                .setMaxResults(MAX)
                .getResultList()
                .forEach(lt -> out.add(new SearchResultDto(
                        "Types de phytolicence", lt.getId(),
                        lt.getCode() + " — " + lt.getLabel(),
                        null,
                        "/license-types/" + lt.getId())));
    }

    // ─── Organismes ─────────────────────────────────────────────────

    private void searchOrganisms(String like, List<SearchResultDto> out) {
        em.createQuery("""
                SELECT o FROM Organism o
                WHERE LOWER(o.name) LIKE :q
                   OR LOWER(o.abbreviation) LIKE :q
                ORDER BY o.name
                """, Organism.class)
                .setParameter("q", like)
                .setMaxResults(MAX)
                .getResultList()
                .forEach(o -> out.add(new SearchResultDto(
                        "Organismes", o.getId(), o.getName(),
                        o.getAbbreviation(),
                        "/organisms/" + o.getId())));
    }

    // ─── Secteurs ───────────────────────────────────────────────────

    private void searchSectors(String like, List<SearchResultDto> out) {
        em.createQuery("""
                SELECT s FROM Sector s
                WHERE LOWER(s.name) LIKE :q
                ORDER BY s.name
                """, Sector.class)
                .setParameter("q", like)
                .setMaxResults(MAX)
                .getResultList()
                .forEach(s -> out.add(new SearchResultDto(
                        "Secteurs", s.getId(), s.getName(), null,
                        "/sectors/" + s.getId())));
    }

    // ─── Centres pilotes ────────────────────────────────────────────

    private void searchPilotCenters(String like, List<SearchResultDto> out) {
        em.createQuery("""
                SELECT p FROM PilotCenter p
                WHERE LOWER(p.name) LIKE :q
                   OR LOWER(p.cpGroup) LIKE :q
                ORDER BY p.name
                """, PilotCenter.class)
                .setParameter("q", like)
                .setMaxResults(MAX)
                .getResultList()
                .forEach(p -> out.add(new SearchResultDto(
                        "Centres pilotes", p.getId(), p.getName(),
                        p.getCpGroup(),
                        "/pilot-centers/" + p.getId())));
    }
}
