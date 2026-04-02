package com.b12.export;

import com.b12.service.OrganismService;
import com.b12.service.PilotCenterService;
import com.b12.service.SectorService;
import com.b12.service.TrainingCenterService;
import com.b12.web.dto.CenterAccreditationDtos;
import com.b12.web.dto.LicenseTypeDtos;
import com.b12.web.dto.OrganismDtos;
import com.b12.web.dto.PilotCenterDtos;
import com.b12.web.dto.SectorDtos;
import com.b12.web.dto.ThemeDtos;
import com.b12.web.dto.TrainerDtos;
import com.b12.web.dto.TrainingAccreditationDtos;
import com.b12.web.dto.MonthlyStatDto;
import com.b12.web.dto.StatsDto;
import com.b12.web.dto.TrainingActivityDtos;
import com.b12.web.dto.TrainingCenterDtos;
import org.apache.poi.ss.usermodel.Sheet;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExportService {

    private final SectorService sectorService;
    private final OrganismService organismService;
    private final PilotCenterService pilotCenterService;
    private final TrainingCenterService trainingCenterService;

    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")
            .withZone(ZoneId.of("Europe/Brussels"));

    /* =========================================================
       License types
       ========================================================= */

    public ExportFile exportLicenseTypes(ExportFormat format, List<LicenseTypeDtos.View> rows, String filenameBase) {
        return switch (format) {
            case CSV -> new ExportFile(
                    licenseTypesCsv(rows),
                    filenameBase + ".csv",
                    "text/csv; charset=utf-8"
            );
            case XLSX -> new ExportFile(
                    licenseTypesXlsx(rows),
                    filenameBase + ".xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            case PDF -> new ExportFile(
                    licenseTypesPdf(rows, "Types de phytolicences"),
                    filenameBase + ".pdf",
                    "application/pdf"
            );
        };
    }

    private byte[] licenseTypesCsv(List<LicenseTypeDtos.View> rows) {
        StringBuilder sb = new StringBuilder();
        sb.append("Code,Label,Description,Archivé,Créé le,Modifié le\n");

        for (var r : rows) {
            sb.append(csv(r.code())).append(',');
            sb.append(csv(r.label())).append(',');
            sb.append(csv(nvl(r.description()))).append(',');
            sb.append(r.archived() ? "Oui" : "Non").append(',');
            sb.append(csv(fmt(r.createdAt()))).append(',');
            sb.append(csv(fmt(r.updatedAt()))).append('\n');
        }

        // UTF-8 BOM (meilleure compat Excel FR)
        byte[] bom = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
        byte[] body = sb.toString().getBytes(StandardCharsets.UTF_8);
        byte[] out = new byte[bom.length + body.length];
        System.arraycopy(bom, 0, out, 0, bom.length);
        System.arraycopy(body, 0, out, bom.length, body.length);
        return out;
    }

    private byte[] licenseTypesXlsx(List<LicenseTypeDtos.View> rows) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var sheet = wb.createSheet("LicenseTypes");

            int rowIdx = 0;
            Row header = sheet.createRow(rowIdx++);
            header.createCell(0).setCellValue("Code");
            header.createCell(1).setCellValue("Label");
            header.createCell(2).setCellValue("Description");
            header.createCell(3).setCellValue("Archivé");
            header.createCell(4).setCellValue("Créé le");
            header.createCell(5).setCellValue("Modifié le");

            for (var r : rows) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(nvl(r.code()));
                row.createCell(1).setCellValue(nvl(r.label()));
                row.createCell(2).setCellValue(nvl(r.description()));
                row.createCell(3).setCellValue(r.archived() ? "Oui" : "Non");
                row.createCell(4).setCellValue(fmt(r.createdAt()));
                row.createCell(5).setCellValue(fmt(r.updatedAt()));
            }

            for (int i = 0; i <= 5; i++) sheet.autoSizeColumn(i);

            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Unable to generate XLSX", e);
        }
    }

    private byte[] licenseTypesPdf(List<LicenseTypeDtos.View> rows, String title) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4.rotate(), 24, 24, 24, 24);
            PdfWriter.getInstance(doc, out);
            doc.open();

            doc.add(new Paragraph(title, new Font(Font.HELVETICA, 14, Font.BOLD)));
            doc.add(new Paragraph(" "));

            PdfPTable table = new PdfPTable(6);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{1.0f, 2.2f, 3.2f, 1.0f, 1.4f, 1.4f});

            addHeader(table, "Code");
            addHeader(table, "Label");
            addHeader(table, "Description");
            addHeader(table, "Archivé");
            addHeader(table, "Créé le");
            addHeader(table, "Modifié le");

            for (var r : rows) {
                table.addCell(nvl(r.code()));
                table.addCell(nvl(r.label()));
                table.addCell(nvl(r.description()));
                table.addCell(r.archived() ? "Oui" : "Non");
                table.addCell(fmt(r.createdAt()));
                table.addCell(fmt(r.updatedAt()));
            }

            doc.add(table);
            doc.close();
            return out.toByteArray();
        } catch (DocumentException | IOException e) {
            throw new IllegalStateException("Unable to generate PDF", e);
        }
    }

    /* =========================================================
       Themes
       ========================================================= */

    public ExportFile exportThemes(ExportFormat format, List<ThemeDtos> rows, String filenameBase) {
        return switch (format) {
            case CSV -> new ExportFile(
                    themesCsv(rows),
                    filenameBase + ".csv",
                    "text/csv; charset=utf-8"
            );
            case XLSX -> new ExportFile(
                    themesXlsx(rows),
                    filenameBase + ".xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            case PDF -> new ExportFile(
                    themesPdf(rows, "Thématiques"),
                    filenameBase + ".pdf",
                    "application/pdf"
            );
        };
    }

    private byte[] themesCsv(List<ThemeDtos> rows) {
        StringBuilder sb = new StringBuilder();
        sb.append("Nom,Description,Sous-thèmes,Archivé\n");

        for (var r : rows) {
            int subCount = r.getSubThemes() == null ? 0 : r.getSubThemes().size();
            sb.append(csv(r.getName())).append(',');
            sb.append(csv(nvl(r.getDescription()))).append(',');
            sb.append(subCount).append(',');
            sb.append(r.isArchived() ? "Oui" : "Non").append('\n');
        }

        byte[] bom = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
        byte[] body = sb.toString().getBytes(StandardCharsets.UTF_8);
        byte[] out = new byte[bom.length + body.length];
        System.arraycopy(bom, 0, out, 0, bom.length);
        System.arraycopy(body, 0, out, bom.length, body.length);
        return out;
    }

    private byte[] themesXlsx(List<ThemeDtos> rows) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var sheet = wb.createSheet("Themes");

            int rowIdx = 0;
            Row header = sheet.createRow(rowIdx++);
            header.createCell(0).setCellValue("Nom");
            header.createCell(1).setCellValue("Description");
            header.createCell(2).setCellValue("Sous-thèmes");
            header.createCell(3).setCellValue("Archivé");

            for (var r : rows) {
                int subCount = r.getSubThemes() == null ? 0 : r.getSubThemes().size();
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(nvl(r.getName()));
                row.createCell(1).setCellValue(nvl(r.getDescription()));
                row.createCell(2).setCellValue(subCount);
                row.createCell(3).setCellValue(r.isArchived() ? "Oui" : "Non");
            }

            for (int i = 0; i <= 3; i++) sheet.autoSizeColumn(i);
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Unable to generate XLSX", e);
        }
    }

    private byte[] themesPdf(List<ThemeDtos> rows, String title) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4.rotate(), 24, 24, 24, 24);
            PdfWriter.getInstance(doc, out);
            doc.open();

            doc.add(new Paragraph(title, new Font(Font.HELVETICA, 14, Font.BOLD)));
            doc.add(new Paragraph(" "));

            PdfPTable table = new PdfPTable(4);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{2.0f, 4.0f, 1.2f, 1.0f});

            addHeader(table, "Nom");
            addHeader(table, "Description");
            addHeader(table, "Sous-thèmes");
            addHeader(table, "Archivé");

            for (var r : rows) {
                int subCount = r.getSubThemes() == null ? 0 : r.getSubThemes().size();
                table.addCell(nvl(r.getName()));
                table.addCell(nvl(r.getDescription()));
                table.addCell(String.valueOf(subCount));
                table.addCell(r.isArchived() ? "Oui" : "Non");
            }

            doc.add(table);
            doc.close();
            return out.toByteArray();
        } catch (DocumentException | IOException e) {
            throw new IllegalStateException("Unable to generate PDF", e);
        }
    }

    /* =========================================================
       Sectors
       ========================================================= */

    public ExportFile exportSectors(ExportFormat format, List<SectorDtos> rows, String filenameBase) {
        Map<Long, String> orgNames = buildOrganismMap();
        Map<Long, String> pcNames  = buildPilotCenterMap();
        return switch (format) {
            case CSV  -> new ExportFile(sectorsCsv(rows, orgNames, pcNames),  filenameBase + ".csv",  "text/csv; charset=utf-8");
            case XLSX -> new ExportFile(sectorsXlsx(rows, orgNames, pcNames), filenameBase + ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            case PDF  -> new ExportFile(sectorsPdf(rows, orgNames, pcNames, "Secteurs"), filenameBase + ".pdf", "application/pdf");
        };
    }

    private byte[] sectorsCsv(List<SectorDtos> rows, Map<Long, String> orgNames, Map<Long, String> pcNames) {
        StringBuilder sb = new StringBuilder();
        sb.append("Nom,Description,Organismes,Centres pilotes,Archivé,Créé le,Modifié le\n");
        for (var r : rows) {
            sb.append(csv(nvl(r.getName()))).append(',');
            sb.append(csv(nvl(r.getDescription()))).append(',');
            sb.append(csv(joinNames(r.getOrganismIds(), orgNames))).append(',');
            sb.append(csv(joinNames(r.getPilotCenterIds(), pcNames))).append(',');
            sb.append(r.isArchived() ? "Oui" : "Non").append(',');
            sb.append(csv(fmtOdt(r.getCreatedAt()))).append(',');
            sb.append(csv(fmtOdt(r.getUpdatedAt()))).append('\n');
        }
        return withBom(sb);
    }

    private byte[] sectorsXlsx(List<SectorDtos> rows, Map<Long, String> orgNames, Map<Long, String> pcNames) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var sheet = wb.createSheet("Secteurs");
            int rowIdx = 0;
            Row header = sheet.createRow(rowIdx++);
            header.createCell(0).setCellValue("Nom");
            header.createCell(1).setCellValue("Description");
            header.createCell(2).setCellValue("Organismes");
            header.createCell(3).setCellValue("Centres pilotes");
            header.createCell(4).setCellValue("Archivé");
            header.createCell(5).setCellValue("Créé le");
            header.createCell(6).setCellValue("Modifié le");
            for (var r : rows) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(nvl(r.getName()));
                row.createCell(1).setCellValue(nvl(r.getDescription()));
                row.createCell(2).setCellValue(joinNames(r.getOrganismIds(), orgNames));
                row.createCell(3).setCellValue(joinNames(r.getPilotCenterIds(), pcNames));
                row.createCell(4).setCellValue(r.isArchived() ? "Oui" : "Non");
                row.createCell(5).setCellValue(fmtOdt(r.getCreatedAt()));
                row.createCell(6).setCellValue(fmtOdt(r.getUpdatedAt()));
            }
            for (int i = 0; i <= 6; i++) sheet.autoSizeColumn(i);
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Unable to generate XLSX", e);
        }
    }

    private byte[] sectorsPdf(List<SectorDtos> rows, Map<Long, String> orgNames, Map<Long, String> pcNames, String title) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4.rotate(), 24, 24, 24, 24);
            PdfWriter.getInstance(doc, out);
            doc.open();
            doc.add(new Paragraph(title, new Font(Font.HELVETICA, 14, Font.BOLD)));
            doc.add(new Paragraph(" "));
            PdfPTable table = new PdfPTable(7);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{2.0f, 3.0f, 2.5f, 2.5f, 1.0f, 1.4f, 1.4f});
            addHeader(table, "Nom");
            addHeader(table, "Description");
            addHeader(table, "Organismes");
            addHeader(table, "Centres pilotes");
            addHeader(table, "Archivé");
            addHeader(table, "Créé le");
            addHeader(table, "Modifié le");
            for (var r : rows) {
                table.addCell(nvl(r.getName()));
                table.addCell(nvl(r.getDescription()));
                table.addCell(joinNames(r.getOrganismIds(), orgNames));
                table.addCell(joinNames(r.getPilotCenterIds(), pcNames));
                table.addCell(r.isArchived() ? "Oui" : "Non");
                table.addCell(fmtOdt(r.getCreatedAt()));
                table.addCell(fmtOdt(r.getUpdatedAt()));
            }
            doc.add(table);
            doc.close();
            return out.toByteArray();
        } catch (DocumentException | IOException e) {
            throw new IllegalStateException("Unable to generate PDF", e);
        }
    }

    /* =========================================================
       Organisms
       ========================================================= */

    public ExportFile exportOrganisms(ExportFormat format, List<OrganismDtos> rows, String filenameBase) {
        Map<Long, String> sectorNames = buildSectorMap();
        Map<Long, String> pcNames     = buildPilotCenterMap();
        return switch (format) {
            case CSV  -> new ExportFile(organismsCsv(rows, sectorNames, pcNames),  filenameBase + ".csv",  "text/csv; charset=utf-8");
            case XLSX -> new ExportFile(organismsXlsx(rows, sectorNames, pcNames), filenameBase + ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            case PDF  -> new ExportFile(organismsPdf(rows, sectorNames, pcNames, "Organismes"), filenameBase + ".pdf", "application/pdf");
        };
    }

    private byte[] organismsCsv(List<OrganismDtos> rows, Map<Long, String> sectorNames, Map<Long, String> pcNames) {
        StringBuilder sb = new StringBuilder();
        sb.append("Nom,Abréviation,Secteurs,Centres pilotes,Archivé,Créé le,Modifié le\n");
        for (var r : rows) {
            sb.append(csv(nvl(r.getName()))).append(',');
            sb.append(csv(nvl(r.getAbbreviation()))).append(',');
            sb.append(csv(joinNames(r.getSectorIds(), sectorNames))).append(',');
            sb.append(csv(joinNames(r.getPilotCenterIds(), pcNames))).append(',');
            sb.append(r.isArchived() ? "Oui" : "Non").append(',');
            sb.append(csv(fmtOdt(r.getCreatedAt()))).append(',');
            sb.append(csv(fmtOdt(r.getUpdatedAt()))).append('\n');
        }
        return withBom(sb);
    }

    private byte[] organismsXlsx(List<OrganismDtos> rows, Map<Long, String> sectorNames, Map<Long, String> pcNames) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var sheet = wb.createSheet("Organismes");
            int rowIdx = 0;
            Row header = sheet.createRow(rowIdx++);
            header.createCell(0).setCellValue("Nom");
            header.createCell(1).setCellValue("Abréviation");
            header.createCell(2).setCellValue("Secteurs");
            header.createCell(3).setCellValue("Centres pilotes");
            header.createCell(4).setCellValue("Archivé");
            header.createCell(5).setCellValue("Créé le");
            header.createCell(6).setCellValue("Modifié le");
            for (var r : rows) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(nvl(r.getName()));
                row.createCell(1).setCellValue(nvl(r.getAbbreviation()));
                row.createCell(2).setCellValue(joinNames(r.getSectorIds(), sectorNames));
                row.createCell(3).setCellValue(joinNames(r.getPilotCenterIds(), pcNames));
                row.createCell(4).setCellValue(r.isArchived() ? "Oui" : "Non");
                row.createCell(5).setCellValue(fmtOdt(r.getCreatedAt()));
                row.createCell(6).setCellValue(fmtOdt(r.getUpdatedAt()));
            }
            for (int i = 0; i <= 6; i++) sheet.autoSizeColumn(i);
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Unable to generate XLSX", e);
        }
    }

    private byte[] organismsPdf(List<OrganismDtos> rows, Map<Long, String> sectorNames, Map<Long, String> pcNames, String title) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4.rotate(), 24, 24, 24, 24);
            PdfWriter.getInstance(doc, out);
            doc.open();
            doc.add(new Paragraph(title, new Font(Font.HELVETICA, 14, Font.BOLD)));
            doc.add(new Paragraph(" "));
            PdfPTable table = new PdfPTable(7);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{2.0f, 1.2f, 2.5f, 2.5f, 1.0f, 1.4f, 1.4f});
            addHeader(table, "Nom");
            addHeader(table, "Abréviation");
            addHeader(table, "Secteurs");
            addHeader(table, "Centres pilotes");
            addHeader(table, "Archivé");
            addHeader(table, "Créé le");
            addHeader(table, "Modifié le");
            for (var r : rows) {
                table.addCell(nvl(r.getName()));
                table.addCell(nvl(r.getAbbreviation()));
                table.addCell(joinNames(r.getSectorIds(), sectorNames));
                table.addCell(joinNames(r.getPilotCenterIds(), pcNames));
                table.addCell(r.isArchived() ? "Oui" : "Non");
                table.addCell(fmtOdt(r.getCreatedAt()));
                table.addCell(fmtOdt(r.getUpdatedAt()));
            }
            doc.add(table);
            doc.close();
            return out.toByteArray();
        } catch (DocumentException | IOException e) {
            throw new IllegalStateException("Unable to generate PDF", e);
        }
    }

    /* =========================================================
       Pilot Centers
       ========================================================= */

    public ExportFile exportPilotCenters(ExportFormat format, List<PilotCenterDtos> rows, String filenameBase) {
        Map<Long, String> sectorNames = buildSectorMap();
        Map<Long, String> orgNames    = buildOrganismMap();
        return switch (format) {
            case CSV  -> new ExportFile(pilotCentersCsv(rows, sectorNames, orgNames),  filenameBase + ".csv",  "text/csv; charset=utf-8");
            case XLSX -> new ExportFile(pilotCentersXlsx(rows, sectorNames, orgNames), filenameBase + ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            case PDF  -> new ExportFile(pilotCentersPdf(rows, sectorNames, orgNames, "Centres pilotes"), filenameBase + ".pdf", "application/pdf");
        };
    }

    private byte[] pilotCentersCsv(List<PilotCenterDtos> rows, Map<Long, String> sectorNames, Map<Long, String> orgNames) {
        StringBuilder sb = new StringBuilder();
        sb.append("Nom,Groupe CP,Description,Secteurs,Organismes,Archivé,Créé le,Modifié le\n");
        for (var r : rows) {
            sb.append(csv(nvl(r.getName()))).append(',');
            sb.append(csv(nvl(r.getCpGroup()))).append(',');
            sb.append(csv(nvl(r.getDescription()))).append(',');
            sb.append(csv(joinNames(r.getSectorIds(), sectorNames))).append(',');
            sb.append(csv(joinNames(r.getOrganismIds(), orgNames))).append(',');
            sb.append(r.isArchived() ? "Oui" : "Non").append(',');
            sb.append(csv(fmtOdt(r.getCreatedAt()))).append(',');
            sb.append(csv(fmtOdt(r.getUpdatedAt()))).append('\n');
        }
        return withBom(sb);
    }

    private byte[] pilotCentersXlsx(List<PilotCenterDtos> rows, Map<Long, String> sectorNames, Map<Long, String> orgNames) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var sheet = wb.createSheet("Centres pilotes");
            int rowIdx = 0;
            Row header = sheet.createRow(rowIdx++);
            header.createCell(0).setCellValue("Nom");
            header.createCell(1).setCellValue("Groupe CP");
            header.createCell(2).setCellValue("Description");
            header.createCell(3).setCellValue("Secteurs");
            header.createCell(4).setCellValue("Organismes");
            header.createCell(5).setCellValue("Archivé");
            header.createCell(6).setCellValue("Créé le");
            header.createCell(7).setCellValue("Modifié le");
            for (var r : rows) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(nvl(r.getName()));
                row.createCell(1).setCellValue(nvl(r.getCpGroup()));
                row.createCell(2).setCellValue(nvl(r.getDescription()));
                row.createCell(3).setCellValue(joinNames(r.getSectorIds(), sectorNames));
                row.createCell(4).setCellValue(joinNames(r.getOrganismIds(), orgNames));
                row.createCell(5).setCellValue(r.isArchived() ? "Oui" : "Non");
                row.createCell(6).setCellValue(fmtOdt(r.getCreatedAt()));
                row.createCell(7).setCellValue(fmtOdt(r.getUpdatedAt()));
            }
            for (int i = 0; i <= 7; i++) sheet.autoSizeColumn(i);
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Unable to generate XLSX", e);
        }
    }

    private byte[] pilotCentersPdf(List<PilotCenterDtos> rows, Map<Long, String> sectorNames, Map<Long, String> orgNames, String title) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4.rotate(), 24, 24, 24, 24);
            PdfWriter.getInstance(doc, out);
            doc.open();
            doc.add(new Paragraph(title, new Font(Font.HELVETICA, 14, Font.BOLD)));
            doc.add(new Paragraph(" "));
            PdfPTable table = new PdfPTable(8);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{2.0f, 1.0f, 2.5f, 2.5f, 2.5f, 1.0f, 1.4f, 1.4f});
            addHeader(table, "Nom");
            addHeader(table, "Groupe CP");
            addHeader(table, "Description");
            addHeader(table, "Secteurs");
            addHeader(table, "Organismes");
            addHeader(table, "Archivé");
            addHeader(table, "Créé le");
            addHeader(table, "Modifié le");
            for (var r : rows) {
                table.addCell(nvl(r.getName()));
                table.addCell(nvl(r.getCpGroup()));
                table.addCell(nvl(r.getDescription()));
                table.addCell(joinNames(r.getSectorIds(), sectorNames));
                table.addCell(joinNames(r.getOrganismIds(), orgNames));
                table.addCell(r.isArchived() ? "Oui" : "Non");
                table.addCell(fmtOdt(r.getCreatedAt()));
                table.addCell(fmtOdt(r.getUpdatedAt()));
            }
            doc.add(table);
            doc.close();
            return out.toByteArray();
        } catch (DocumentException | IOException e) {
            throw new IllegalStateException("Unable to generate PDF", e);
        }
    }

    /* =========================================================
       Training Centers
       ========================================================= */

    public ExportFile exportTrainingCenters(ExportFormat format, List<TrainingCenterDtos> rows, String filenameBase) {
        Map<Long, String> sectorNames = buildSectorMap();
        Map<Long, String> pcNames     = buildPilotCenterMap();
        return switch (format) {
            case CSV  -> new ExportFile(trainingCentersCsv(rows, sectorNames, pcNames),  filenameBase + ".csv",  "text/csv; charset=utf-8");
            case XLSX -> new ExportFile(trainingCentersXlsx(rows, sectorNames, pcNames), filenameBase + ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            case PDF  -> new ExportFile(trainingCentersPdf(rows, sectorNames, pcNames, "Centres de formation"), filenameBase + ".pdf", "application/pdf");
        };
    }

    private byte[] trainingCentersCsv(List<TrainingCenterDtos> rows, Map<Long, String> sectorNames, Map<Long, String> pcNames) {
        StringBuilder sb = new StringBuilder();
        sb.append("Nom,N° entreprise,Siège social,Secteurs,Centres pilotes,Archivé,Créé le,Modifié le,Modifié par\n");
        for (var r : rows) {
            sb.append(csv(nvl(r.getName()))).append(',');
            sb.append(csv(nvl(r.getCompanyNumber()))).append(',');
            sb.append(csv(fmtHq(r))).append(',');
            sb.append(csv(joinNames(r.getSectorIds(), sectorNames))).append(',');
            sb.append(csv(joinNames(r.getPilotCenterIds(), pcNames))).append(',');
            sb.append(r.isArchived() ? "Oui" : "Non").append(',');
            sb.append(csv(fmtOdt(r.getCreatedAt()))).append(',');
            sb.append(csv(fmtOdt(r.getUpdatedAt()))).append(',');
            sb.append(csv(nvl(r.getUpdatedBy()))).append('\n');
        }
        return withBom(sb);
    }

    private byte[] trainingCentersXlsx(List<TrainingCenterDtos> rows, Map<Long, String> sectorNames, Map<Long, String> pcNames) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var sheet = wb.createSheet("Centres de formation");
            int rowIdx = 0;
            Row header = sheet.createRow(rowIdx++);
            header.createCell(0).setCellValue("Nom");
            header.createCell(1).setCellValue("N° entreprise");
            header.createCell(2).setCellValue("Siège social");
            header.createCell(3).setCellValue("Secteurs");
            header.createCell(4).setCellValue("Centres pilotes");
            header.createCell(5).setCellValue("Archivé");
            header.createCell(6).setCellValue("Créé le");
            header.createCell(7).setCellValue("Modifié le");
            header.createCell(8).setCellValue("Modifié par");
            for (var r : rows) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(nvl(r.getName()));
                row.createCell(1).setCellValue(nvl(r.getCompanyNumber()));
                row.createCell(2).setCellValue(fmtHq(r));
                row.createCell(3).setCellValue(joinNames(r.getSectorIds(), sectorNames));
                row.createCell(4).setCellValue(joinNames(r.getPilotCenterIds(), pcNames));
                row.createCell(5).setCellValue(r.isArchived() ? "Oui" : "Non");
                row.createCell(6).setCellValue(fmtOdt(r.getCreatedAt()));
                row.createCell(7).setCellValue(fmtOdt(r.getUpdatedAt()));
                row.createCell(8).setCellValue(nvl(r.getUpdatedBy()));
            }
            for (int i = 0; i <= 8; i++) sheet.autoSizeColumn(i);
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Unable to generate XLSX", e);
        }
    }

    private byte[] trainingCentersPdf(List<TrainingCenterDtos> rows, Map<Long, String> sectorNames, Map<Long, String> pcNames, String title) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4.rotate(), 24, 24, 24, 24);
            PdfWriter.getInstance(doc, out);
            doc.open();
            doc.add(new Paragraph(title, new Font(Font.HELVETICA, 14, Font.BOLD)));
            doc.add(new Paragraph(" "));
            PdfPTable table = new PdfPTable(9);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{2.5f, 1.4f, 2.0f, 2.0f, 2.0f, 0.8f, 1.4f, 1.4f, 1.4f});
            addHeader(table, "Nom");
            addHeader(table, "N° entreprise");
            addHeader(table, "Siège social");
            addHeader(table, "Secteurs");
            addHeader(table, "Centres pilotes");
            addHeader(table, "Archivé");
            addHeader(table, "Créé le");
            addHeader(table, "Modifié le");
            addHeader(table, "Modifié par");
            for (var r : rows) {
                table.addCell(nvl(r.getName()));
                table.addCell(nvl(r.getCompanyNumber()));
                table.addCell(fmtHq(r));
                table.addCell(joinNames(r.getSectorIds(), sectorNames));
                table.addCell(joinNames(r.getPilotCenterIds(), pcNames));
                table.addCell(r.isArchived() ? "Oui" : "Non");
                table.addCell(fmtOdt(r.getCreatedAt()));
                table.addCell(fmtOdt(r.getUpdatedAt()));
                table.addCell(nvl(r.getUpdatedBy()));
            }
            doc.add(table);
            doc.close();
            return out.toByteArray();
        } catch (DocumentException | IOException e) {
            throw new IllegalStateException("Unable to generate PDF", e);
        }
    }

    /* =========================================================
       Center Accreditations
       ========================================================= */

    public ExportFile exportCenterAccreditations(ExportFormat format, List<CenterAccreditationDtos> rows, String filenameBase) {
        Map<Long, TrainingCenterDtos> tcMap  = buildTrainingCenterDtoMap();
        Map<Long, String>             sNames = buildSectorMap();
        Map<Long, String>             pcNames = buildPilotCenterMap();
        return switch (format) {
            case CSV  -> new ExportFile(centerAccreditationsCsv(rows, tcMap, sNames, pcNames),  filenameBase + ".csv",  "text/csv; charset=utf-8");
            case XLSX -> new ExportFile(centerAccreditationsXlsx(rows, tcMap, sNames, pcNames), filenameBase + ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            case PDF  -> new ExportFile(centerAccreditationsPdf(rows, tcMap, sNames, pcNames, "Agréments centres"), filenameBase + ".pdf", "application/pdf");
        };
    }

    private byte[] centerAccreditationsCsv(List<CenterAccreditationDtos> rows, Map<Long, TrainingCenterDtos> tcMap, Map<Long, String> sNames, Map<Long, String> pcNames) {
        StringBuilder sb = new StringBuilder();
        sb.append("Nom,N° entreprise,Siège social,Adresses de sites,Date de réception,Statut,N° agrément,Début,Fin,Initiale,Continue,Archivé,Centres pilotes,Secteurs,Personnes de contact,Créé le,Modifié le,Modifié par\n");
        for (var r : rows) {
            TrainingCenterDtos tc = tcMap.get(r.getTrainingCenterId());
            sb.append(csv(tc != null ? nvl(tc.getName()) : "")).append(',');
            sb.append(csv(tc != null ? nvl(tc.getCompanyNumber()) : "")).append(',');
            sb.append(csv(tc != null ? fmtHq(tc) : "")).append(',');
            sb.append(csv(fmtAddresses(r))).append(',');
            sb.append(csv(fmtLd(r.getReceivedDate()))).append(',');
            sb.append(csv(nvl(r.getRequestStatus() != null ? r.getRequestStatus().name() : ""))).append(',');
            sb.append(csv(nvl(r.getAccreditationNumber()))).append(',');
            sb.append(csv(fmtLd(r.getStartDate()))).append(',');
            sb.append(csv(fmtLd(r.getEndDate()))).append(',');
            sb.append(r.isInitial() ? "Oui" : "Non").append(',');
            sb.append(r.isContinuous() ? "Oui" : "Non").append(',');
            sb.append(r.isArchived() ? "Oui" : "Non").append(',');
            sb.append(csv(tc != null ? joinNames(tc.getPilotCenterIds(), pcNames) : "")).append(',');
            sb.append(csv(tc != null ? joinNames(tc.getSectorIds(), sNames) : "")).append(',');
            sb.append(csv(fmtContacts(r))).append(',');
            sb.append(csv(fmtOdt(r.getCreatedAt()))).append(',');
            sb.append(csv(fmtOdt(r.getUpdatedAt()))).append(',');
            sb.append(csv(nvl(r.getUpdatedBy()))).append('\n');
        }
        return withBom(sb);
    }

    private byte[] centerAccreditationsXlsx(List<CenterAccreditationDtos> rows, Map<Long, TrainingCenterDtos> tcMap, Map<Long, String> sNames, Map<Long, String> pcNames) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var sheet = wb.createSheet("Agréments centres");
            int rowIdx = 0;
            Row header = sheet.createRow(rowIdx++);
            header.createCell(0).setCellValue("Nom");
            header.createCell(1).setCellValue("N° entreprise");
            header.createCell(2).setCellValue("Siège social");
            header.createCell(3).setCellValue("Adresses de sites");
            header.createCell(4).setCellValue("Date de réception");
            header.createCell(5).setCellValue("Statut");
            header.createCell(6).setCellValue("N° agrément");
            header.createCell(7).setCellValue("Début");
            header.createCell(8).setCellValue("Fin");
            header.createCell(9).setCellValue("Initiale");
            header.createCell(10).setCellValue("Continue");
            header.createCell(11).setCellValue("Archivé");
            header.createCell(12).setCellValue("Centres pilotes");
            header.createCell(13).setCellValue("Secteurs");
            header.createCell(14).setCellValue("Personnes de contact");
            header.createCell(15).setCellValue("Créé le");
            header.createCell(16).setCellValue("Modifié le");
            header.createCell(17).setCellValue("Modifié par");
            for (var r : rows) {
                TrainingCenterDtos tc = tcMap.get(r.getTrainingCenterId());
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(tc != null ? nvl(tc.getName()) : "");
                row.createCell(1).setCellValue(tc != null ? nvl(tc.getCompanyNumber()) : "");
                row.createCell(2).setCellValue(tc != null ? fmtHq(tc) : "");
                row.createCell(3).setCellValue(fmtAddresses(r));
                row.createCell(4).setCellValue(fmtLd(r.getReceivedDate()));
                row.createCell(5).setCellValue(r.getRequestStatus() != null ? r.getRequestStatus().name() : "");
                row.createCell(6).setCellValue(nvl(r.getAccreditationNumber()));
                row.createCell(7).setCellValue(fmtLd(r.getStartDate()));
                row.createCell(8).setCellValue(fmtLd(r.getEndDate()));
                row.createCell(9).setCellValue(r.isInitial() ? "Oui" : "Non");
                row.createCell(10).setCellValue(r.isContinuous() ? "Oui" : "Non");
                row.createCell(11).setCellValue(r.isArchived() ? "Oui" : "Non");
                row.createCell(12).setCellValue(tc != null ? joinNames(tc.getPilotCenterIds(), pcNames) : "");
                row.createCell(13).setCellValue(tc != null ? joinNames(tc.getSectorIds(), sNames) : "");
                row.createCell(14).setCellValue(fmtContacts(r));
                row.createCell(15).setCellValue(fmtOdt(r.getCreatedAt()));
                row.createCell(16).setCellValue(fmtOdt(r.getUpdatedAt()));
                row.createCell(17).setCellValue(nvl(r.getUpdatedBy()));
            }
            for (int i = 0; i <= 17; i++) sheet.autoSizeColumn(i);
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Unable to generate XLSX", e);
        }
    }

    private byte[] centerAccreditationsPdf(List<CenterAccreditationDtos> rows, Map<Long, TrainingCenterDtos> tcMap, Map<Long, String> sNames, Map<Long, String> pcNames, String title) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4.rotate(), 24, 24, 24, 24);
            PdfWriter.getInstance(doc, out);
            doc.open();
            doc.add(new Paragraph(title, new Font(Font.HELVETICA, 14, Font.BOLD)));
            doc.add(new Paragraph(" "));
            PdfPTable table = new PdfPTable(18);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{2.0f, 1.2f, 1.8f, 1.5f, 1.0f, 1.0f, 1.0f, 1.0f, 1.0f, 0.7f, 0.7f, 0.7f, 1.5f, 1.5f, 1.5f, 1.2f, 1.2f, 1.2f});
            addHeader(table, "Nom");
            addHeader(table, "N° entreprise");
            addHeader(table, "Siège social");
            addHeader(table, "Adresses de sites");
            addHeader(table, "Date réception");
            addHeader(table, "Statut");
            addHeader(table, "N° agrément");
            addHeader(table, "Début");
            addHeader(table, "Fin");
            addHeader(table, "Init.");
            addHeader(table, "Cont.");
            addHeader(table, "Arch.");
            addHeader(table, "Centres pilotes");
            addHeader(table, "Secteurs");
            addHeader(table, "Contacts");
            addHeader(table, "Créé le");
            addHeader(table, "Modifié le");
            addHeader(table, "Modifié par");
            for (var r : rows) {
                TrainingCenterDtos tc = tcMap.get(r.getTrainingCenterId());
                table.addCell(tc != null ? nvl(tc.getName()) : "");
                table.addCell(tc != null ? nvl(tc.getCompanyNumber()) : "");
                table.addCell(tc != null ? fmtHq(tc) : "");
                table.addCell(fmtAddresses(r));
                table.addCell(fmtLd(r.getReceivedDate()));
                table.addCell(r.getRequestStatus() != null ? r.getRequestStatus().name() : "");
                table.addCell(nvl(r.getAccreditationNumber()));
                table.addCell(fmtLd(r.getStartDate()));
                table.addCell(fmtLd(r.getEndDate()));
                table.addCell(r.isInitial() ? "Oui" : "Non");
                table.addCell(r.isContinuous() ? "Oui" : "Non");
                table.addCell(r.isArchived() ? "Oui" : "Non");
                table.addCell(tc != null ? joinNames(tc.getPilotCenterIds(), pcNames) : "");
                table.addCell(tc != null ? joinNames(tc.getSectorIds(), sNames) : "");
                table.addCell(fmtContacts(r));
                table.addCell(fmtOdt(r.getCreatedAt()));
                table.addCell(fmtOdt(r.getUpdatedAt()));
                table.addCell(nvl(r.getUpdatedBy()));
            }
            doc.add(table);
            doc.close();
            return out.toByteArray();
        } catch (DocumentException | IOException e) {
            throw new IllegalStateException("Unable to generate PDF", e);
        }
    }

    /* =========================================================
       Training Accreditations
       ========================================================= */

    public ExportFile exportTrainingAccreditations(ExportFormat format, List<TrainingAccreditationDtos> rows, String filenameBase) {
        return switch (format) {
            case CSV  -> new ExportFile(trainingAccreditationsCsv(rows),  filenameBase + ".csv",  "text/csv; charset=utf-8");
            case XLSX -> new ExportFile(trainingAccreditationsXlsx(rows), filenameBase + ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            case PDF  -> new ExportFile(trainingAccreditationsPdf(rows, "Agréments formation"), filenameBase + ".pdf", "application/pdf");
        };
    }

    private byte[] trainingAccreditationsCsv(List<TrainingAccreditationDtos> rows) {
        StringBuilder sb = new StringBuilder();
        sb.append("Type,N° agrément,Titre,Agrément centre,Sous-modules,Organismes partenaires,Phytolicences,Thèmes,Sous-thèmes,Formateurs,Public cible,Date début,Date fin,Initiale,Continue,Subventionnée,Durée (h),Points,Statut,Date réception,Archivé,Créé le,Modifié le,Modifié par\n");
        for (var r : rows) {
            sb.append(csv(taTypeLabel(r))).append(',');
            sb.append(csv(nvl(r.getAccreditationNumber()))).append(',');
            sb.append(csv(nvl(r.getTitle()))).append(',');
            sb.append(csv(nvl(r.getCenterAccreditationLabel()))).append(',');
            sb.append(csv(joinSet(r.getSubModuleLabels()))).append(',');
            sb.append(csv(joinSet(r.getPartnerAccreditationLabels()))).append(',');
            sb.append(csv(joinSet(r.getLicenseTypeLabels()))).append(',');
            sb.append(csv(joinSet(r.getThemeLabels()))).append(',');
            sb.append(csv(joinSet(r.getSubThemeLabels()))).append(',');
            sb.append(csv(joinSet(r.getTrainerLabels()))).append(',');
            sb.append(csv(nvl(r.getPublicCible()))).append(',');
            sb.append(csv(fmtLd(r.getStartDate()))).append(',');
            sb.append(csv(fmtLd(r.getEndDate()))).append(',');
            sb.append(r.isInitial() ? "Oui" : "Non").append(',');
            sb.append(r.isContinuous() ? "Oui" : "Non").append(',');
            sb.append(r.isSubsidized() ? "Oui" : "Non").append(',');
            sb.append(r.getDurationHours() != null ? r.getDurationHours() : "").append(',');
            sb.append(r.getTrainingPoints() != null ? r.getTrainingPoints() : "").append(',');
            sb.append(csv(r.getRequestStatus() != null ? r.getRequestStatus().name() : "")).append(',');
            sb.append(csv(fmtLd(r.getReceivedDate()))).append(',');
            sb.append(r.isArchived() ? "Oui" : "Non").append(',');
            sb.append(csv(fmtOdt(r.getCreatedAt()))).append(',');
            sb.append(csv(fmtOdt(r.getUpdatedAt()))).append(',');
            sb.append(csv(nvl(r.getUpdatedBy()))).append('\n');
        }
        return withBom(sb);
    }

    private byte[] trainingAccreditationsXlsx(List<TrainingAccreditationDtos> rows) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var sheet = wb.createSheet("Agréments formation");
            int rowIdx = 0;
            Row header = sheet.createRow(rowIdx++);
            header.createCell(0).setCellValue("Type");
            header.createCell(1).setCellValue("N° agrément");
            header.createCell(2).setCellValue("Titre");
            header.createCell(3).setCellValue("Agrément centre");
            header.createCell(4).setCellValue("Sous-modules");
            header.createCell(5).setCellValue("Organismes partenaires");
            header.createCell(6).setCellValue("Phytolicences");
            header.createCell(7).setCellValue("Thèmes");
            header.createCell(8).setCellValue("Sous-thèmes");
            header.createCell(9).setCellValue("Formateurs");
            header.createCell(10).setCellValue("Public cible");
            header.createCell(11).setCellValue("Date début");
            header.createCell(12).setCellValue("Date fin");
            header.createCell(13).setCellValue("Initiale");
            header.createCell(14).setCellValue("Continue");
            header.createCell(15).setCellValue("Subventionnée");
            header.createCell(16).setCellValue("Durée (h)");
            header.createCell(17).setCellValue("Points");
            header.createCell(18).setCellValue("Statut");
            header.createCell(19).setCellValue("Date réception");
            header.createCell(20).setCellValue("Archivé");
            header.createCell(21).setCellValue("Créé le");
            header.createCell(22).setCellValue("Modifié le");
            header.createCell(23).setCellValue("Modifié par");
            for (var r : rows) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(taTypeLabel(r));
                row.createCell(1).setCellValue(nvl(r.getAccreditationNumber()));
                row.createCell(2).setCellValue(nvl(r.getTitle()));
                row.createCell(3).setCellValue(nvl(r.getCenterAccreditationLabel()));
                row.createCell(4).setCellValue(joinSet(r.getSubModuleLabels()));
                row.createCell(5).setCellValue(joinSet(r.getPartnerAccreditationLabels()));
                row.createCell(6).setCellValue(joinSet(r.getLicenseTypeLabels()));
                row.createCell(7).setCellValue(joinSet(r.getThemeLabels()));
                row.createCell(8).setCellValue(joinSet(r.getSubThemeLabels()));
                row.createCell(9).setCellValue(joinSet(r.getTrainerLabels()));
                row.createCell(10).setCellValue(nvl(r.getPublicCible()));
                row.createCell(11).setCellValue(fmtLd(r.getStartDate()));
                row.createCell(12).setCellValue(fmtLd(r.getEndDate()));
                row.createCell(13).setCellValue(r.isInitial() ? "Oui" : "Non");
                row.createCell(14).setCellValue(r.isContinuous() ? "Oui" : "Non");
                row.createCell(15).setCellValue(r.isSubsidized() ? "Oui" : "Non");
                row.createCell(16).setCellValue(r.getDurationHours() != null ? String.valueOf(r.getDurationHours()) : "");
                row.createCell(17).setCellValue(r.getTrainingPoints() != null ? String.valueOf(r.getTrainingPoints()) : "");
                row.createCell(18).setCellValue(r.getRequestStatus() != null ? r.getRequestStatus().name() : "");
                row.createCell(19).setCellValue(fmtLd(r.getReceivedDate()));
                row.createCell(20).setCellValue(r.isArchived() ? "Oui" : "Non");
                row.createCell(21).setCellValue(fmtOdt(r.getCreatedAt()));
                row.createCell(22).setCellValue(fmtOdt(r.getUpdatedAt()));
                row.createCell(23).setCellValue(nvl(r.getUpdatedBy()));
            }
            for (int i = 0; i <= 23; i++) sheet.autoSizeColumn(i);
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Unable to generate XLSX", e);
        }
    }

    private byte[] trainingAccreditationsPdf(List<TrainingAccreditationDtos> rows, String title) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4.rotate(), 24, 24, 24, 24);
            PdfWriter.getInstance(doc, out);
            doc.open();
            doc.add(new Paragraph(title, new Font(Font.HELVETICA, 14, Font.BOLD)));
            doc.add(new Paragraph(" "));
            PdfPTable table = new PdfPTable(24);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{0.8f, 1.0f, 2.0f, 1.8f, 2.0f, 1.5f, 1.5f, 1.5f, 1.5f, 1.5f, 1.5f, 1.0f, 1.0f, 0.6f, 0.6f, 0.7f, 0.7f, 0.7f, 1.0f, 1.0f, 0.6f, 1.2f, 1.2f, 1.2f});
            addHeader(table, "Type");
            addHeader(table, "N° agr.");
            addHeader(table, "Titre");
            addHeader(table, "Agr. centre");
            addHeader(table, "Sous-modules");
            addHeader(table, "Org. partenaires");
            addHeader(table, "Phytolicences");
            addHeader(table, "Thèmes");
            addHeader(table, "Sous-thèmes");
            addHeader(table, "Formateurs");
            addHeader(table, "Public cible");
            addHeader(table, "Début");
            addHeader(table, "Fin");
            addHeader(table, "Init.");
            addHeader(table, "Cont.");
            addHeader(table, "Subv.");
            addHeader(table, "Durée");
            addHeader(table, "Pts");
            addHeader(table, "Statut");
            addHeader(table, "Réception");
            addHeader(table, "Arch.");
            addHeader(table, "Créé le");
            addHeader(table, "Modifié le");
            addHeader(table, "Modifié par");
            for (var r : rows) {
                table.addCell(taTypeLabel(r));
                table.addCell(nvl(r.getAccreditationNumber()));
                table.addCell(nvl(r.getTitle()));
                table.addCell(nvl(r.getCenterAccreditationLabel()));
                table.addCell(joinSet(r.getSubModuleLabels()));
                table.addCell(joinSet(r.getPartnerAccreditationLabels()));
                table.addCell(joinSet(r.getLicenseTypeLabels()));
                table.addCell(joinSet(r.getThemeLabels()));
                table.addCell(joinSet(r.getSubThemeLabels()));
                table.addCell(joinSet(r.getTrainerLabels()));
                table.addCell(nvl(r.getPublicCible()));
                table.addCell(fmtLd(r.getStartDate()));
                table.addCell(fmtLd(r.getEndDate()));
                table.addCell(r.isInitial() ? "Oui" : "Non");
                table.addCell(r.isContinuous() ? "Oui" : "Non");
                table.addCell(r.isSubsidized() ? "Oui" : "Non");
                table.addCell(r.getDurationHours() != null ? String.valueOf(r.getDurationHours()) : "");
                table.addCell(r.getTrainingPoints() != null ? String.valueOf(r.getTrainingPoints()) : "");
                table.addCell(r.getRequestStatus() != null ? r.getRequestStatus().name() : "");
                table.addCell(fmtLd(r.getReceivedDate()));
                table.addCell(r.isArchived() ? "Oui" : "Non");
                table.addCell(fmtOdt(r.getCreatedAt()));
                table.addCell(fmtOdt(r.getUpdatedAt()));
                table.addCell(nvl(r.getUpdatedBy()));
            }
            doc.add(table);
            doc.close();
            return out.toByteArray();
        } catch (DocumentException | IOException e) {
            throw new IllegalStateException("Unable to generate PDF", e);
        }
    }

    /* =========================================================
       Sub-modules
       ========================================================= */

    public ExportFile exportSubModules(ExportFormat format, List<com.b12.web.dto.SubModuleDtos> rows, String filenameBase) {
        return switch (format) {
            case CSV  -> new ExportFile(subModulesCsv(rows),  filenameBase + ".csv",  "text/csv; charset=utf-8");
            case XLSX -> new ExportFile(subModulesXlsx(rows), filenameBase + ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            case PDF  -> new ExportFile(subModulesPdf(rows, "Sous-modules"), filenameBase + ".pdf", "application/pdf");
        };
    }

    private byte[] subModulesCsv(List<com.b12.web.dto.SubModuleDtos> rows) {
        StringBuilder sb = new StringBuilder();
        sb.append("N° agrément,Titre,Centre de formation,Agrément centre,Organismes partenaires,Phytolicences,Thèmes,Sous-thèmes,Formateurs,Public cible,Date début,Date fin,Initiale,Continue,Subventionnée,Durée (h),Points,Prix (€),Statut,Date réception,Archivé,Créé le,Modifié le,Modifié par\n");
        for (var r : rows) {
            sb.append(csv(nvl(r.getAccreditationNumber()))).append(',');
            sb.append(csv(nvl(r.getTitle()))).append(',');
            sb.append(csv(nvl(r.getTrainingCenterLabel()))).append(',');
            sb.append(csv(nvl(r.getCenterAccreditationLabel()))).append(',');
            sb.append(csv(joinSet(r.getPartnerAccreditationLabels()))).append(',');
            sb.append(csv(joinSet(r.getLicenseTypeLabels()))).append(',');
            sb.append(csv(joinSet(r.getThemeLabels()))).append(',');
            sb.append(csv(joinSet(r.getSubThemeLabels()))).append(',');
            sb.append(csv(joinSet(r.getTrainerLabels()))).append(',');
            sb.append(csv(nvl(r.getPublicCible()))).append(',');
            sb.append(csv(fmtLd(r.getStartDate()))).append(',');
            sb.append(csv(fmtLd(r.getEndDate()))).append(',');
            sb.append(r.isInitial() ? "Oui" : "Non").append(',');
            sb.append(r.isContinuous() ? "Oui" : "Non").append(',');
            sb.append(r.isSubsidized() ? "Oui" : "Non").append(',');
            sb.append(r.getDurationHours() != null ? r.getDurationHours() : "").append(',');
            sb.append(r.getTrainingPoints() != null ? r.getTrainingPoints() : "").append(',');
            sb.append(r.getPrice() != null ? r.getPrice() : "").append(',');
            sb.append(csv(r.getRequestStatus() != null ? r.getRequestStatus().name() : "")).append(',');
            sb.append(csv(fmtLd(r.getReceivedDate()))).append(',');
            sb.append(r.isArchived() ? "Oui" : "Non").append(',');
            sb.append(csv(fmtOdt(r.getCreatedAt()))).append(',');
            sb.append(csv(fmtOdt(r.getUpdatedAt()))).append(',');
            sb.append(csv(nvl(r.getUpdatedBy()))).append('\n');
        }
        return withBom(sb);
    }

    private byte[] subModulesXlsx(List<com.b12.web.dto.SubModuleDtos> rows) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var sheet = wb.createSheet("Sous-modules");
            int rowIdx = 0;
            Row header = sheet.createRow(rowIdx++);
            header.createCell(0).setCellValue("N° agrément");
            header.createCell(1).setCellValue("Titre");
            header.createCell(2).setCellValue("Centre de formation");
            header.createCell(3).setCellValue("Agrément centre");
            header.createCell(4).setCellValue("Organismes partenaires");
            header.createCell(5).setCellValue("Phytolicences");
            header.createCell(6).setCellValue("Thèmes");
            header.createCell(7).setCellValue("Sous-thèmes");
            header.createCell(8).setCellValue("Formateurs");
            header.createCell(9).setCellValue("Public cible");
            header.createCell(10).setCellValue("Date début");
            header.createCell(11).setCellValue("Date fin");
            header.createCell(12).setCellValue("Initiale");
            header.createCell(13).setCellValue("Continue");
            header.createCell(14).setCellValue("Subventionnée");
            header.createCell(15).setCellValue("Durée (h)");
            header.createCell(16).setCellValue("Points");
            header.createCell(17).setCellValue("Prix (€)");
            header.createCell(18).setCellValue("Statut");
            header.createCell(19).setCellValue("Date réception");
            header.createCell(20).setCellValue("Archivé");
            header.createCell(21).setCellValue("Créé le");
            header.createCell(22).setCellValue("Modifié le");
            header.createCell(23).setCellValue("Modifié par");
            for (var r : rows) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(nvl(r.getAccreditationNumber()));
                row.createCell(1).setCellValue(nvl(r.getTitle()));
                row.createCell(2).setCellValue(nvl(r.getTrainingCenterLabel()));
                row.createCell(3).setCellValue(nvl(r.getCenterAccreditationLabel()));
                row.createCell(4).setCellValue(joinSet(r.getPartnerAccreditationLabels()));
                row.createCell(5).setCellValue(joinSet(r.getLicenseTypeLabels()));
                row.createCell(6).setCellValue(joinSet(r.getThemeLabels()));
                row.createCell(7).setCellValue(joinSet(r.getSubThemeLabels()));
                row.createCell(8).setCellValue(joinSet(r.getTrainerLabels()));
                row.createCell(9).setCellValue(nvl(r.getPublicCible()));
                row.createCell(10).setCellValue(fmtLd(r.getStartDate()));
                row.createCell(11).setCellValue(fmtLd(r.getEndDate()));
                row.createCell(12).setCellValue(r.isInitial() ? "Oui" : "Non");
                row.createCell(13).setCellValue(r.isContinuous() ? "Oui" : "Non");
                row.createCell(14).setCellValue(r.isSubsidized() ? "Oui" : "Non");
                row.createCell(15).setCellValue(r.getDurationHours() != null ? String.valueOf(r.getDurationHours()) : "");
                row.createCell(16).setCellValue(r.getTrainingPoints() != null ? String.valueOf(r.getTrainingPoints()) : "");
                row.createCell(17).setCellValue(r.getPrice() != null ? String.valueOf(r.getPrice()) : "");
                row.createCell(18).setCellValue(r.getRequestStatus() != null ? r.getRequestStatus().name() : "");
                row.createCell(19).setCellValue(fmtLd(r.getReceivedDate()));
                row.createCell(20).setCellValue(r.isArchived() ? "Oui" : "Non");
                row.createCell(21).setCellValue(fmtOdt(r.getCreatedAt()));
                row.createCell(22).setCellValue(fmtOdt(r.getUpdatedAt()));
                row.createCell(23).setCellValue(nvl(r.getUpdatedBy()));
            }
            for (int i = 0; i <= 23; i++) sheet.autoSizeColumn(i);
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Unable to generate XLSX", e);
        }
    }

    private byte[] subModulesPdf(List<com.b12.web.dto.SubModuleDtos> rows, String title) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4.rotate(), 24, 24, 24, 24);
            PdfWriter.getInstance(doc, out);
            doc.open();
            doc.add(new Paragraph(title, new Font(Font.HELVETICA, 14, Font.BOLD)));
            doc.add(new Paragraph(" "));
            PdfPTable table = new PdfPTable(24);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{1.0f, 2.0f, 1.8f, 1.8f, 1.5f, 1.5f, 1.5f, 1.5f, 1.5f, 1.5f, 1.0f, 1.0f, 0.6f, 0.6f, 0.7f, 0.7f, 0.7f, 0.8f, 1.0f, 1.0f, 0.6f, 1.2f, 1.2f, 1.2f});
            addHeader(table, "N° agr.");
            addHeader(table, "Titre");
            addHeader(table, "Centre de formation");
            addHeader(table, "Agr. centre");
            addHeader(table, "Org. partenaires");
            addHeader(table, "Phytolicences");
            addHeader(table, "Thèmes");
            addHeader(table, "Sous-thèmes");
            addHeader(table, "Formateurs");
            addHeader(table, "Public cible");
            addHeader(table, "Début");
            addHeader(table, "Fin");
            addHeader(table, "Init.");
            addHeader(table, "Cont.");
            addHeader(table, "Subv.");
            addHeader(table, "Durée");
            addHeader(table, "Pts");
            addHeader(table, "Prix");
            addHeader(table, "Statut");
            addHeader(table, "Réception");
            addHeader(table, "Arch.");
            addHeader(table, "Créé le");
            addHeader(table, "Modifié le");
            addHeader(table, "Modifié par");
            for (var r : rows) {
                table.addCell(nvl(r.getAccreditationNumber()));
                table.addCell(nvl(r.getTitle()));
                table.addCell(nvl(r.getTrainingCenterLabel()));
                table.addCell(nvl(r.getCenterAccreditationLabel()));
                table.addCell(joinSet(r.getPartnerAccreditationLabels()));
                table.addCell(joinSet(r.getLicenseTypeLabels()));
                table.addCell(joinSet(r.getThemeLabels()));
                table.addCell(joinSet(r.getSubThemeLabels()));
                table.addCell(joinSet(r.getTrainerLabels()));
                table.addCell(nvl(r.getPublicCible()));
                table.addCell(fmtLd(r.getStartDate()));
                table.addCell(fmtLd(r.getEndDate()));
                table.addCell(r.isInitial() ? "Oui" : "Non");
                table.addCell(r.isContinuous() ? "Oui" : "Non");
                table.addCell(r.isSubsidized() ? "Oui" : "Non");
                table.addCell(r.getDurationHours() != null ? String.valueOf(r.getDurationHours()) : "");
                table.addCell(r.getTrainingPoints() != null ? String.valueOf(r.getTrainingPoints()) : "");
                table.addCell(r.getPrice() != null ? String.valueOf(r.getPrice()) : "");
                table.addCell(r.getRequestStatus() != null ? r.getRequestStatus().name() : "");
                table.addCell(fmtLd(r.getReceivedDate()));
                table.addCell(r.isArchived() ? "Oui" : "Non");
                table.addCell(fmtOdt(r.getCreatedAt()));
                table.addCell(fmtOdt(r.getUpdatedAt()));
                table.addCell(nvl(r.getUpdatedBy()));
            }
            doc.add(table);
            doc.close();
            return out.toByteArray();
        } catch (DocumentException | IOException e) {
            throw new IllegalStateException("Unable to generate PDF", e);
        }
    }

    /* =========================================================
       Trainers
       ========================================================= */

    public ExportFile exportTrainers(ExportFormat format, List<TrainerDtos> rows, String filenameBase) {
        return switch (format) {
            case CSV  -> new ExportFile(trainersCsv(rows),  filenameBase + ".csv",  "text/csv; charset=utf-8");
            case XLSX -> new ExportFile(trainersXlsx(rows), filenameBase + ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            case PDF  -> new ExportFile(trainersPdf(rows, "Formateurs"), filenameBase + ".pdf", "application/pdf");
        };
    }

    private byte[] trainersCsv(List<TrainerDtos> rows) {
        StringBuilder sb = new StringBuilder();
        sb.append("Prénom,Nom,Email,Téléphone,N° phytolicence,Organismes partenaires,Agréments formation,Centres de formation,Archivé,Créé le,Modifié le,Modifié par\n");
        for (var r : rows) {
            sb.append(csv(nvl(r.getFirstName()))).append(',');
            sb.append(csv(nvl(r.getLastName()))).append(',');
            sb.append(csv(nvl(r.getEmail()))).append(',');
            sb.append(csv(nvl(r.getPhone()))).append(',');
            sb.append(csv(nvl(r.getPhytolicenceNumber()))).append(',');
            sb.append(csv(joinSet(r.getPartnerOrganismLabels()))).append(',');
            sb.append(csv(joinSet(r.getTrainingAccreditationLabels()))).append(',');
            sb.append(csv(joinSet(r.getTrainingCenterLabels()))).append(',');
            sb.append(r.isArchived() ? "Oui" : "Non").append(',');
            sb.append(csv(fmtOdt(r.getCreatedAt()))).append(',');
            sb.append(csv(fmtOdt(r.getUpdatedAt()))).append(',');
            sb.append(csv(nvl(r.getUpdatedBy()))).append('\n');
        }
        return withBom(sb);
    }

    private byte[] trainersXlsx(List<TrainerDtos> rows) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var sheet = wb.createSheet("Formateurs");
            int rowIdx = 0;
            Row header = sheet.createRow(rowIdx++);
            header.createCell(0).setCellValue("Prénom");
            header.createCell(1).setCellValue("Nom");
            header.createCell(2).setCellValue("Email");
            header.createCell(3).setCellValue("Téléphone");
            header.createCell(4).setCellValue("N° phytolicence");
            header.createCell(5).setCellValue("Organismes partenaires");
            header.createCell(6).setCellValue("Agréments formation");
            header.createCell(7).setCellValue("Centres de formation");
            header.createCell(8).setCellValue("Archivé");
            header.createCell(9).setCellValue("Créé le");
            header.createCell(10).setCellValue("Modifié le");
            header.createCell(11).setCellValue("Modifié par");
            for (var r : rows) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(nvl(r.getFirstName()));
                row.createCell(1).setCellValue(nvl(r.getLastName()));
                row.createCell(2).setCellValue(nvl(r.getEmail()));
                row.createCell(3).setCellValue(nvl(r.getPhone()));
                row.createCell(4).setCellValue(nvl(r.getPhytolicenceNumber()));
                row.createCell(5).setCellValue(joinSet(r.getPartnerOrganismLabels()));
                row.createCell(6).setCellValue(joinSet(r.getTrainingAccreditationLabels()));
                row.createCell(7).setCellValue(joinSet(r.getTrainingCenterLabels()));
                row.createCell(8).setCellValue(r.isArchived() ? "Oui" : "Non");
                row.createCell(9).setCellValue(fmtOdt(r.getCreatedAt()));
                row.createCell(10).setCellValue(fmtOdt(r.getUpdatedAt()));
                row.createCell(11).setCellValue(nvl(r.getUpdatedBy()));
            }
            for (int i = 0; i <= 11; i++) sheet.autoSizeColumn(i);
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Unable to generate XLSX", e);
        }
    }

    private byte[] trainersPdf(List<TrainerDtos> rows, String title) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4.rotate(), 24, 24, 24, 24);
            PdfWriter.getInstance(doc, out);
            doc.open();
            doc.add(new Paragraph(title, new Font(Font.HELVETICA, 14, Font.BOLD)));
            doc.add(new Paragraph(" "));
            PdfPTable table = new PdfPTable(12);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{1.2f, 1.2f, 1.8f, 1.2f, 1.2f, 1.8f, 2.2f, 2.0f, 0.7f, 1.2f, 1.2f, 1.2f});
            addHeader(table, "Prénom");
            addHeader(table, "Nom");
            addHeader(table, "Email");
            addHeader(table, "Téléphone");
            addHeader(table, "N° phyto.");
            addHeader(table, "Organismes");
            addHeader(table, "Agréments");
            addHeader(table, "Centres");
            addHeader(table, "Arch.");
            addHeader(table, "Créé le");
            addHeader(table, "Modifié le");
            addHeader(table, "Modifié par");
            for (var r : rows) {
                table.addCell(nvl(r.getFirstName()));
                table.addCell(nvl(r.getLastName()));
                table.addCell(nvl(r.getEmail()));
                table.addCell(nvl(r.getPhone()));
                table.addCell(nvl(r.getPhytolicenceNumber()));
                table.addCell(joinSet(r.getPartnerOrganismLabels()));
                table.addCell(joinSet(r.getTrainingAccreditationLabels()));
                table.addCell(joinSet(r.getTrainingCenterLabels()));
                table.addCell(r.isArchived() ? "Oui" : "Non");
                table.addCell(fmtOdt(r.getCreatedAt()));
                table.addCell(fmtOdt(r.getUpdatedAt()));
                table.addCell(nvl(r.getUpdatedBy()));
            }
            doc.add(table);
            doc.close();
            return out.toByteArray();
        } catch (DocumentException | IOException e) {
            throw new IllegalStateException("Unable to generate PDF", e);
        }
    }

    /* =========================================================
       Training Activities
       ========================================================= */

    public ExportFile exportTrainingActivities(ExportFormat format, List<TrainingActivityDtos> rows, String filenameBase) {
        return switch (format) {
            case CSV  -> new ExportFile(trainingActivitiesCsv(rows),  filenameBase + ".csv",  "text/csv; charset=utf-8");
            case XLSX -> new ExportFile(trainingActivitiesXlsx(rows), filenameBase + ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            case PDF  -> new ExportFile(trainingActivitiesPdf(rows, "Activités de formation"), filenameBase + ".pdf", "application/pdf");
        };
    }

    private byte[] trainingActivitiesCsv(List<TrainingActivityDtos> rows) {
        StringBuilder sb = new StringBuilder();
        sb.append("Agrément formation,Date début,Date fin,Nb participants,En ligne,Prix membre,Prix non-membre,Phytodama,Adresse,Archivé,Créé le,Modifié le,Modifié par\n");
        for (var r : rows) {
            sb.append(csv(nvl(r.getTrainingAccreditationLabel()))).append(',');
            sb.append(csv(fmtLd(r.getStartDate()))).append(',');
            sb.append(csv(fmtLd(r.getEndDate()))).append(',');
            sb.append(r.getNumberOfParticipants() != null ? r.getNumberOfParticipants() : "").append(',');
            sb.append(r.isOnline() ? "Oui" : "Non").append(',');
            sb.append(r.getMemberPrice() != null ? r.getMemberPrice() : "").append(',');
            sb.append(r.getNonMemberPrice() != null ? r.getNonMemberPrice() : "").append(',');
            sb.append(r.isPhytodama() ? "Oui" : "Non").append(',');
            sb.append(csv(fmtActivityAddress(r))).append(',');
            sb.append(r.isArchived() ? "Oui" : "Non").append(',');
            sb.append(csv(fmtOdt(r.getCreatedAt()))).append(',');
            sb.append(csv(fmtOdt(r.getUpdatedAt()))).append(',');
            sb.append(csv(nvl(r.getUpdatedBy()))).append('\n');
        }
        return withBom(sb);
    }

    private byte[] trainingActivitiesXlsx(List<TrainingActivityDtos> rows) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var sheet = wb.createSheet("Activités formation");
            int rowIdx = 0;
            Row header = sheet.createRow(rowIdx++);
            header.createCell(0).setCellValue("Agrément formation");
            header.createCell(1).setCellValue("Date début");
            header.createCell(2).setCellValue("Date fin");
            header.createCell(3).setCellValue("Nb participants");
            header.createCell(4).setCellValue("En ligne");
            header.createCell(5).setCellValue("Prix membre");
            header.createCell(6).setCellValue("Prix non-membre");
            header.createCell(7).setCellValue("Phytodama");
            header.createCell(8).setCellValue("Adresse");
            header.createCell(9).setCellValue("Archivé");
            header.createCell(10).setCellValue("Créé le");
            header.createCell(11).setCellValue("Modifié le");
            header.createCell(12).setCellValue("Modifié par");
            for (var r : rows) {
                Row row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(nvl(r.getTrainingAccreditationLabel()));
                row.createCell(1).setCellValue(fmtLd(r.getStartDate()));
                row.createCell(2).setCellValue(fmtLd(r.getEndDate()));
                row.createCell(3).setCellValue(r.getNumberOfParticipants() != null ? String.valueOf(r.getNumberOfParticipants()) : "");
                row.createCell(4).setCellValue(r.isOnline() ? "Oui" : "Non");
                row.createCell(5).setCellValue(r.getMemberPrice() != null ? r.getMemberPrice().toPlainString() : "");
                row.createCell(6).setCellValue(r.getNonMemberPrice() != null ? r.getNonMemberPrice().toPlainString() : "");
                row.createCell(7).setCellValue(r.isPhytodama() ? "Oui" : "Non");
                row.createCell(8).setCellValue(fmtActivityAddress(r));
                row.createCell(9).setCellValue(r.isArchived() ? "Oui" : "Non");
                row.createCell(10).setCellValue(fmtOdt(r.getCreatedAt()));
                row.createCell(11).setCellValue(fmtOdt(r.getUpdatedAt()));
                row.createCell(12).setCellValue(nvl(r.getUpdatedBy()));
            }
            for (int i = 0; i <= 12; i++) sheet.autoSizeColumn(i);
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Unable to generate XLSX", e);
        }
    }

    private byte[] trainingActivitiesPdf(List<TrainingActivityDtos> rows, String title) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4.rotate(), 24, 24, 24, 24);
            PdfWriter.getInstance(doc, out);
            doc.open();
            doc.add(new Paragraph(title, new Font(Font.HELVETICA, 14, Font.BOLD)));
            doc.add(new Paragraph(" "));
            PdfPTable table = new PdfPTable(13);
            table.setWidthPercentage(100);
            table.setWidths(new float[]{2.5f, 1.0f, 1.0f, 0.8f, 0.7f, 0.9f, 1.0f, 0.7f, 2.0f, 0.6f, 1.2f, 1.2f, 1.2f});
            addHeader(table, "Agrément formation");
            addHeader(table, "Début");
            addHeader(table, "Fin");
            addHeader(table, "Participants");
            addHeader(table, "En ligne");
            addHeader(table, "Prix mbr.");
            addHeader(table, "Prix non-mbr.");
            addHeader(table, "Phytodama");
            addHeader(table, "Adresse");
            addHeader(table, "Arch.");
            addHeader(table, "Créé le");
            addHeader(table, "Modifié le");
            addHeader(table, "Modifié par");
            for (var r : rows) {
                table.addCell(nvl(r.getTrainingAccreditationLabel()));
                table.addCell(fmtLd(r.getStartDate()));
                table.addCell(fmtLd(r.getEndDate()));
                table.addCell(r.getNumberOfParticipants() != null ? String.valueOf(r.getNumberOfParticipants()) : "");
                table.addCell(r.isOnline() ? "Oui" : "Non");
                table.addCell(r.getMemberPrice() != null ? r.getMemberPrice().toPlainString() : "");
                table.addCell(r.getNonMemberPrice() != null ? r.getNonMemberPrice().toPlainString() : "");
                table.addCell(r.isPhytodama() ? "Oui" : "Non");
                table.addCell(fmtActivityAddress(r));
                table.addCell(r.isArchived() ? "Oui" : "Non");
                table.addCell(fmtOdt(r.getCreatedAt()));
                table.addCell(fmtOdt(r.getUpdatedAt()));
                table.addCell(nvl(r.getUpdatedBy()));
            }
            doc.add(table);
            doc.close();
            return out.toByteArray();
        } catch (DocumentException | IOException e) {
            throw new IllegalStateException("Unable to generate PDF", e);
        }
    }

    /* =========================================================
       Stats (tableau de bord)
       ========================================================= */

    public ExportFile exportStats(ExportFormat format, StatsDto s) {
        String base = "tableau-de-bord-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        return switch (format) {
            case CSV  -> new ExportFile(statsCsv(s),  base + ".csv",  "text/csv; charset=utf-8");
            case XLSX -> new ExportFile(statsXlsx(s), base + ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            case PDF  -> new ExportFile(statsPdf(s),  base + ".pdf",  "application/pdf");
        };
    }

    private byte[] statsCsv(StatsDto s) {
        StringBuilder sb = new StringBuilder();
        sb.append("Catégorie,Indicateur,Valeur\n");
        sb.append("Centres de formation,Actifs,").append(s.trainingCentersActive()).append('\n');
        sb.append("Centres de formation,Archivés,").append(s.trainingCentersArchived()).append('\n');
        sb.append("Agréments centres,Actifs,").append(s.centerAccreditationsActive()).append('\n');
        sb.append("Agréments centres,Archivés,").append(s.centerAccreditationsArchived()).append('\n');
        sb.append("Agréments centres,Expirant dans 30j,").append(s.centerAccreditationsExpiringIn30Days()).append('\n');
        sb.append("Agréments centres,Expirant dans 60j,").append(s.centerAccreditationsExpiringIn60Days()).append('\n');
        sb.append("Agréments centres,Acceptés,").append(s.caAccepted()).append('\n');
        sb.append("Agréments centres,En attente,").append(s.caPending()).append('\n');
        sb.append("Agréments centres,Reçus,").append(s.caReceived()).append('\n');
        sb.append("Agréments centres,Refusés,").append(s.caRefused()).append('\n');
        sb.append("Agréments formation,Actifs,").append(s.trainingAccreditationsActive()).append('\n');
        sb.append("Agréments formation,Archivés,").append(s.trainingAccreditationsArchived()).append('\n');
        sb.append("Agréments formation,Acceptés,").append(s.taAccepted()).append('\n');
        sb.append("Agréments formation,En attente,").append(s.taPending()).append('\n');
        sb.append("Agréments formation,Reçus,").append(s.taReceived()).append('\n');
        sb.append("Agréments formation,Refusés,").append(s.taRefused()).append('\n');
        sb.append("Formateurs,Actifs,").append(s.trainersActive()).append('\n');
        sb.append("Formateurs,Archivés,").append(s.trainersArchived()).append('\n');
        sb.append("Activités de formation,Cette année,").append(s.activitiesThisYear()).append('\n');
        sb.append("Activités de formation,Total,").append(s.activitiesTotal()).append('\n');
        sb.append("Données de référence,Thématiques,").append(s.themesTotal()).append('\n');
        sb.append("Données de référence,Types de phytolicences,").append(s.licenseTypesTotal()).append('\n');
        sb.append("Données de référence,Secteurs,").append(s.sectorsTotal()).append('\n');
        sb.append("Données de référence,Organismes,").append(s.organismsTotal()).append('\n');
        sb.append("Données de référence,Centres pilotes,").append(s.pilotCentersTotal()).append('\n');
        sb.append("Données de référence,Sous-modules actifs,").append(s.subModulesActive()).append('\n');
        sb.append('\n');
        sb.append("Activités mensuelles,Année,Mois,Nombre\n");
        for (MonthlyStatDto m : s.activitiesLast12Months()) {
            sb.append(',').append(m.year()).append(',').append(m.month()).append(',').append(m.count()).append('\n');
        }
        return withBom(sb);
    }

    private byte[] statsXlsx(StatsDto s) {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet1 = wb.createSheet("Synthèse");
            int r = 0;
            Row hdr = sheet1.createRow(r++);
            hdr.createCell(0).setCellValue("Catégorie");
            hdr.createCell(1).setCellValue("Indicateur");
            hdr.createCell(2).setCellValue("Valeur");
            r = statsXlsxRows(sheet1, r, "Centres de formation", new String[][]{
                {"Actifs", String.valueOf(s.trainingCentersActive())},
                {"Archivés", String.valueOf(s.trainingCentersArchived())}
            });
            r = statsXlsxRows(sheet1, r, "Agréments centres", new String[][]{
                {"Actifs", String.valueOf(s.centerAccreditationsActive())},
                {"Archivés", String.valueOf(s.centerAccreditationsArchived())},
                {"Expirant dans 30j", String.valueOf(s.centerAccreditationsExpiringIn30Days())},
                {"Expirant dans 60j", String.valueOf(s.centerAccreditationsExpiringIn60Days())},
                {"Acceptés", String.valueOf(s.caAccepted())},
                {"En attente", String.valueOf(s.caPending())},
                {"Reçus", String.valueOf(s.caReceived())},
                {"Refusés", String.valueOf(s.caRefused())}
            });
            r = statsXlsxRows(sheet1, r, "Agréments formation", new String[][]{
                {"Actifs", String.valueOf(s.trainingAccreditationsActive())},
                {"Archivés", String.valueOf(s.trainingAccreditationsArchived())},
                {"Acceptés", String.valueOf(s.taAccepted())},
                {"En attente", String.valueOf(s.taPending())},
                {"Reçus", String.valueOf(s.taReceived())},
                {"Refusés", String.valueOf(s.taRefused())}
            });
            r = statsXlsxRows(sheet1, r, "Formateurs", new String[][]{
                {"Actifs", String.valueOf(s.trainersActive())},
                {"Archivés", String.valueOf(s.trainersArchived())}
            });
            r = statsXlsxRows(sheet1, r, "Activités de formation", new String[][]{
                {"Cette année", String.valueOf(s.activitiesThisYear())},
                {"Total", String.valueOf(s.activitiesTotal())}
            });
            statsXlsxRows(sheet1, r, "Données de référence", new String[][]{
                {"Thématiques", String.valueOf(s.themesTotal())},
                {"Types de phytolicences", String.valueOf(s.licenseTypesTotal())},
                {"Secteurs", String.valueOf(s.sectorsTotal())},
                {"Organismes", String.valueOf(s.organismsTotal())},
                {"Centres pilotes", String.valueOf(s.pilotCentersTotal())},
                {"Sous-modules actifs", String.valueOf(s.subModulesActive())}
            });
            for (int i = 0; i <= 2; i++) sheet1.autoSizeColumn(i);

            Sheet sheet2 = wb.createSheet("Activités mensuelles");
            int r2 = 0;
            Row hdr2 = sheet2.createRow(r2++);
            hdr2.createCell(0).setCellValue("Année");
            hdr2.createCell(1).setCellValue("Mois");
            hdr2.createCell(2).setCellValue("Nombre");
            for (MonthlyStatDto m : s.activitiesLast12Months()) {
                Row row = sheet2.createRow(r2++);
                row.createCell(0).setCellValue(m.year());
                row.createCell(1).setCellValue(m.month());
                row.createCell(2).setCellValue(m.count());
            }
            for (int i = 0; i <= 2; i++) sheet2.autoSizeColumn(i);

            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Unable to generate XLSX", e);
        }
    }

    private static int statsXlsxRows(Sheet sheet, int startRow, String category, String[][] entries) {
        for (String[] entry : entries) {
            Row row = sheet.createRow(startRow++);
            row.createCell(0).setCellValue(category);
            row.createCell(1).setCellValue(entry[0]);
            row.createCell(2).setCellValue(entry[1]);
        }
        return ++startRow; // blank row between sections
    }

    private byte[] statsPdf(StatsDto s) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4, 36, 36, 36, 36);
            PdfWriter.getInstance(doc, out);
            doc.open();

            Font titleFont   = new Font(Font.HELVETICA, 16, Font.BOLD);
            Font sectionFont = new Font(Font.HELVETICA, 12, Font.BOLD);
            Font normalFont  = new Font(Font.HELVETICA, 10, Font.NORMAL);

            doc.add(new Paragraph("Tableau de bord — Statistiques", titleFont));
            doc.add(new Paragraph("Généré le : " + LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")), normalFont));
            doc.add(new Paragraph(" "));

            statsPdfSection(doc, sectionFont, "Centres de formation", new String[][]{
                {"Actifs", String.valueOf(s.trainingCentersActive())},
                {"Archivés", String.valueOf(s.trainingCentersArchived())}
            });
            statsPdfSection(doc, sectionFont, "Agréments centres", new String[][]{
                {"Actifs", String.valueOf(s.centerAccreditationsActive())},
                {"Archivés", String.valueOf(s.centerAccreditationsArchived())},
                {"Expirant dans 30j", String.valueOf(s.centerAccreditationsExpiringIn30Days())},
                {"Expirant dans 60j", String.valueOf(s.centerAccreditationsExpiringIn60Days())},
                {"Acceptés", String.valueOf(s.caAccepted())},
                {"En attente", String.valueOf(s.caPending())},
                {"Reçus", String.valueOf(s.caReceived())},
                {"Refusés", String.valueOf(s.caRefused())}
            });
            statsPdfSection(doc, sectionFont, "Agréments formation", new String[][]{
                {"Actifs", String.valueOf(s.trainingAccreditationsActive())},
                {"Archivés", String.valueOf(s.trainingAccreditationsArchived())},
                {"Acceptés", String.valueOf(s.taAccepted())},
                {"En attente", String.valueOf(s.taPending())},
                {"Reçus", String.valueOf(s.taReceived())},
                {"Refusés", String.valueOf(s.taRefused())}
            });
            statsPdfSection(doc, sectionFont, "Formateurs", new String[][]{
                {"Actifs", String.valueOf(s.trainersActive())},
                {"Archivés", String.valueOf(s.trainersArchived())}
            });
            statsPdfSection(doc, sectionFont, "Activités de formation", new String[][]{
                {"Cette année", String.valueOf(s.activitiesThisYear())},
                {"Total", String.valueOf(s.activitiesTotal())}
            });
            statsPdfSection(doc, sectionFont, "Données de référence", new String[][]{
                {"Thématiques", String.valueOf(s.themesTotal())},
                {"Types de phytolicences", String.valueOf(s.licenseTypesTotal())},
                {"Secteurs", String.valueOf(s.sectorsTotal())},
                {"Organismes", String.valueOf(s.organismsTotal())},
                {"Centres pilotes", String.valueOf(s.pilotCentersTotal())},
                {"Sous-modules actifs", String.valueOf(s.subModulesActive())}
            });

            doc.add(new Paragraph("Activités de formation — 12 derniers mois", sectionFont));
            doc.add(new Paragraph(" "));
            PdfPTable monthTable = new PdfPTable(3);
            monthTable.setWidthPercentage(60);
            monthTable.setWidths(new float[]{2f, 1.5f, 1.5f});
            addHeader(monthTable, "Mois");
            addHeader(monthTable, "Année");
            addHeader(monthTable, "Nombre");
            String[] months = {"Janvier","Février","Mars","Avril","Mai","Juin",
                               "Juillet","Août","Septembre","Octobre","Novembre","Décembre"};
            for (MonthlyStatDto m : s.activitiesLast12Months()) {
                monthTable.addCell(months[m.month() - 1]);
                monthTable.addCell(String.valueOf(m.year()));
                monthTable.addCell(String.valueOf(m.count()));
            }
            doc.add(monthTable);
            doc.close();
            return out.toByteArray();
        } catch (DocumentException | IOException e) {
            throw new IllegalStateException("Unable to generate PDF", e);
        }
    }

    private static void statsPdfSection(Document doc, Font sectionFont, String title, String[][] entries)
            throws DocumentException {
        doc.add(new Paragraph(title, sectionFont));
        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(80);
        table.setWidths(new float[]{4f, 2f});
        for (String[] entry : entries) {
            table.addCell(entry[0]);
            table.addCell(entry[1]);
        }
        doc.add(table);
        doc.add(new Paragraph(" "));
    }

    /* =========================================================
       Helpers
       ========================================================= */

    private Map<Long, TrainingCenterDtos> buildTrainingCenterDtoMap() {
        return trainingCenterService.findAll().stream()
                .filter(tc -> tc.getId() != null)
                .collect(Collectors.toMap(TrainingCenterDtos::getId, tc -> tc));
    }

    private static String fmtHq(TrainingCenterDtos tc) {
        if (tc == null) return "";
        StringBuilder sb = new StringBuilder();
        if (tc.getHqStreet() != null && !tc.getHqStreet().isBlank()) sb.append(tc.getHqStreet().trim());
        if (tc.getHqNumber() != null && !tc.getHqNumber().isBlank()) sb.append(" ").append(tc.getHqNumber().trim());
        if (tc.getHqPostalCode() != null && !tc.getHqPostalCode().isBlank()) {
            if (!sb.isEmpty()) sb.append(", ");
            sb.append(tc.getHqPostalCode().trim());
        }
        if (tc.getHqCity() != null && !tc.getHqCity().isBlank()) sb.append(" ").append(tc.getHqCity().trim());
        if (tc.getHqProvince() != null && !tc.getHqProvince().isBlank()) sb.append(" (").append(tc.getHqProvince().trim()).append(")");
        return sb.toString().trim();
    }

    private static String fmtAddresses(CenterAccreditationDtos r) {
        if (r.getTrainingSiteAddresses() == null || r.getTrainingSiteAddresses().isEmpty()) return "";
        return r.getTrainingSiteAddresses().stream()
                .filter(a -> !a.isArchived())
                .map(a -> {
                    StringBuilder sb = new StringBuilder();
                    if (a.getStreet() != null && !a.getStreet().isBlank()) sb.append(a.getStreet().trim());
                    if (a.getNumber() != null && !a.getNumber().isBlank()) sb.append(" ").append(a.getNumber().trim());
                    if (a.getPostalCode() != null && !a.getPostalCode().isBlank()) { if (!sb.isEmpty()) sb.append(", "); sb.append(a.getPostalCode().trim()); }
                    if (a.getCity() != null && !a.getCity().isBlank()) sb.append(" ").append(a.getCity().trim());
                    return sb.toString().trim();
                })
                .filter(s -> !s.isBlank())
                .collect(Collectors.joining(" | "));
    }

    private static String fmtContacts(CenterAccreditationDtos r) {
        if (r.getContactPeople() == null || r.getContactPeople().isEmpty()) return "";
        return r.getContactPeople().stream()
                .filter(c -> !c.isArchived())
                .map(c -> {
                    String name = List.of(nvl(c.getFirstName()), nvl(c.getLastName())).stream()
                            .filter(s -> !s.isBlank()).collect(Collectors.joining(" "));
                    return name.isBlank() ? nvl(c.getEmail()) : name;
                })
                .filter(s -> !s.isBlank())
                .collect(Collectors.joining(", "));
    }

    private Map<Long, String> buildSectorMap() {
        return sectorService.findAll().stream()
                .filter(s -> s.getId() != null)
                .collect(Collectors.toMap(SectorDtos::getId, s -> nvl(s.getName())));
    }

    private Map<Long, String> buildOrganismMap() {
        return organismService.findAll().stream()
                .filter(o -> o.getId() != null)
                .collect(Collectors.toMap(OrganismDtos::getId, o -> nvl(o.getName())));
    }

    private Map<Long, String> buildPilotCenterMap() {
        return pilotCenterService.findAll().stream()
                .filter(pc -> pc.getId() != null)
                .collect(Collectors.toMap(PilotCenterDtos::getId, pc -> nvl(pc.getName())));
    }

    private static String joinNames(Set<Long> ids, Map<Long, String> nameMap) {
        if (ids == null || ids.isEmpty()) return "";
        return ids.stream()
                .map(id -> nameMap.getOrDefault(id, "#" + id))
                .collect(Collectors.joining(", "));
    }

    private static String joinSet(Set<String> labels) {
        if (labels == null || labels.isEmpty()) return "";
        return labels.stream().sorted().collect(Collectors.joining(", "));
    }

    private static String taTypeLabel(TrainingAccreditationDtos r) {
        if (r.getType() == null) return "";
        return switch (r.getType()) {
            case SUB_MODULES -> "Sous-modules";
            default          -> "Complet";
        };
    }

    private static String fmtActivityAddress(TrainingActivityDtos r) {
        StringBuilder sb = new StringBuilder();
        if (r.getStreet() != null && !r.getStreet().isBlank()) sb.append(r.getStreet().trim());
        if (r.getNumber() != null && !r.getNumber().isBlank()) sb.append(" ").append(r.getNumber().trim());
        if (r.getPostalCode() != null && !r.getPostalCode().isBlank()) {
            if (!sb.isEmpty()) sb.append(", ");
            sb.append(r.getPostalCode().trim());
        }
        if (r.getVille() != null && !r.getVille().isBlank()) sb.append(" ").append(r.getVille().trim());
        if (r.getProvince() != null && !r.getProvince().isBlank()) sb.append(" (").append(r.getProvince().trim()).append(")");
        return sb.toString().trim();
    }

    private static void addHeader(PdfPTable table, String text) {
        PdfPCell c = new PdfPCell();
        c.setPhrase(new com.lowagie.text.Phrase(text, new Font(Font.HELVETICA, 10, Font.BOLD)));
        table.addCell(c);
    }

    private static String nvl(String s) {
        return s == null ? "" : s;
    }

    private static String csv(String value) {
        String v = value == null ? "" : value;
        boolean mustQuote = v.contains(",") || v.contains("\n") || v.contains("\r") || v.contains("\"");
        v = v.replace("\"", "\"\"");
        return mustQuote ? "\"" + v + "\"" : v;
    }

    private static String fmt(Instant i) {
        if (i == null) return "";
        return DT.format(i);
    }

    private static String fmtLd(LocalDate d) {
        if (d == null) return "";
        return d.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }

    private static String fmtOdt(java.time.OffsetDateTime dt) {
        if (dt == null) return "";
        return DT.format(dt.toInstant());
    }

    private static byte[] withBom(StringBuilder sb) {
        byte[] bom = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
        byte[] body = sb.toString().getBytes(StandardCharsets.UTF_8);
        byte[] out = new byte[bom.length + body.length];
        System.arraycopy(bom, 0, out, 0, bom.length);
        System.arraycopy(body, 0, out, bom.length, body.length);
        return out;
    }
}
