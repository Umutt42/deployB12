package com.b12.export;

import com.b12.web.dto.MonthlyStatDto;
import com.b12.web.dto.NamedStatDto;
import com.b12.web.dto.ProvinceStatDto;
import com.b12.web.dto.StatsDto;
import com.lowagie.text.*;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.jfree.chart.ChartFactory;
import org.jfree.chart.JFreeChart;
import org.jfree.chart.axis.CategoryAxis;
import org.jfree.chart.axis.NumberAxis;
import org.jfree.chart.labels.StandardPieSectionLabelGenerator;
import org.jfree.chart.plot.CategoryPlot;
import org.jfree.chart.plot.PiePlot;
import org.jfree.chart.plot.PlotOrientation;
import org.jfree.chart.renderer.category.BarRenderer;
import org.jfree.data.category.DefaultCategoryDataset;
import org.jfree.data.general.DefaultPieDataset;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Service
public class ChartExportService {

    private static final String[] MONTH_LABELS = {
        "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
        "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"
    };

    private static final Color COLOR_BLUE    = new Color(0x3B, 0x82, 0xF6);
    private static final Color COLOR_GREEN   = new Color(0x22, 0xC5, 0x5E);
    private static final Color COLOR_YELLOW  = new Color(0xF5, 0x9E, 0x0B);
    private static final Color COLOR_RED     = new Color(0xEF, 0x44, 0x44);
    private static final Color COLOR_BG      = Color.WHITE;

    public byte[] exportChartsPdf(StatsDto stats) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4, 40, 40, 50, 50);
            PdfWriter.getInstance(doc, out);
            doc.open();

            // ── En-tête ───────────────────────────────────────────────
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, new Color(0x1E, 0x3A, 0x5F));
            Font subtitleFont = FontFactory.getFont(FontFactory.HELVETICA, 10, new Color(0x6B, 0x72, 0x80));

            Paragraph title = new Paragraph("Rapport Graphique — Statistiques", titleFont);
            title.setAlignment(Element.ALIGN_CENTER);
            doc.add(title);

            Paragraph subtitle = new Paragraph(
                "Généré le " + LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")),
                subtitleFont
            );
            subtitle.setAlignment(Element.ALIGN_CENTER);
            subtitle.setSpacingAfter(20);
            doc.add(subtitle);

            // ── Tableau de synthèse ───────────────────────────────────
            doc.add(sectionTitle("Synthèse des agréments"));
            doc.add(summaryTable(stats));
            doc.add(new Paragraph(" "));

            // ── Graphique 1 : Activités mensuelles (barres) ───────────
            doc.add(sectionTitle("Activités de formation — 12 derniers mois"));
            doc.add(barChartImage(stats));
            doc.add(new Paragraph(" "));

            // ── Graphique 2 : Actifs vs Archivés (barres groupées) ───
            doc.add(sectionTitle("Actifs vs Archivés"));
            doc.add(groupedBarChartImage(stats));
            doc.add(new Paragraph(" "));

            // ── Graphiques 3 & 4 : Camemberts côte à côte ────────────
            doc.add(sectionTitle("Répartition des statuts"));
            doc.add(pieChartsElement(stats));
            doc.add(new Paragraph(" "));

            // ── Graphique 5 : Activités par province ──────────────────
            if (!stats.activitiesByProvince().isEmpty()) {
                doc.add(sectionTitle("Activités de formation par province"));
                doc.add(provinceBarChartImage(stats));
                doc.add(new Paragraph(" "));
            }

            // ── Nouvelle page ─────────────────────────────────────────
            doc.newPage();

            // ── Tableau alertes — agréments centres ───────────────────
            doc.add(sectionTitle("Alertes — Expirations d'agréments centres"));
            doc.add(alertTableCa(stats));
            doc.add(new Paragraph(" "));

            // ── Tableau alertes — agréments formations ────────────────
            doc.add(sectionTitle("Alertes — Expirations d'agréments formations"));
            doc.add(alertTableTa(stats));
            doc.add(new Paragraph(" "));

            // ── Tableau données de référence ──────────────────────────
            doc.add(sectionTitle("Données de référence"));
            doc.add(referenceTable(stats));

            // ── Nouvelle page — Analyses complémentaires ──────────────
            doc.newPage();

            // ── Graphique : Activités par type de phytolicence ────────
            if (!stats.activitiesByLicenseType().isEmpty()) {
                doc.add(sectionTitle("Activités par type de phytolicence"));
                doc.add(namedBarChartImage(stats.activitiesByLicenseType(), new Color(0x7C, 0x3A, 0xED)));
                doc.add(new Paragraph(" "));
            }

            // ── Graphique : Activités par thématique ──────────────────
            if (!stats.activitiesByTheme().isEmpty()) {
                doc.add(sectionTitle("Activités par thématique"));
                doc.add(namedBarChartImage(stats.activitiesByTheme(), new Color(0xD9, 0x77, 0x06)));
                doc.add(new Paragraph(" "));
            }

            // ── Graphique : Top 10 formateurs ─────────────────────────
            if (!stats.topTrainers().isEmpty()) {
                doc.add(sectionTitle("Top 10 formateur·trices les plus actif·ves"));
                doc.add(namedBarChartImage(stats.topTrainers(), new Color(0x0D, 0x94, 0x88)));
                doc.add(new Paragraph(" "));
            }

            // ── Graphique : Agréments de formation par centre ─────────
            if (!stats.trainingAccreditationsByCenter().isEmpty()) {
                doc.add(sectionTitle("Agréments de formation par centre (top 15)"));
                doc.add(namedBarChartImage(stats.trainingAccreditationsByCenter(), new Color(0xEA, 0x58, 0x0C)));
                doc.add(new Paragraph(" "));
            }

            // ── Nouvelle page — Évolution & KPIs ──────────────────────
            doc.newPage();

            // ── Graphiques : Évolution des agréments 12 mois ─────────
            doc.add(sectionTitle("Évolution des agréments — 12 derniers mois"));
            doc.add(monthlyTrendChartsElement(stats));
            doc.add(new Paragraph(" "));

            // ── Tableau : Délai moyen de traitement ───────────────────
            doc.add(sectionTitle("Délai moyen de traitement (réception → début agrément)"));
            doc.add(processingTimeTable(stats));
            doc.add(new Paragraph(" "));

            // ── Graphique : Activités par secteur ─────────────────────
            if (!stats.activitiesBySector().isEmpty()) {
                doc.add(sectionTitle("Activités de formation par secteur"));
                doc.add(namedBarChartImage(stats.activitiesBySector(), new Color(0x47, 0x55, 0x69)));
                doc.add(new Paragraph(" "));
            }

            doc.close();
            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Erreur génération PDF graphiques", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers PDF
    // ─────────────────────────────────────────────────────────────────────────

    private Paragraph sectionTitle(String text) {
        Font f = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, new Color(0x1E, 0x3A, 0x5F));
        Paragraph p = new Paragraph(text, f);
        p.setSpacingBefore(12);
        p.setSpacingAfter(6);
        return p;
    }

    private PdfPTable summaryTable(StatsDto stats) throws DocumentException {
        PdfPTable table = new PdfPTable(3);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{2.5f, 1.5f, 1.5f});

        Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);
        Font cellFont   = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.DARK_GRAY);

        Color headerBg = new Color(0x1E, 0x3A, 0x5F);
        addTableHeader(table, new String[]{"Indicateur", "Actifs", "Archivés"}, headerFont, headerBg);

        addTableRow(table, "Centres de formation",
            String.valueOf(stats.trainingCentersActive()),
            String.valueOf(stats.trainingCentersArchived()), cellFont);
        addTableRow(table, "Agréments centres",
            String.valueOf(stats.centerAccreditationsActive()),
            String.valueOf(stats.centerAccreditationsArchived()), cellFont);
        addTableRow(table, "Agréments formations",
            String.valueOf(stats.trainingAccreditationsActive()),
            String.valueOf(stats.trainingAccreditationsArchived()), cellFont);
        addTableRow(table, "Formateur·trices",
            String.valueOf(stats.trainersActive()),
            String.valueOf(stats.trainersArchived()), cellFont);

        return table;
    }

    private void addTableHeader(PdfPTable table, String[] headers, Font font, Color bg) {
        for (String h : headers) {
            PdfPCell cell = new PdfPCell(new Phrase(h, font));
            cell.setBackgroundColor(bg);
            cell.setPadding(6);
            cell.setBorderColor(Color.LIGHT_GRAY);
            table.addCell(cell);
        }
    }

    private void addRefRow(PdfPTable table, String label, long val, Font font) {
        PdfPCell c1 = new PdfPCell(new Phrase(label, font));
        PdfPCell c2 = new PdfPCell(new Phrase(String.valueOf(val), font));
        c2.setHorizontalAlignment(Element.ALIGN_CENTER);
        for (PdfPCell c : new PdfPCell[]{c1, c2}) {
            c.setPadding(5);
            c.setBorderColor(Color.LIGHT_GRAY);
            table.addCell(c);
        }
    }

    private void addTableRow(PdfPTable table, String label, String val1, String val2, Font font) {
        PdfPCell c1 = new PdfPCell(new Phrase(label, font));
        PdfPCell c2 = new PdfPCell(new Phrase(val1, font));
        PdfPCell c3 = new PdfPCell(new Phrase(val2, font));
        c2.setHorizontalAlignment(Element.ALIGN_CENTER);
        c3.setHorizontalAlignment(Element.ALIGN_CENTER);
        for (PdfPCell c : new PdfPCell[]{c1, c2, c3}) {
            c.setPadding(5);
            c.setBorderColor(Color.LIGHT_GRAY);
            table.addCell(c);
        }
    }

    private PdfPTable alertTableCa(StatsDto stats) throws DocumentException {
        return buildAlertTable(
            stats.centerAccreditationsExpiringIn30Days(),
            stats.centerAccreditationsExpiringIn60Days(),
            "Agréments centres"
        );
    }

    private PdfPTable alertTableTa(StatsDto stats) throws DocumentException {
        return buildAlertTable(
            stats.trainingAccreditationsExpiringIn30Days(),
            stats.trainingAccreditationsExpiringIn60Days(),
            "Agréments formations"
        );
    }

    private PdfPTable buildAlertTable(long exp30, long exp60, String label) throws DocumentException {
        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{3f, 1.5f});

        Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);
        Font cellFont   = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.DARK_GRAY);
        Font warnFont   = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, COLOR_RED);
        Font okFont     = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, COLOR_GREEN);

        addTableHeader(table, new String[]{"Indicateur", "Nombre"}, headerFont, new Color(0x1E, 0x3A, 0x5F));

        PdfPCell l30 = new PdfPCell(new Phrase(label + " expirant dans les 30 jours", cellFont));
        PdfPCell v30 = new PdfPCell(new Phrase(String.valueOf(exp30), exp30 > 0 ? warnFont : okFont));
        PdfPCell l60 = new PdfPCell(new Phrase(label + " expirant dans les 60 jours", cellFont));
        PdfPCell v60 = new PdfPCell(new Phrase(String.valueOf(exp60), exp60 > 0 ? warnFont : okFont));
        for (PdfPCell c : new PdfPCell[]{l30, v30, l60, v60}) {
            c.setPadding(5); c.setBorderColor(Color.LIGHT_GRAY);
        }
        v30.setHorizontalAlignment(Element.ALIGN_CENTER);
        v60.setHorizontalAlignment(Element.ALIGN_CENTER);
        table.addCell(l30); table.addCell(v30);
        table.addCell(l60); table.addCell(v60);
        return table;
    }

    private PdfPTable referenceTable(StatsDto stats) throws DocumentException {
        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(60);
        table.setWidths(new float[]{3f, 1.5f});

        Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);
        Font cellFont   = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.DARK_GRAY);

        addTableHeader(table, new String[]{"Référentiel", "Total actifs"}, headerFont, new Color(0x1E, 0x3A, 0x5F));
        addRefRow(table, "Thématiques",            stats.themesTotal(),       cellFont);
        addRefRow(table, "Types de phytolicences", stats.licenseTypesTotal(), cellFont);
        addRefRow(table, "Secteurs",               stats.sectorsTotal(),      cellFont);
        addRefRow(table, "Organismes",             stats.organismsTotal(),    cellFont);
        addRefRow(table, "Centres pilotes",        stats.pilotCentersTotal(), cellFont);
        return table;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Graphiques JFreeChart
    // ─────────────────────────────────────────────────────────────────────────

    private Image barChartImage(StatsDto stats) throws DocumentException, IOException {
        DefaultCategoryDataset dataset = new DefaultCategoryDataset();
        for (MonthlyStatDto m : stats.activitiesLast12Months()) {
            String label = MONTH_LABELS[m.month() - 1] + "\n" + m.year();
            dataset.addValue(m.count(), "Activités", label);
        }

        JFreeChart chart = ChartFactory.createBarChart(
            null, null, "Nombre d'activités",
            dataset, PlotOrientation.VERTICAL, false, false, false
        );

        // Style
        chart.setBackgroundPaint(COLOR_BG);
        CategoryPlot plot = chart.getCategoryPlot();
        plot.setBackgroundPaint(COLOR_BG);
        plot.setRangeGridlinePaint(new Color(0xE5, 0xE7, 0xEB));
        plot.setOutlineVisible(false);

        BarRenderer renderer = (BarRenderer) plot.getRenderer();
        renderer.setSeriesPaint(0, COLOR_BLUE);
        renderer.setShadowVisible(false);
        renderer.setMaximumBarWidth(0.06);

        CategoryAxis xAxis = plot.getDomainAxis();
        xAxis.setTickLabelFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 8));
        xAxis.setCategoryMargin(0.2);

        NumberAxis yAxis = (NumberAxis) plot.getRangeAxis();
        yAxis.setStandardTickUnits(NumberAxis.createIntegerTickUnits());
        yAxis.setTickLabelFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 9));

        return toImage(chart, 520, 230);
    }

    private Image groupedBarChartImage(StatsDto stats) throws DocumentException, IOException {
        DefaultCategoryDataset dataset = new DefaultCategoryDataset();
        dataset.addValue(stats.trainingCentersActive(),        "Actifs",    "Centres formation");
        dataset.addValue(stats.trainingCentersArchived(),      "Archivés",  "Centres formation");
        dataset.addValue(stats.centerAccreditationsActive(),   "Actifs",    "Agréments centres");
        dataset.addValue(stats.centerAccreditationsArchived(), "Archivés",  "Agréments centres");
        dataset.addValue(stats.trainingAccreditationsActive(), "Actifs",    "Agréments formations");
        dataset.addValue(stats.trainingAccreditationsArchived(), "Archivés","Agréments formations");
        dataset.addValue(stats.trainersActive(),               "Actifs",    "Formateur·trices");
        dataset.addValue(stats.trainersArchived(),             "Archivés",  "Formateur·trices");

        JFreeChart chart = ChartFactory.createBarChart(
            null, null, "Nombre",
            dataset, PlotOrientation.VERTICAL, true, false, false
        );

        chart.setBackgroundPaint(COLOR_BG);
        CategoryPlot plot = chart.getCategoryPlot();
        plot.setBackgroundPaint(COLOR_BG);
        plot.setRangeGridlinePaint(new Color(0xE5, 0xE7, 0xEB));
        plot.setOutlineVisible(false);

        BarRenderer renderer = (BarRenderer) plot.getRenderer();
        renderer.setSeriesPaint(0, COLOR_BLUE);
        renderer.setSeriesPaint(1, new Color(0xD1, 0xD5, 0xDB));
        renderer.setShadowVisible(false);

        plot.getDomainAxis().setTickLabelFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 9));
        NumberAxis yAxis = (NumberAxis) plot.getRangeAxis();
        yAxis.setStandardTickUnits(NumberAxis.createIntegerTickUnits());
        yAxis.setTickLabelFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 9));

        return toImage(chart, 520, 220);
    }

    private Image provinceBarChartImage(StatsDto stats) throws DocumentException, IOException {
        DefaultCategoryDataset dataset = new DefaultCategoryDataset();
        for (ProvinceStatDto p : stats.activitiesByProvince()) {
            String label = p.province() != null && !p.province().isBlank() ? p.province() : "Non renseignée";
            dataset.addValue(p.count(), "Activités", label);
        }

        JFreeChart chart = ChartFactory.createBarChart(
            null, null, "Nombre d'activités",
            dataset, PlotOrientation.HORIZONTAL, false, false, false
        );

        chart.setBackgroundPaint(COLOR_BG);
        CategoryPlot plot = chart.getCategoryPlot();
        plot.setBackgroundPaint(COLOR_BG);
        plot.setRangeGridlinePaint(new Color(0xE5, 0xE7, 0xEB));
        plot.setOutlineVisible(false);

        BarRenderer renderer = (BarRenderer) plot.getRenderer();
        renderer.setSeriesPaint(0, new Color(0x63, 0x66, 0xF1));
        renderer.setShadowVisible(false);
        renderer.setMaximumBarWidth(0.15);

        plot.getDomainAxis().setTickLabelFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 9));
        NumberAxis xAxis = (NumberAxis) plot.getRangeAxis();
        xAxis.setStandardTickUnits(NumberAxis.createIntegerTickUnits());
        xAxis.setTickLabelFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 9));

        int height = Math.max(150, stats.activitiesByProvince().size() * 30 + 50);
        return toImage(chart, 520, Math.min(height, 350));
    }

    private Element pieChartsElement(StatsDto stats) throws DocumentException, IOException {
        DefaultPieDataset<String> dsCa = new DefaultPieDataset<>();
        if (stats.caAccepted() > 0) dsCa.setValue("Accepté",   stats.caAccepted());
        if (stats.caPending() > 0)  dsCa.setValue("En attente", stats.caPending());
        if (stats.caReceived() > 0) dsCa.setValue("Reçu",       stats.caReceived());
        if (stats.caRefused() > 0)  dsCa.setValue("Refusé",     stats.caRefused());

        DefaultPieDataset<String> dsTa = new DefaultPieDataset<>();
        if (stats.taAccepted() > 0) dsTa.setValue("Accepté",   stats.taAccepted());
        if (stats.taPending() > 0)  dsTa.setValue("En attente", stats.taPending());
        if (stats.taReceived() > 0) dsTa.setValue("Reçu",       stats.taReceived());
        if (stats.taRefused() > 0)  dsTa.setValue("Refusé",     stats.taRefused());

        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100);

        Image imgCa = toImage(buildPieChart("Agréments centres", dsCa), 250, 200);
        Image imgTa = toImage(buildPieChart("Agréments formations", dsTa), 250, 200);

        PdfPCell cellCa = new PdfPCell(imgCa, true);
        PdfPCell cellTa = new PdfPCell(imgTa, true);
        cellCa.setBorder(com.lowagie.text.Rectangle.NO_BORDER);
        cellTa.setBorder(com.lowagie.text.Rectangle.NO_BORDER);
        cellCa.setHorizontalAlignment(Element.ALIGN_CENTER);
        cellTa.setHorizontalAlignment(Element.ALIGN_CENTER);

        table.addCell(cellCa);
        table.addCell(cellTa);
        return table;
    }

    private JFreeChart buildPieChart(String titleText, DefaultPieDataset<String> dataset) {
        JFreeChart chart = ChartFactory.createPieChart(titleText, dataset, true, false, false);
        chart.setBackgroundPaint(COLOR_BG);
        chart.getTitle().setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 11));

        PiePlot<?> plot = (PiePlot<?>) chart.getPlot();
        plot.setBackgroundPaint(COLOR_BG);
        plot.setOutlineVisible(false);
        plot.setSectionPaint("Accepté",   COLOR_GREEN);
        plot.setSectionPaint("En attente", COLOR_YELLOW);
        plot.setSectionPaint("Reçu",       COLOR_BLUE);
        plot.setSectionPaint("Refusé",     COLOR_RED);
        plot.setLabelGenerator(new StandardPieSectionLabelGenerator(
            "{0}: {1} ({2})",
            new java.text.DecimalFormat("0"),
            new java.text.DecimalFormat("0.0%")
        ));
        plot.setLabelFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 9));
        plot.setLabelBackgroundPaint(new Color(255, 255, 255, 200));

        return chart;
    }

    private Image toImage(JFreeChart chart, int width, int height) throws DocumentException, IOException {
        BufferedImage bi = chart.createBufferedImage(width, height);
        ByteArrayOutputStream imgOut = new ByteArrayOutputStream();
        ImageIO.write(bi, "PNG", imgOut);
        Image img = Image.getInstance(imgOut.toByteArray());
        img.setAlignment(Element.ALIGN_CENTER);
        return img;
    }

    private Image namedBarChartImage(java.util.List<NamedStatDto> items, Color color)
            throws DocumentException, IOException {
        DefaultCategoryDataset dataset = new DefaultCategoryDataset();
        for (NamedStatDto item : items) {
            String label = item.name() != null && !item.name().isBlank() ? item.name() : "—";
            dataset.addValue(item.count(), "Nombre", label);
        }

        JFreeChart chart = ChartFactory.createBarChart(
            null, null, "Nombre",
            dataset, PlotOrientation.HORIZONTAL, false, false, false
        );

        chart.setBackgroundPaint(COLOR_BG);
        CategoryPlot plot = chart.getCategoryPlot();
        plot.setBackgroundPaint(COLOR_BG);
        plot.setRangeGridlinePaint(new Color(0xE5, 0xE7, 0xEB));
        plot.setOutlineVisible(false);

        BarRenderer renderer = (BarRenderer) plot.getRenderer();
        renderer.setSeriesPaint(0, color);
        renderer.setShadowVisible(false);
        renderer.setMaximumBarWidth(0.12);

        plot.getDomainAxis().setTickLabelFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 8));
        NumberAxis xAxis = (NumberAxis) plot.getRangeAxis();
        xAxis.setStandardTickUnits(NumberAxis.createIntegerTickUnits());
        xAxis.setTickLabelFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 9));

        int height = Math.max(150, items.size() * 28 + 50);
        return toImage(chart, 520, Math.min(height, 380));
    }

    private Element monthlyTrendChartsElement(StatsDto stats) throws DocumentException, IOException {
        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100);

        Image imgCa = monthlyBarChartImage(
            stats.centerAccreditationsLast12Months(),
            "Agréments centres",
            new Color(0x63, 0x66, 0xF1)
        );
        Image imgTa = monthlyBarChartImage(
            stats.trainingAccreditationsLast12Months(),
            "Agréments formations",
            new Color(0xA8, 0x55, 0xF7)
        );

        PdfPCell cellCa = new PdfPCell(imgCa, true);
        PdfPCell cellTa = new PdfPCell(imgTa, true);
        cellCa.setBorder(com.lowagie.text.Rectangle.NO_BORDER);
        cellTa.setBorder(com.lowagie.text.Rectangle.NO_BORDER);
        cellCa.setHorizontalAlignment(Element.ALIGN_CENTER);
        cellTa.setHorizontalAlignment(Element.ALIGN_CENTER);

        table.addCell(cellCa);
        table.addCell(cellTa);
        return table;
    }

    private Image monthlyBarChartImage(java.util.List<MonthlyStatDto> months, String seriesLabel, Color color)
            throws DocumentException, IOException {
        DefaultCategoryDataset dataset = new DefaultCategoryDataset();
        for (MonthlyStatDto m : months) {
            String label = MONTH_LABELS[m.month() - 1] + "\n" + m.year();
            dataset.addValue(m.count(), seriesLabel, label);
        }

        JFreeChart chart = ChartFactory.createBarChart(
            seriesLabel, null, "Nombre",
            dataset, PlotOrientation.VERTICAL, false, false, false
        );

        chart.setBackgroundPaint(COLOR_BG);
        chart.getTitle().setFont(new java.awt.Font("SansSerif", java.awt.Font.BOLD, 10));
        CategoryPlot plot = chart.getCategoryPlot();
        plot.setBackgroundPaint(COLOR_BG);
        plot.setRangeGridlinePaint(new Color(0xE5, 0xE7, 0xEB));
        plot.setOutlineVisible(false);

        BarRenderer renderer = (BarRenderer) plot.getRenderer();
        renderer.setSeriesPaint(0, color);
        renderer.setShadowVisible(false);
        renderer.setMaximumBarWidth(0.08);

        plot.getDomainAxis().setTickLabelFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 7));
        NumberAxis yAxis = (NumberAxis) plot.getRangeAxis();
        yAxis.setStandardTickUnits(NumberAxis.createIntegerTickUnits());
        yAxis.setTickLabelFont(new java.awt.Font("SansSerif", java.awt.Font.PLAIN, 8));

        return toImage(chart, 255, 200);
    }

    private PdfPTable processingTimeTable(StatsDto stats) throws DocumentException {
        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(70);
        table.setWidths(new float[]{3f, 2f});

        Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);
        Font cellFont   = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.DARK_GRAY);
        Font valueFont  = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, new Color(0x1E, 0x3A, 0x5F));

        addTableHeader(table, new String[]{"Type d'agrément", "Délai moyen (jours)"}, headerFont, new Color(0x1E, 0x3A, 0x5F));

        String caDays = stats.avgProcessingDaysCa() == 0
            ? "N/A"
            : String.format("%.0f j", stats.avgProcessingDaysCa());
        String taDays = stats.avgProcessingDaysTa() == 0
            ? "N/A"
            : String.format("%.0f j", stats.avgProcessingDaysTa());

        PdfPCell lCa = new PdfPCell(new Phrase("Agrément centre (réception → début)", cellFont));
        PdfPCell vCa = new PdfPCell(new Phrase(caDays, valueFont));
        PdfPCell lTa = new PdfPCell(new Phrase("Agrément formation (réception → début)", cellFont));
        PdfPCell vTa = new PdfPCell(new Phrase(taDays, valueFont));

        for (PdfPCell c : new PdfPCell[]{lCa, vCa, lTa, vTa}) {
            c.setPadding(6);
            c.setBorderColor(Color.LIGHT_GRAY);
        }
        vCa.setHorizontalAlignment(Element.ALIGN_CENTER);
        vTa.setHorizontalAlignment(Element.ALIGN_CENTER);

        table.addCell(lCa); table.addCell(vCa);
        table.addCell(lTa); table.addCell(vTa);
        return table;
    }
}
