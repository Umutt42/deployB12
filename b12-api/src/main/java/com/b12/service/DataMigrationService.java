package com.b12.service;

import com.b12.domain.*;
import com.b12.domain.enums.AccreditationRequestStatus;
import com.b12.domain.enums.TrainingAccreditationType;
import com.b12.repository.*;
import com.b12.security.SecurityUtils;
import com.b12.web.dto.DataMigrationDtos.*;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional
public class DataMigrationService {

    private final TrainingCenterRepository trainingCenterRepo;
    private final CenterAccreditationRepository centerAccreditationRepo;
    private final TrainingAccreditationRepository trainingAccreditationRepo;
    private final TrainingActivityRepository trainingActivityRepo;
    private final TrainerRepository trainerRepo;
    private final ThemeRepository themeRepo;
    private final SubThemeRepository subThemeRepo;
    private final LicenseTypeRepository licenseTypeRepo;
    private final SubModuleRepository subModuleRepo;
    private final SectorRepository sectorRepo;
    private final PilotCenterRepository pilotCenterRepo;

    private static final DateTimeFormatter ISO   = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter BE    = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter BE2   = DateTimeFormatter.ofPattern("d/M/yyyy");

    // ==========================================================================
    // TEMPLATE GENERATION
    // ==========================================================================

    public byte[] generateTrainingCenterTemplate() throws IOException {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("centres_de_formation");
            CellStyle headerStyle = buildHeaderStyle(wb);
            CellStyle exampleStyle = buildExampleStyle(wb);

            String[] headers = {"nom*", "numeroBCE*", "siegeRue", "siegeNumero",
                    "siegeCodePostal", "siegeVille", "siegeProvince", "secteurs", "centresPilotes"};
            String[] example = {"Centre Agricole Liège", "BE0123456789", "Rue des Champs", "5",
                    "4000", "Liège", "Liège", "Agriculture;Horticulture", "Centre Pilote 1"};

            writeHeaderRow(sheet, headers, headerStyle);
            writeExampleRow(sheet, example, exampleStyle, 1);
            writeInstructions(sheet, headers.length + 1, new String[]{
                    "* = champ obligatoire",
                    "secteurs : noms séparés par ; (doivent exister en base)",
                    "centresPilotes : noms séparés par ; (doivent exister en base)",
                    "Doublons détectés par numeroBCE → ligne ignorée"
            });
            autoSizeColumns(sheet, headers.length);
            return toBytes(wb);
        }
    }

    public byte[] generateCenterAccreditationTemplate() throws IOException {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            CellStyle headerStyle = buildHeaderStyle(wb);
            CellStyle exampleStyle = buildExampleStyle(wb);

            // Feuille 1 — agréments
            Sheet s1 = wb.createSheet("agrements");
            String[] h1 = {"numeroBCECentre*", "numeroAgrement*", "dateReception",
                    "statutDemande", "dateDebut", "dateFin", "initial", "continu"};
            String[] e1 = {"BE0123456789", "AGR-2023-001", "2023-01-15",
                    "ACCEPTED", "2023-02-01", "2026-01-31", "true", "false"};
            writeHeaderRow(s1, h1, headerStyle);
            writeExampleRow(s1, e1, exampleStyle, 1);
            writeInstructions(s1, h1.length + 1, new String[]{
                    "statutDemande : RECEIVED | ACCEPTED | REFUSED | PENDING",
                    "Dates format : YYYY-MM-DD ou DD/MM/YYYY",
                    "initial / continu : true ou false",
                    "Doublons détectés par numeroAgrement → ligne ignorée"
            });
            autoSizeColumns(s1, h1.length);

            // Feuille 2 — adresses sites
            Sheet s2 = wb.createSheet("adresses_sites");
            String[] h2 = {"numeroAgrementCentre*", "rue", "numero", "codePostal", "ville", "province"};
            String[] e2 = {"AGR-2023-001", "Rue des Formations", "10", "4000", "Liège", "Liège"};
            writeHeaderRow(s2, h2, headerStyle);
            writeExampleRow(s2, e2, exampleStyle, 1);
            autoSizeColumns(s2, h2.length);

            // Feuille 3 — contacts
            Sheet s3 = wb.createSheet("contacts");
            String[] h3 = {"numeroAgrementCentre*", "prenom*", "nom*", "email", "telephone", "fonction"};
            String[] e3 = {"AGR-2023-001", "Jean", "Dupont", "j.dupont@email.be", "+32470000000", "Directeur"};
            writeHeaderRow(s3, h3, headerStyle);
            writeExampleRow(s3, e3, exampleStyle, 1);
            autoSizeColumns(s3, h3.length);

            return toBytes(wb);
        }
    }

    public byte[] generateTrainingAccreditationTemplate() throws IOException {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            CellStyle headerStyle = buildHeaderStyle(wb);
            CellStyle exampleStyle = buildExampleStyle(wb);

            // Feuille 1 — agréments formations
            Sheet s1 = wb.createSheet("agrements_formations");
            String[] h1 = {"numeroAgrementCentre", "numeroAgrementFormation*", "titre*",
                    "dureeHeures", "prix", "pointsFormation",
                    "dateReception", "statutDemande", "dateDebut", "dateFin",
                    "initial", "continu", "subventionne", "commentaire", "publicCible",
                    "codesTypeLicence", "themes", "sousThemes", "agreementsPartenaires",
                    "type", "sousModules"};
            String[] e1 = {"AGR-2023-001", "FORM-2023-001", "Formation Pesticides",
                    "8", "150", "5",
                    "2023-03-01", "ACCEPTED", "2023-04-01", "2025-03-31",
                    "true", "false", "true", "", "",
                    "NP;P1", "Communication;Législation", "Communication:Présentation;Législation:Phytolicence", "",
                    "COMPLETE", ""};
            writeHeaderRow(s1, h1, headerStyle);
            writeExampleRow(s1, e1, exampleStyle, 1);
            // Ligne exemple type SUB_MODULES
            String[] e1b = {"", "FORM-2023-002", "Formation Modulaire",
                    "", "", "",
                    "2023-03-01", "ACCEPTED", "2023-04-01", "2025-03-31",
                    "false", "true", "false", "", "",
                    "", "", "", "",
                    "SUB_MODULES", "SM-2023-001;SM-2023-002"};
            writeExampleRow(s1, e1b, exampleStyle, 2);
            writeInstructions(s1, h1.length + 1, new String[]{
                    "type : COMPLETE (défaut) ou SUB_MODULES",
                    "  - COMPLETE : numeroAgrementCentre obligatoire",
                    "  - SUB_MODULES : numeroAgrementCentre vide, sousModules obligatoire (min 2)",
                    "sousModules : numéros d'agréments sous-modules séparés par ; (ex: SM-001;SM-002)",
                    "codesTypeLicence : codes séparés par ; (ex: NP;P1;P2)",
                    "themes : labels séparés par ;",
                    "sousThemes : format ThemeLabel:SousThemeLabel séparés par ;",
                    "agreementsPartenaires : numéros d'agréments centre partenaires séparés par ;"
            });
            autoSizeColumns(s1, h1.length);

            // Feuille 2 — formateurs liés
            Sheet s2 = wb.createSheet("formateurs_lies");
            String[] h2 = {"numeroAgrementFormation*", "email*", "prenom", "nom", "telephone", "numeroPhytolicence"};
            String[] e2 = {"FORM-2023-001", "formateur@email.be", "Marie", "Martin", "+32470111222", "PHY-2021-001"};
            writeHeaderRow(s2, h2, headerStyle);
            writeExampleRow(s2, e2, exampleStyle, 1);
            writeInstructions(s2, h2.length + 1, new String[]{
                    "email = identifiant du formateur (clé naturelle)",
                    "Si le formateur n'existe pas encore → il sera créé automatiquement",
                    "Un formateur peut apparaître plusieurs fois (lié à plusieurs agréments)"
            });
            autoSizeColumns(s2, h2.length);

            return toBytes(wb);
        }
    }

    public byte[] generateTrainingActivityTemplate() throws IOException {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("activites_formations");
            CellStyle headerStyle = buildHeaderStyle(wb);
            CellStyle exampleStyle = buildExampleStyle(wb);

            String[] headers = {"numeroAgrementFormation*", "dateDebut*", "dateFin",
                    "nombreParticipants", "enLigne", "phytodama",
                    "prixMembre", "prixNonMembre",
                    "rue", "numero", "codePostal", "ville", "province"};
            String[] example = {"FORM-2023-001", "2023-05-10", "2023-05-10",
                    "25", "false", "false",
                    "120.00", "150.00",
                    "Rue de la Paix", "1", "4000", "Liège", "Liège"};

            writeHeaderRow(sheet, headers, headerStyle);
            writeExampleRow(sheet, example, exampleStyle, 1);
            writeInstructions(sheet, headers.length + 1, new String[]{
                    "enLigne / phytodama : true ou false",
                    "prixMembre / prixNonMembre : décimal (ex: 120.00)",
                    "Plusieurs activités peuvent être liées au même agrément formation"
            });
            autoSizeColumns(sheet, headers.length);
            return toBytes(wb);
        }
    }

    // ==========================================================================
    // CENTRES DE FORMATION — PREVIEW
    // ==========================================================================

    @Transactional(readOnly = true)
    public PreviewResult previewTrainingCenters(MultipartFile file) throws IOException {
        List<String[]> rows = parseMainSheet(file);
        int dataStart = detectHeaderRow(rows, "nom", "numeroBCE");
        List<ImportError> errors = new ArrayList<>();
        int total = 0;

        for (int i = dataStart; i < rows.size(); i++) {
            String[] cols = rows.get(i);
            int rowNum = i + 1;
            String name          = col(cols, 0);
            String companyNumber = col(cols, 1);

            if (name.isEmpty() && companyNumber.isEmpty()) continue;
            total++;

            if (name.isEmpty())          errors.add(new ImportError(rowNum, "name", "Nom manquant"));
            if (companyNumber.isEmpty()) errors.add(new ImportError(rowNum, "companyNumber", "Numéro BCE manquant"));
            if (!companyNumber.isEmpty() && trainingCenterRepo.findByCompanyNumberIgnoreCase(companyNumber).isPresent())
                errors.add(new ImportError(rowNum, "companyNumber", "Doublon BCE : " + companyNumber + " (sera ignoré)"));
            if (!name.isEmpty() && trainingCenterRepo.findByNameIgnoreCase(name).isPresent())
                errors.add(new ImportError(rowNum, "name", "Doublon nom : " + name + " (sera ignoré)"));
        }

        int withErrors = (int) errors.stream().mapToInt(ImportError::row).distinct().count();
        return new PreviewResult(total, total - withErrors, withErrors, errors);
    }

    // ==========================================================================
    // CENTRES DE FORMATION — IMPORT
    // ==========================================================================

    public ImportResult importTrainingCenters(MultipartFile file) throws IOException {
        List<String[]> rows = parseMainSheet(file);
        int dataStart = detectHeaderRow(rows, "nom", "numeroBCE");
        String actor = SecurityUtils.currentUserEmailOrSystem();

        int total = 0, created = 0, skipped = 0;
        List<ImportError> errors = new ArrayList<>();

        for (int i = dataStart; i < rows.size(); i++) {
            String[] cols = rows.get(i);
            int rowNum = i + 1;

            String name          = col(cols, 0);
            String companyNumber = col(cols, 1);
            String hqStreet      = col(cols, 2);
            String hqNumber      = col(cols, 3);
            String hqPostalCode  = col(cols, 4);
            String hqCity        = col(cols, 5);
            String hqProvince    = col(cols, 6);
            String sectors       = col(cols, 7);
            String pilotCenters  = col(cols, 8);

            if (name.isEmpty() && companyNumber.isEmpty()) continue;
            total++;

            if (name.isEmpty())          { errors.add(new ImportError(rowNum, "name", "Nom manquant")); continue; }
            if (companyNumber.isEmpty()) { errors.add(new ImportError(rowNum, "companyNumber", "Numéro BCE manquant")); continue; }

            if (trainingCenterRepo.findByCompanyNumberIgnoreCase(companyNumber).isPresent()
                    || trainingCenterRepo.findByNameIgnoreCase(name).isPresent()) {
                skipped++;
                continue;
            }

            TrainingCenter tc = TrainingCenter.builder()
                    .name(name)
                    .companyNumber(companyNumber)
                    .hqStreet(nullIfEmpty(hqStreet))
                    .hqNumber(nullIfEmpty(hqNumber))
                    .hqPostalCode(nullIfEmpty(hqPostalCode))
                    .hqCity(nullIfEmpty(hqCity))
                    .hqProvince(nullIfEmpty(hqProvince))
                    .archived(false)
                    .updatedBy(actor)
                    .build();

            if (!sectors.isEmpty()) {
                for (String sectorName : splitSemicolon(sectors)) {
                    sectorRepo.findByNameIgnoreCase(sectorName.trim())
                            .ifPresent(s -> tc.getSectors().add(s));
                }
            }
            if (!pilotCenters.isEmpty()) {
                for (String pcName : splitSemicolon(pilotCenters)) {
                    pilotCenterRepo.findByNameIgnoreCase(pcName.trim())
                            .ifPresent(p -> tc.getPilotCenters().add(p));
                }
            }

            trainingCenterRepo.save(tc);
            created++;
        }

        return new ImportResult(total, created, skipped, errors);
    }

    // ==========================================================================
    // AGRÉMENTS CENTRES — PREVIEW
    // ==========================================================================

    @Transactional(readOnly = true)
    public PreviewResult previewCenterAccreditations(MultipartFile file) throws IOException {
        boolean isXlsx = isXlsxFile(file);
        List<String[]> mainRows = isXlsx ? parseSheet(file, 0) : parseMainSheet(file);
        int dataStart = detectHeaderRow(mainRows, "numeroBCECentre", "numeroAgrement");

        List<ImportError> errors = new ArrayList<>();
        int total = 0;

        for (int i = dataStart; i < mainRows.size(); i++) {
            String[] cols = mainRows.get(i);
            int rowNum = i + 1;
            String companyNum    = col(cols, 0);
            String accreditNum   = col(cols, 1);
            String requestStatus = col(cols, 3);

            if (companyNum.isEmpty() && accreditNum.isEmpty()) continue;
            total++;

            if (companyNum.isEmpty())  errors.add(new ImportError(rowNum, "trainingCenterCompanyNumber", "Numéro BCE manquant"));
            if (accreditNum.isEmpty()) errors.add(new ImportError(rowNum, "accreditationNumber", "Numéro d'agrément manquant"));
            if (trainingCenterRepo.findByCompanyNumberIgnoreCase(companyNum).isEmpty())
                errors.add(new ImportError(rowNum, "trainingCenterCompanyNumber", "Centre introuvable : " + companyNum));
            if (!requestStatus.isEmpty() && parseStatus(requestStatus) == null)
                errors.add(new ImportError(rowNum, "requestStatus", "Statut invalide : " + requestStatus));
            if (centerAccreditationRepo.findByAccreditationNumberIgnoreCase(accreditNum).isPresent())
                errors.add(new ImportError(rowNum, "accreditationNumber", "Doublon : " + accreditNum + " (sera ignoré)"));
        }

        int withErrors = (int) errors.stream().mapToInt(ImportError::row).distinct().count();
        return new PreviewResult(total, total - withErrors, withErrors, errors);
    }

    // ==========================================================================
    // AGRÉMENTS CENTRES — IMPORT
    // ==========================================================================

    public ImportResult importCenterAccreditations(MultipartFile file) throws IOException {
        boolean isXlsx = isXlsxFile(file);
        List<String[]> mainRows    = isXlsx ? parseSheet(file, 0) : parseMainSheet(file);
        List<String[]> siteRows    = isXlsx ? parseSheet(file, 1) : List.of();
        List<String[]> contactRows = isXlsx ? parseSheet(file, 2) : List.of();

        String actor = SecurityUtils.currentUserEmailOrSystem();
        int dataStart = detectHeaderRow(mainRows, "numeroBCECentre", "numeroAgrement");

        int total = 0, created = 0, skipped = 0;
        List<ImportError> errors = new ArrayList<>();

        // Feuille 1 — agréments centres
        for (int i = dataStart; i < mainRows.size(); i++) {
            String[] cols = mainRows.get(i);
            int rowNum = i + 1;

            String companyNum    = col(cols, 0);
            String accreditNum   = col(cols, 1);
            String receivedDate  = col(cols, 2);
            String statusStr     = col(cols, 3);
            String startDate     = col(cols, 4);
            String endDate       = col(cols, 5);
            String initial       = col(cols, 6);
            String continuous    = col(cols, 7);

            if (companyNum.isEmpty() && accreditNum.isEmpty()) continue;
            total++;

            if (companyNum.isEmpty())  { errors.add(new ImportError(rowNum, "trainingCenterCompanyNumber", "Numéro BCE manquant")); continue; }
            if (accreditNum.isEmpty()) { errors.add(new ImportError(rowNum, "accreditationNumber", "Numéro d'agrément manquant")); continue; }

            if (centerAccreditationRepo.findByAccreditationNumberIgnoreCase(accreditNum).isPresent()) {
                skipped++;
                continue;
            }

            Optional<TrainingCenter> tcOpt = trainingCenterRepo.findByCompanyNumberIgnoreCase(companyNum);
            if (tcOpt.isEmpty()) {
                errors.add(new ImportError(rowNum, "trainingCenterCompanyNumber", "Centre introuvable : " + companyNum));
                continue;
            }

            AccreditationRequestStatus status = parseStatus(statusStr);

            CenterAccreditation ca = CenterAccreditation.builder()
                    .trainingCenter(tcOpt.get())
                    .accreditationNumber(accreditNum)
                    .receivedDate(parseDate(receivedDate))
                    .requestStatus(status)
                    .startDate(parseDate(startDate))
                    .endDate(parseDate(endDate))
                    .initial(parseBool(initial))
                    .continuous(parseBool(continuous))
                    .archived(parseDate(endDate) != null && parseDate(endDate).isBefore(LocalDate.now()))
                    .updatedBy(actor)
                    .build();

            centerAccreditationRepo.save(ca);
            created++;
        }

        // Feuille 2 — adresses sites (Excel uniquement)
        int siteStart = detectHeaderRow(siteRows, "numeroAgrementCentre", "rue");
        for (int i = siteStart; i < siteRows.size(); i++) {
            String[] cols = siteRows.get(i);
            String caNum    = col(cols, 0);
            String street   = col(cols, 1);
            String number   = col(cols, 2);
            String postal   = col(cols, 3);
            String city     = col(cols, 4);
            String province = col(cols, 5);

            if (caNum.isEmpty()) continue;

            centerAccreditationRepo.findByAccreditationNumberIgnoreCase(caNum).ifPresent(ca -> {
                TrainingSiteAddress site = new TrainingSiteAddress();
                site.setCenterAccreditation(ca);
                site.setStreet(nullIfEmpty(street));
                site.setNumber(nullIfEmpty(number));
                site.setPostalCode(nullIfEmpty(postal));
                site.setCity(nullIfEmpty(city));
                site.setProvince(nullIfEmpty(province));
                site.setArchived(false);
                site.setUpdatedBy(actor);
                ca.getTrainingSiteAddresses().add(site);
            });
        }

        // Feuille 3 — contacts (Excel uniquement)
        int contactStart = detectHeaderRow(contactRows, "numeroAgrementCentre", "prenom");
        for (int i = contactStart; i < contactRows.size(); i++) {
            String[] cols = contactRows.get(i);
            String caNum     = col(cols, 0);
            String firstName = col(cols, 1);
            String lastName  = col(cols, 2);
            String email     = col(cols, 3);
            String phone     = col(cols, 4);
            String fonction  = col(cols, 5);

            if (caNum.isEmpty() || firstName.isEmpty()) continue;

            centerAccreditationRepo.findByAccreditationNumberIgnoreCase(caNum).ifPresent(ca -> {
                ContactPerson contact = new ContactPerson();
                contact.setCenterAccreditation(ca);
                contact.setFirstName(firstName);
                contact.setLastName(nullIfEmpty(lastName));
                contact.setEmail(nullIfEmpty(email));
                contact.setPhone(nullIfEmpty(phone));
                contact.setFonction(nullIfEmpty(fonction));
                contact.setArchived(false);
                contact.setUpdatedBy(actor);
                ca.getContactPeople().add(contact);
            });
        }

        return new ImportResult(total, created, skipped, errors);
    }

    // ==========================================================================
    // AGRÉMENTS FORMATIONS — PREVIEW
    // ==========================================================================

    @Transactional(readOnly = true)
    public PreviewResult previewTrainingAccreditations(MultipartFile file) throws IOException {
        boolean isXlsx = isXlsxFile(file);
        List<String[]> mainRows = isXlsx ? parseSheet(file, 0) : parseMainSheet(file);
        int dataStart = detectHeaderRow(mainRows, "numeroAgrementCentre", "numeroAgrementFormation");

        List<ImportError> errors = new ArrayList<>();
        int total = 0;

        for (int i = dataStart; i < mainRows.size(); i++) {
            String[] cols = mainRows.get(i);
            int rowNum = i + 1;
            String caNum       = col(cols, 0);
            String accreditNum = col(cols, 1);
            String title       = col(cols, 2);
            String typeStr     = col(cols, 19);
            String subModsStr  = col(cols, 20);

            if (caNum.isEmpty() && accreditNum.isEmpty() && typeStr.isEmpty()) continue;
            total++;

            boolean isSM = "SUB_MODULES".equalsIgnoreCase(typeStr);

            if (accreditNum.isEmpty()) errors.add(new ImportError(rowNum, "accreditationNumber", "Numéro d'agrément formation manquant"));
            if (title.isEmpty())       errors.add(new ImportError(rowNum, "title", "Titre manquant"));
            if (trainingAccreditationRepo.findByAccreditationNumberIgnoreCase(accreditNum).isPresent())
                errors.add(new ImportError(rowNum, "accreditationNumber", "Doublon : " + accreditNum + " (sera ignoré)"));

            if (isSM) {
                List<String> smNums = subModsStr.isEmpty() ? List.of() : Arrays.asList(subModsStr.split(";"));
                if (smNums.size() < 2)
                    errors.add(new ImportError(rowNum, "sousModules", "Type SUB_MODULES requiert au moins 2 sous-modules (séparés par ;)"));
                else
                    for (String smNum : smNums)
                        if (subModuleRepo.findByAccreditationNumberIgnoreCase(smNum.trim()).isEmpty())
                            errors.add(new ImportError(rowNum, "sousModules", "Sous-module introuvable : " + smNum.trim()));
            } else {
                if (caNum.isEmpty())
                    errors.add(new ImportError(rowNum, "centerAccreditationNumber", "Numéro d'agrément centre manquant"));
                else if (centerAccreditationRepo.findByAccreditationNumberIgnoreCase(caNum).isEmpty())
                    errors.add(new ImportError(rowNum, "centerAccreditationNumber", "Agrément centre introuvable : " + caNum));
            }
        }

        int withErrors = (int) errors.stream().mapToInt(ImportError::row).distinct().count();
        return new PreviewResult(total, total - withErrors, withErrors, errors);
    }

    // ==========================================================================
    // AGRÉMENTS FORMATIONS — IMPORT
    // ==========================================================================

    public ImportResult importTrainingAccreditations(MultipartFile file) throws IOException {
        boolean isXlsx = isXlsxFile(file);
        List<String[]> mainRows    = isXlsx ? parseSheet(file, 0) : parseMainSheet(file);
        List<String[]> trainerRows = isXlsx ? parseSheet(file, 1) : List.of();

        String actor = SecurityUtils.currentUserEmailOrSystem();
        int dataStart = detectHeaderRow(mainRows, "numeroAgrementCentre", "numeroAgrementFormation");

        int total = 0, created = 0, skipped = 0;
        List<ImportError> errors = new ArrayList<>();

        // Feuille 1 — agréments formations
        for (int i = dataStart; i < mainRows.size(); i++) {
            String[] cols = mainRows.get(i);
            int rowNum = i + 1;

            String caNum        = col(cols, 0);
            String accreditNum  = col(cols, 1);
            String title        = col(cols, 2);
            String durationStr  = col(cols, 3);
            String priceStr     = col(cols, 4);
            String pointsStr    = col(cols, 5);
            String receivedDate = col(cols, 6);
            String statusStr    = col(cols, 7);
            String startDate    = col(cols, 8);
            String endDate      = col(cols, 9);
            String initial      = col(cols, 10);
            String continuous   = col(cols, 11);
            String subsidized   = col(cols, 12);
            String comment      = col(cols, 13);
            String publicCible  = col(cols, 14);
            String licenseCodes = col(cols, 15);
            String themeLabels  = col(cols, 16);
            String subThemesStr = col(cols, 17);
            String partnersStr  = col(cols, 18);
            String typeStr      = col(cols, 19);
            String subModsStr   = col(cols, 20);

            boolean isSM = "SUB_MODULES".equalsIgnoreCase(typeStr);

            if (caNum.isEmpty() && accreditNum.isEmpty() && typeStr.isEmpty()) continue;
            total++;

            if (accreditNum.isEmpty()) { errors.add(new ImportError(rowNum, "accreditationNumber", "Numéro d'agrément formation manquant")); continue; }
            if (title.isEmpty())       { errors.add(new ImportError(rowNum, "title", "Titre manquant")); continue; }

            if (trainingAccreditationRepo.findByAccreditationNumberIgnoreCase(accreditNum).isPresent()) {
                skipped++;
                continue;
            }

            TrainingAccreditation.TrainingAccreditationBuilder builder = TrainingAccreditation.builder()
                    .type(isSM ? TrainingAccreditationType.SUB_MODULES : TrainingAccreditationType.COMPLETE)
                    .accreditationNumber(accreditNum)
                    .title(title)
                    .durationHours(parseDouble(durationStr))
                    .price(parseDouble(priceStr))
                    .trainingPoints(parseInteger(pointsStr))
                    .receivedDate(parseDate(receivedDate))
                    .requestStatus(parseStatus(statusStr))
                    .startDate(parseDate(startDate))
                    .endDate(parseDate(endDate))
                    .initial(parseBool(initial))
                    .continuous(parseBool(continuous))
                    .subsidized(parseBool(subsidized))
                    .comment(nullIfEmpty(comment))
                    .publicCible(nullIfEmpty(publicCible))
                    .archived(false)
                    .updatedBy(actor);

            if (!isSM) {
                if (caNum.isEmpty()) { errors.add(new ImportError(rowNum, "centerAccreditationNumber", "Numéro d'agrément centre manquant")); continue; }
                Optional<CenterAccreditation> caOpt = centerAccreditationRepo.findByAccreditationNumberIgnoreCase(caNum);
                if (caOpt.isEmpty()) { errors.add(new ImportError(rowNum, "centerAccreditationNumber", "Agrément centre introuvable : " + caNum)); continue; }
                builder.centerAccreditation(caOpt.get());
            }

            TrainingAccreditation ta = builder.build();

            if (isSM && !subModsStr.isEmpty()) {
                List<String> smNums = Arrays.asList(subModsStr.split(";"));
                if (smNums.size() < 2) {
                    errors.add(new ImportError(rowNum, "sousModules", "Type SUB_MODULES requiert au moins 2 sous-modules"));
                    continue;
                }
                for (String smNum : smNums) {
                    subModuleRepo.findByAccreditationNumberIgnoreCase(smNum.trim())
                            .ifPresent(sm -> ta.getSubModules().add(sm));
                }
                if (ta.getSubModules().size() < 2) {
                    errors.add(new ImportError(rowNum, "sousModules", "Moins de 2 sous-modules trouvés en base pour : " + subModsStr));
                    continue;
                }
            } else if (isSM) {
                errors.add(new ImportError(rowNum, "sousModules", "Type SUB_MODULES requiert au moins 2 sous-modules"));
                continue;
            }

            // Résolution des types de phytolicences
            if (!licenseCodes.isEmpty()) {
                for (String code : splitSemicolon(licenseCodes)) {
                    licenseTypeRepo.findByCodeIgnoreCase(code.trim()).ifPresent(lt -> ta.getLicenseTypes().add(lt));
                }
            }

            // Résolution des thèmes
            if (!themeLabels.isEmpty()) {
                for (String label : splitSemicolon(themeLabels)) {
                    themeRepo.findByLabelIgnoreCase(label.trim()).ifPresent(t -> ta.getThemes().add(t));
                }
            }

            // Résolution des sous-thèmes (format "ThemeLabel:SubThemeLabel")
            if (!subThemesStr.isEmpty()) {
                for (String pair : splitSemicolon(subThemesStr)) {
                    String[] parts = pair.split(":", 2);
                    if (parts.length == 2) {
                        themeRepo.findByLabelIgnoreCase(parts[0].trim()).ifPresent(theme ->
                                subThemeRepo.findByThemeIdAndLabelIgnoreCase(theme.getId(), parts[1].trim())
                                        .ifPresent(st -> ta.getSubThemes().add(st))
                        );
                    }
                }
            }

            // Résolution des agréments partenaires
            if (!partnersStr.isEmpty()) {
                for (String partnerNum : splitSemicolon(partnersStr)) {
                    centerAccreditationRepo.findByAccreditationNumberIgnoreCase(partnerNum.trim())
                            .ifPresent(p -> ta.getPartnerAccreditations().add(p));
                }
            }

            trainingAccreditationRepo.save(ta);
            created++;
        }

        // Feuille 2 — formateurs liés (upsert par email)
        int trainerStart = detectHeaderRow(trainerRows, "numeroAgrementFormation", "email");
        for (int i = trainerStart; i < trainerRows.size(); i++) {
            String[] cols         = trainerRows.get(i);
            String accreditNum    = col(cols, 0);
            String email          = col(cols, 1);
            String firstName      = col(cols, 2);
            String lastName       = col(cols, 3);
            String phone          = col(cols, 4);
            String phytoNum       = col(cols, 5);

            if (accreditNum.isEmpty() || email.isEmpty()) continue;

            Optional<TrainingAccreditation> taOpt = trainingAccreditationRepo.findByAccreditationNumberIgnoreCase(accreditNum);
            if (taOpt.isEmpty()) continue;

            // Upsert du formateur par email
            Trainer trainer = trainerRepo.findByEmailIgnoreCase(email).orElse(null);
            if (trainer == null) {
                trainer = Trainer.builder()
                        .email(email)
                        .firstName(firstName.isEmpty() ? "—" : firstName)
                        .lastName(lastName.isEmpty() ? "—" : lastName)
                        .phone(nullIfEmpty(phone))
                        .phytolicenceNumber(nullIfEmpty(phytoNum))
                        .archived(false)
                        .updatedBy(actor)
                        .build();
                trainer = trainerRepo.save(trainer);
            }

            taOpt.get().getTrainers().add(trainer);
        }

        return new ImportResult(total, created, skipped, errors);
    }

    // ==========================================================================
    // ACTIVITÉS DE FORMATION — PREVIEW
    // ==========================================================================

    @Transactional(readOnly = true)
    public PreviewResult previewTrainingActivities(MultipartFile file) throws IOException {
        List<String[]> rows = parseMainSheet(file);
        int dataStart = detectHeaderRow(rows, "numeroAgrementFormation", "dateDebut");

        List<ImportError> errors = new ArrayList<>();
        int total = 0;

        for (int i = dataStart; i < rows.size(); i++) {
            String[] cols = rows.get(i);
            int rowNum = i + 1;
            String accreditNum = col(cols, 0);
            String startDate   = col(cols, 1);

            if (accreditNum.isEmpty() && startDate.isEmpty()) continue;
            total++;

            if (accreditNum.isEmpty()) errors.add(new ImportError(rowNum, "trainingAccreditationNumber", "Numéro d'agrément formation manquant"));
            if (startDate.isEmpty())   errors.add(new ImportError(rowNum, "startDate", "Date de début manquante"));
            if (trainingAccreditationRepo.findByAccreditationNumberIgnoreCase(accreditNum).isEmpty())
                errors.add(new ImportError(rowNum, "trainingAccreditationNumber", "Agrément formation introuvable : " + accreditNum));
        }

        int withErrors = (int) errors.stream().mapToInt(ImportError::row).distinct().count();
        return new PreviewResult(total, total - withErrors, withErrors, errors);
    }

    // ==========================================================================
    // ACTIVITÉS DE FORMATION — IMPORT
    // ==========================================================================

    public ImportResult importTrainingActivities(MultipartFile file) throws IOException {
        List<String[]> rows = parseMainSheet(file);
        int dataStart = detectHeaderRow(rows, "numeroAgrementFormation", "dateDebut");
        String actor = SecurityUtils.currentUserEmailOrSystem();

        int total = 0, created = 0, skipped = 0;
        List<ImportError> errors = new ArrayList<>();

        for (int i = dataStart; i < rows.size(); i++) {
            String[] cols = rows.get(i);
            int rowNum = i + 1;

            String accreditNum    = col(cols, 0);
            String startDateStr   = col(cols, 1);
            String endDateStr     = col(cols, 2);
            String participantsStr = col(cols, 3);
            String online         = col(cols, 4);
            String phytodama      = col(cols, 5);
            String memberPriceStr = col(cols, 6);
            String nonMemberStr   = col(cols, 7);
            String street         = col(cols, 8);
            String number         = col(cols, 9);
            String postalCode     = col(cols, 10);
            String ville          = col(cols, 11);
            String province       = col(cols, 12);

            if (accreditNum.isEmpty() && startDateStr.isEmpty()) continue;
            total++;

            if (accreditNum.isEmpty()) { errors.add(new ImportError(rowNum, "trainingAccreditationNumber", "Numéro d'agrément manquant")); continue; }
            if (startDateStr.isEmpty()) { errors.add(new ImportError(rowNum, "startDate", "Date de début manquante")); continue; }

            LocalDate startDate = parseDate(startDateStr);
            if (startDate == null) { errors.add(new ImportError(rowNum, "startDate", "Date invalide : " + startDateStr)); continue; }

            Optional<TrainingAccreditation> taOpt = trainingAccreditationRepo.findByAccreditationNumberIgnoreCase(accreditNum);
            if (taOpt.isEmpty()) {
                errors.add(new ImportError(rowNum, "trainingAccreditationNumber", "Agrément formation introuvable : " + accreditNum));
                continue;
            }

            BigDecimal memberPrice    = parseBigDecimal(memberPriceStr);
            BigDecimal nonMemberPrice = parseBigDecimal(nonMemberStr);

            TrainingActivity activity = TrainingActivity.builder()
                    .trainingAccreditation(taOpt.get())
                    .startDate(startDate)
                    .endDate(parseDate(endDateStr))
                    .numberOfParticipants(parseInteger(participantsStr))
                    .online(parseBool(online))
                    .phytodama(parseBool(phytodama))
                    .memberPrice(memberPrice != null ? memberPrice : BigDecimal.ZERO)
                    .nonMemberPrice(nonMemberPrice != null ? nonMemberPrice : BigDecimal.ZERO)
                    .street(nullIfEmpty(street))
                    .number(nullIfEmpty(number))
                    .postalCode(nullIfEmpty(postalCode))
                    .ville(nullIfEmpty(ville))
                    .province(nullIfEmpty(province))
                    .archived(false)
                    .updatedBy(actor)
                    .build();

            trainingActivityRepo.save(activity);
            created++;
        }

        return new ImportResult(total, created, skipped, errors);
    }

    // ==========================================================================
    // PARSING UTILITAIRES
    // ==========================================================================

    private List<String[]> parseMainSheet(MultipartFile file) throws IOException {
        return isXlsxFile(file) ? parseSheet(file, 0) : parseCsv(file);
    }

    private boolean isXlsxFile(MultipartFile file) {
        String name = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        return name.endsWith(".xlsx") || name.endsWith(".xls");
    }

    private List<String[]> parseSheet(MultipartFile file, int sheetIndex) throws IOException {
        List<String[]> result = new ArrayList<>();
        // Re-read the stream each time (note: for multi-sheet use byte[] buffer)
        byte[] bytes = file.getBytes();
        try (XSSFWorkbook wb = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            if (sheetIndex >= wb.getNumberOfSheets()) return result;
            Sheet sheet = wb.getSheetAt(sheetIndex);
            for (Row row : sheet) {
                int lastCell = row.getLastCellNum();
                if (lastCell < 0) continue;
                String[] cols = new String[lastCell];
                for (int i = 0; i < lastCell; i++) {
                    Cell cell = row.getCell(i);
                    cols[i] = cellToString(cell);
                }
                result.add(cols);
            }
        }
        return result;
    }

    private String cellToString(Cell cell) {
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case NUMERIC -> {
                if (DateUtil.isCellDateFormatted(cell)) {
                    LocalDate d = cell.getLocalDateTimeCellValue().toLocalDate();
                    yield d.format(ISO);
                }
                double v = cell.getNumericCellValue();
                yield (v == Math.floor(v) && !Double.isInfinite(v)) ? String.valueOf((long) v) : String.valueOf(v);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> cell.getCachedFormulaResultType() == CellType.NUMERIC
                    ? String.valueOf((long) cell.getNumericCellValue())
                    : cell.getStringCellValue();
            default -> cell.toString().trim();
        };
    }

    private List<String[]> parseCsv(MultipartFile file) throws IOException {
        List<String[]> result = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.isBlank()) result.add(parseCsvLine(line));
            }
        }
        return result;
    }

    private String[] parseCsvLine(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;
        for (char c : line.toCharArray()) {
            if (c == '"')      { inQuotes = !inQuotes; }
            else if (c == ',' && !inQuotes) { fields.add(current.toString()); current.setLength(0); }
            else               current.append(c);
        }
        fields.add(current.toString());
        return fields.toArray(new String[0]);
    }

    private int detectHeaderRow(List<String[]> rows, String col0, String col1) {
        if (rows.isEmpty()) return 0;
        String[] first = rows.get(0);
        if (first.length > 0 && (first[0].toLowerCase().contains(col0.toLowerCase())
                || (first.length > 1 && first[1].toLowerCase().contains(col1.toLowerCase())))) {
            return 1;
        }
        return 0;
    }

    // ==========================================================================
    // HELPERS PARSING DES VALEURS
    // ==========================================================================

    private String col(String[] cols, int index) {
        if (cols == null || index >= cols.length) return "";
        return cols[index] == null ? "" : cols[index].trim();
    }

    private String nullIfEmpty(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private List<String> splitSemicolon(String s) {
        if (s == null || s.isBlank()) return List.of();
        return Arrays.stream(s.split(";")).map(String::trim).filter(x -> !x.isEmpty()).toList();
    }

    private boolean parseBool(String s) {
        if (s == null) return false;
        return s.trim().equalsIgnoreCase("true") || s.trim().equals("1")
                || s.trim().equalsIgnoreCase("oui") || s.trim().equalsIgnoreCase("yes");
    }

    private LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        for (DateTimeFormatter fmt : new DateTimeFormatter[]{ISO, BE, BE2}) {
            try { return LocalDate.parse(s.trim(), fmt); } catch (DateTimeParseException ignored) {}
        }
        return null;
    }

    private Double parseDouble(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Double.parseDouble(s.trim().replace(',', '.')); } catch (NumberFormatException e) { return null; }
    }

    private Integer parseInteger(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Integer.parseInt(s.trim().replace(".0", "")); } catch (NumberFormatException e) { return null; }
    }

    private BigDecimal parseBigDecimal(String s) {
        if (s == null || s.isBlank()) return null;
        try { return new BigDecimal(s.trim().replace(',', '.')); } catch (NumberFormatException e) { return null; }
    }

    private AccreditationRequestStatus parseStatus(String s) {
        if (s == null || s.isBlank()) return null;
        try { return AccreditationRequestStatus.valueOf(s.trim().toUpperCase()); }
        catch (IllegalArgumentException e) { return null; }
    }

    // ==========================================================================
    // HELPERS GÉNÉRATION TEMPLATE
    // ==========================================================================

    private CellStyle buildHeaderStyle(XSSFWorkbook wb) {
        CellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderBottom(BorderStyle.THIN);
        return style;
    }

    private CellStyle buildExampleStyle(XSSFWorkbook wb) {
        CellStyle style = wb.createCellStyle();
        style.setFillForegroundColor(IndexedColors.LIGHT_TURQUOISE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private void writeHeaderRow(Sheet sheet, String[] headers, CellStyle style) {
        Row row = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = row.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(style);
        }
    }

    private void writeExampleRow(Sheet sheet, String[] values, CellStyle style, int rowIndex) {
        Row row = sheet.createRow(rowIndex);
        for (int i = 0; i < values.length; i++) {
            Cell cell = row.createCell(i);
            cell.setCellValue(values[i]);
            cell.setCellStyle(style);
        }
    }

    private void writeInstructions(Sheet sheet, int startCol, String[] lines) {
        // Titre "INSTRUCTIONS" dans la colonne à droite des données, ligne 1
        Row headerRow = sheet.getRow(0);
        if (headerRow == null) headerRow = sheet.createRow(0);
        headerRow.createCell(startCol).setCellValue("⚠ INSTRUCTIONS");

        // Instructions à partir de la ligne 2, même colonne
        for (int i = 0; i < lines.length; i++) {
            Row row = sheet.getRow(i + 1);
            if (row == null) row = sheet.createRow(i + 1);
            row.createCell(startCol).setCellValue("• " + lines[i]);
        }
        sheet.autoSizeColumn(startCol);
    }

    private void autoSizeColumns(Sheet sheet, int count) {
        for (int i = 0; i < count; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    private byte[] toBytes(XSSFWorkbook wb) throws IOException {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            wb.write(out);
            return out.toByteArray();
        }
    }
}
