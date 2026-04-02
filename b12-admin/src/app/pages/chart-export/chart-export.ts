import { Component, OnInit, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { StatsApi, StatsDto, MonthlyStatDto, ProvinceStatDto, NamedStatDto } from '../../api/stats.api';
import { ChartExportApi } from '../../api/chart-export.api';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-chart-export',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './chart-export.html',
  styleUrl: './chart-export.css',
})
export class ChartExport implements OnInit {
  stats: StatsDto | null = null;
  loading = true;
  exporting = false;
  error: string | null = null;

  private statsApi = inject(StatsApi);
  private chartApi = inject(ChartExportApi);
  private toast    = inject(ToastService);

  ngOnInit(): void {
    this.statsApi.get().subscribe({
      next:  (s) => { this.stats = s; this.loading = false; },
      error: ()  => { this.error = 'Impossible de charger les statistiques.'; this.loading = false; },
    });
  }

  exportXlsx(): void {
    if (!this.stats) return;
    const s = this.stats;
    const today = new Date().toISOString().slice(0, 10);
    const esc = (v: any) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const border = (c = '#e2e8f0', w = 1) => `<Borders>${['Top','Bottom','Left','Right'].map(p=>`<Border ss:Position="${p}" ss:LineStyle="Continuous" ss:Weight="${w}" ss:Color="${c}"/>`).join('')}</Borders>`;

    const styles = `<Styles>
      <Style ss:ID="title"><Font ss:Bold="1" ss:Size="14" ss:Color="#1e293b" ss:FontName="Arial"/><Alignment ss:Vertical="Center"/></Style>
      <Style ss:ID="hdr"><Font ss:Bold="1" ss:Size="10" ss:Color="#FFFFFF" ss:FontName="Arial"/><Interior ss:Color="#1e3a5f" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/>${border('#0f2744')}</Style>
      <Style ss:ID="name"><Font ss:Size="10" ss:Color="#1e293b" ss:FontName="Arial"/><Alignment ss:Vertical="Center"/>${border()}</Style>
      <Style ss:ID="nameZ"><Font ss:Size="10" ss:Color="#1e293b" ss:FontName="Arial"/><Interior ss:Color="#f8fafc" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/>${border()}</Style>
      <Style ss:ID="num"><Font ss:Size="10" ss:Color="#1e293b" ss:FontName="Arial"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/>${border()}</Style>
      <Style ss:ID="numZ"><Font ss:Size="10" ss:Color="#1e293b" ss:FontName="Arial"/><Interior ss:Color="#f8fafc" ss:Pattern="Solid"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/>${border()}</Style>
      <Style ss:ID="tot"><Font ss:Bold="1" ss:Size="10" ss:FontName="Arial"/><Interior ss:Color="#dbeafe" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/>${border('#93c5fd',2)}</Style>
      <Style ss:ID="totN"><Font ss:Bold="1" ss:Size="10" ss:FontName="Arial"/><Interior ss:Color="#dbeafe" ss:Pattern="Solid"/><Alignment ss:Horizontal="Right" ss:Vertical="Center"/>${border('#93c5fd',2)}</Style>
    </Styles>`;

    // helper: feuille label/count
    const namedSheet = (name: string, col: string, rows: {name:string;count:number}[]) => {
      const dataRows = rows.map((r,i) => {
        const z = i%2===1;
        return `<Row ss:Height="18"><Cell ss:StyleID="${z?'nameZ':'name'}"><Data ss:Type="String">${esc(r.name)}</Data></Cell><Cell ss:StyleID="${z?'numZ':'num'}"><Data ss:Type="Number">${r.count}</Data></Cell></Row>`;
      }).join('');
      const total = rows.reduce((s,r)=>s+r.count,0);
      return `<Worksheet ss:Name="${esc(name)}"><Table ss:DefaultRowHeight="18">
        <Column ss:Width="220"/><Column ss:Width="100"/>
        <Row ss:Height="28"><Cell ss:StyleID="title" ss:MergeAcross="1"><Data ss:Type="String">${esc(name)}</Data></Cell></Row>
        <Row ss:Height="8"><Cell/></Row>
        <Row ss:Height="22"><Cell ss:StyleID="hdr"><Data ss:Type="String">${esc(col)}</Data></Cell><Cell ss:StyleID="hdr"><Data ss:Type="String">Nb formations</Data></Cell></Row>
        ${dataRows}
        <Row ss:Height="20"><Cell ss:StyleID="tot"><Data ss:Type="String">TOTAL</Data></Cell><Cell ss:StyleID="totN"><Data ss:Type="Number">${total}</Data></Cell></Row>
      </Table></Worksheet>`;
    };

    // helper: feuille mensuelle
    const monthlySheet = (name: string, col: string, rows: MonthlyStatDto[]) => {
      const dataRows = rows.map((r,i) => {
        const z = i%2===1; const lbl = this.monthLabel(r);
        return `<Row ss:Height="18"><Cell ss:StyleID="${z?'nameZ':'name'}"><Data ss:Type="String">${esc(lbl)}</Data></Cell><Cell ss:StyleID="${z?'numZ':'num'}"><Data ss:Type="Number">${r.count}</Data></Cell></Row>`;
      }).join('');
      const total = rows.reduce((s,r)=>s+r.count,0);
      return `<Worksheet ss:Name="${esc(name)}"><Table ss:DefaultRowHeight="18">
        <Column ss:Width="120"/><Column ss:Width="100"/>
        <Row ss:Height="28"><Cell ss:StyleID="title" ss:MergeAcross="1"><Data ss:Type="String">${esc(name)}</Data></Cell></Row>
        <Row ss:Height="8"><Cell/></Row>
        <Row ss:Height="22"><Cell ss:StyleID="hdr"><Data ss:Type="String">${esc(col)}</Data></Cell><Cell ss:StyleID="hdr"><Data ss:Type="String">Nb</Data></Cell></Row>
        ${dataRows}
        <Row ss:Height="20"><Cell ss:StyleID="tot"><Data ss:Type="String">TOTAL</Data></Cell><Cell ss:StyleID="totN"><Data ss:Type="Number">${total}</Data></Cell></Row>
      </Table></Worksheet>`;
    };

    // Feuille 1 — Vue d'ensemble (KPIs)
    const kpiRows = [
      ['Centres de formation — actifs', s.trainingCentersActive],
      ['Centres de formation — archivés', s.trainingCentersArchived],
      ['Agréments centres — actifs', s.centerAccreditationsActive],
      ['Agréments centres — archivés', s.centerAccreditationsArchived],
      ['Agréments centres — expirant 30j', s.centerAccreditationsExpiringIn30Days],
      ['Agréments centres — expirant 60j', s.centerAccreditationsExpiringIn60Days],
      ['Agréments formations — actifs', s.trainingAccreditationsActive],
      ['Agréments formations — archivés', s.trainingAccreditationsArchived],
      ['Agréments formations — expirant 30j', s.trainingAccreditationsExpiringIn30Days],
      ['Agréments formations — expirant 60j', s.trainingAccreditationsExpiringIn60Days],
      ['Formateur·trices — actifs', s.trainersActive],
      ['Formateur·trices — archivés', s.trainersArchived],
      ['Activités de formation — année en cours', s.activitiesThisYear],
      ['Activités de formation — total', s.activitiesTotal],
      ['Thématiques', s.themesTotal],
      ['Types de phytolicences', s.licenseTypesTotal],
      ['Secteurs', s.sectorsTotal],
      ['Organismes', s.organismsTotal],
      ['Centres pilotes', s.pilotCentersTotal],
    ];
    const kpiDataRows = kpiRows.map(([label,val],i) => {
      const z = i%2===1;
      return `<Row ss:Height="18"><Cell ss:StyleID="${z?'nameZ':'name'}"><Data ss:Type="String">${esc(label)}</Data></Cell><Cell ss:StyleID="${z?'numZ':'num'}"><Data ss:Type="Number">${val}</Data></Cell></Row>`;
    }).join('');
    const sheet1 = `<Worksheet ss:Name="Vue d'ensemble"><Table ss:DefaultRowHeight="18">
      <Column ss:Width="280"/><Column ss:Width="100"/>
      <Row ss:Height="28"><Cell ss:StyleID="title" ss:MergeAcross="1"><Data ss:Type="String">Vue d'ensemble — KPIs</Data></Cell></Row>
      <Row ss:Height="8"><Cell/></Row>
      <Row ss:Height="22"><Cell ss:StyleID="hdr"><Data ss:Type="String">Indicateur</Data></Cell><Cell ss:StyleID="hdr"><Data ss:Type="String">Valeur</Data></Cell></Row>
      ${kpiDataRows}
    </Table></Worksheet>`;

    // Feuille 2 — Statuts agréments centres
    const caStatRows = [
      ['Accepté', s.caAccepted], ['En attente', s.caPending], ['Reçu', s.caReceived], ['Refusé', s.caRefused],
    ].map(([l,v],i)=>{const z=i%2===1;return `<Row ss:Height="18"><Cell ss:StyleID="${z?'nameZ':'name'}"><Data ss:Type="String">${l}</Data></Cell><Cell ss:StyleID="${z?'numZ':'num'}"><Data ss:Type="Number">${v}</Data></Cell></Row>`;}).join('');
    const taStatRows = [
      ['Accepté', s.taAccepted], ['En attente', s.taPending], ['Reçu', s.taReceived], ['Refusé', s.taRefused],
    ].map(([l,v],i)=>{const z=i%2===1;return `<Row ss:Height="18"><Cell ss:StyleID="${z?'nameZ':'name'}"><Data ss:Type="String">${l}</Data></Cell><Cell ss:StyleID="${z?'numZ':'num'}"><Data ss:Type="Number">${v}</Data></Cell></Row>`;}).join('');
    const sheet2 = `<Worksheet ss:Name="Statuts agréments"><Table ss:DefaultRowHeight="18">
      <Column ss:Width="200"/><Column ss:Width="100"/>
      <Row ss:Height="28"><Cell ss:StyleID="title" ss:MergeAcross="1"><Data ss:Type="String">Statuts — Agréments centres</Data></Cell></Row>
      <Row ss:Height="8"><Cell/></Row>
      <Row ss:Height="22"><Cell ss:StyleID="hdr"><Data ss:Type="String">Statut</Data></Cell><Cell ss:StyleID="hdr"><Data ss:Type="String">Nb</Data></Cell></Row>
      ${caStatRows}
      <Row ss:Height="20"><Cell ss:StyleID="tot"><Data ss:Type="String">TOTAL</Data></Cell><Cell ss:StyleID="totN"><Data ss:Type="Number">${this.caTotal()}</Data></Cell></Row>
      <Row ss:Height="16"><Cell/></Row>
      <Row ss:Height="28"><Cell ss:StyleID="title" ss:MergeAcross="1"><Data ss:Type="String">Statuts — Agréments formations</Data></Cell></Row>
      <Row ss:Height="8"><Cell/></Row>
      <Row ss:Height="22"><Cell ss:StyleID="hdr"><Data ss:Type="String">Statut</Data></Cell><Cell ss:StyleID="hdr"><Data ss:Type="String">Nb</Data></Cell></Row>
      ${taStatRows}
      <Row ss:Height="20"><Cell ss:StyleID="tot"><Data ss:Type="String">TOTAL</Data></Cell><Cell ss:StyleID="totN"><Data ss:Type="Number">${this.taTotal()}</Data></Cell></Row>
    </Table></Worksheet>`;

    // Feuille 3 — Actifs vs Archivés
    const aaRows = this.activeArchivedRows().map((r,i)=>{const z=i%2===1;return `<Row ss:Height="18">
      <Cell ss:StyleID="${z?'nameZ':'name'}"><Data ss:Type="String">${esc(r.label)}</Data></Cell>
      <Cell ss:StyleID="${z?'numZ':'num'}"><Data ss:Type="Number">${r.active}</Data></Cell>
      <Cell ss:StyleID="${z?'numZ':'num'}"><Data ss:Type="Number">${r.archived}</Data></Cell>
      <Cell ss:StyleID="${z?'numZ':'num'}"><Data ss:Type="String">${r.activePct}%</Data></Cell>
    </Row>`;}).join('');
    const sheet3 = `<Worksheet ss:Name="Actifs vs Archivés"><Table ss:DefaultRowHeight="18">
      <Column ss:Width="220"/><Column ss:Width="80"/><Column ss:Width="80"/><Column ss:Width="80"/>
      <Row ss:Height="28"><Cell ss:StyleID="title" ss:MergeAcross="3"><Data ss:Type="String">Actifs vs Archivés</Data></Cell></Row>
      <Row ss:Height="8"><Cell/></Row>
      <Row ss:Height="22"><Cell ss:StyleID="hdr"><Data ss:Type="String">Entité</Data></Cell><Cell ss:StyleID="hdr"><Data ss:Type="String">Actifs</Data></Cell><Cell ss:StyleID="hdr"><Data ss:Type="String">Archivés</Data></Cell><Cell ss:StyleID="hdr"><Data ss:Type="String">% Actifs</Data></Cell></Row>
      ${aaRows}
    </Table></Worksheet>`;

    // Feuille 4 — Délai moyen traitement
    const sheet4 = `<Worksheet ss:Name="Délai traitement"><Table ss:DefaultRowHeight="18">
      <Column ss:Width="240"/><Column ss:Width="100"/>
      <Row ss:Height="28"><Cell ss:StyleID="title" ss:MergeAcross="1"><Data ss:Type="String">Délai moyen de traitement (réception → début agrément)</Data></Cell></Row>
      <Row ss:Height="8"><Cell/></Row>
      <Row ss:Height="22"><Cell ss:StyleID="hdr"><Data ss:Type="String">Type</Data></Cell><Cell ss:StyleID="hdr"><Data ss:Type="String">Jours moyens</Data></Cell></Row>
      <Row ss:Height="18"><Cell ss:StyleID="name"><Data ss:Type="String">Agrément centre</Data></Cell><Cell ss:StyleID="num"><Data ss:Type="${s.avgProcessingDaysCa>0?'Number':'String'}">${s.avgProcessingDaysCa>0?s.avgProcessingDaysCa:'N/A'}</Data></Cell></Row>
      <Row ss:Height="18"><Cell ss:StyleID="nameZ"><Data ss:Type="String">Agrément formation</Data></Cell><Cell ss:StyleID="numZ"><Data ss:Type="${s.avgProcessingDaysTa>0?'Number':'String'}">${s.avgProcessingDaysTa>0?s.avgProcessingDaysTa:'N/A'}</Data></Cell></Row>
    </Table></Worksheet>`;

    // Feuille 5–12 — données par catégorie
    const sheet5  = namedSheet('Par province',          'Province',            s.activitiesByProvince.map(p=>({name:p.province||'Non renseignée',count:p.count})));
    const sheet6  = namedSheet('Par phytolicence',      'Type phytolicence',   s.activitiesByLicenseType);
    const sheet7  = namedSheet('Par thématique',        'Thématique',          s.activitiesByTheme);
    const sheet8  = namedSheet('Par secteur',           'Secteur',             s.activitiesBySector);
    const sheet9  = namedSheet('Top formateurs',        'Formateur·trice',     s.topTrainers);
    const sheet10 = namedSheet('Par centre (agréments)','Centre',              s.trainingAccreditationsByCenter);
    const sheet11 = monthlySheet('Activités 12 mois',   'Mois',                s.activitiesLast12Months);
    const sheet12 = monthlySheet('Évol. agréments CA',  'Mois',                s.centerAccreditationsLast12Months);
    const sheet13 = monthlySheet('Évol. agréments TA',  'Mois',                s.trainingAccreditationsLast12Months);

    const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  ${styles}
  ${sheet1}${sheet2}${sheet3}${sheet4}${sheet5}${sheet6}${sheet7}${sheet8}${sheet9}${sheet10}${sheet11}${sheet12}${sheet13}
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `rapport-graphiques-${today}.xls`; a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Export Excel généré avec succès.');
  }

  exportPdf(): void {
    this.exporting = true;
    this.chartApi.exportPdf().subscribe({
      next: (blob) => {
        const today = new Date().toISOString().slice(0, 10);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'rapport-graphiques-' + today + '.pdf';
        a.click();
        window.URL.revokeObjectURL(url);
        this.exporting = false;
        this.toast.success('Rapport PDF généré avec succès.');
      },
      error: () => {
        this.toast.error('Erreur lors de la génération du rapport.');
        this.exporting = false;
      },
    });
  }

  // ── Helpers affichage ──────────────────────────────────────────────

  monthLabel(m: MonthlyStatDto): string {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
                    'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    return months[m.month - 1] + ' ' + m.year;
  }

  get chartMax(): number {
    if (!this.stats) return 1;
    return Math.max(1, ...this.stats.activitiesLast12Months.map(m => m.count));
  }

  barWidth(count: number): string {
    return Math.round((count / this.chartMax) * 100) + '%';
  }

  caTotal(): number {
    if (!this.stats) return 0;
    return this.stats.caAccepted + this.stats.caPending + this.stats.caReceived + this.stats.caRefused;
  }

  taTotal(): number {
    if (!this.stats) return 0;
    return this.stats.taAccepted + this.stats.taPending + this.stats.taReceived + this.stats.taRefused;
  }

  pct(val: number, total: number): number {
    return total === 0 ? 0 : Math.round((val / total) * 100);
  }

  get provinceMax(): number {
    if (!this.stats || !this.stats.activitiesByProvince.length) return 1;
    return Math.max(...this.stats.activitiesByProvince.map(p => p.count));
  }



  monthlyBarWidth(count: number, months: MonthlyStatDto[]): string {
    const max = Math.max(1, ...months.map(m => m.count));
    return Math.round((count / max) * 100) + '%';
  }

  namedBarWidth(count: number, items: NamedStatDto[]): string {
    const max = Math.max(1, ...items.map(i => i.count));
    return Math.round((count / max) * 100) + '%';
  }

  provinceBarWidth(count: number): string {
    return Math.round((count / this.provinceMax) * 100) + '%';
  }

  activeArchivedRows(): { label: string; active: number; archived: number; activePct: number; archivedPct: number }[] {
    if (!this.stats) return [];
    const rows = [
      { label: 'Centres de formation',    active: this.stats.trainingCentersActive,         archived: this.stats.trainingCentersArchived },
      { label: 'Agréments centres',        active: this.stats.centerAccreditationsActive,    archived: this.stats.centerAccreditationsArchived },
      { label: 'Agréments formations',     active: this.stats.trainingAccreditationsActive,  archived: this.stats.trainingAccreditationsArchived },
      { label: 'Formateur·trices',         active: this.stats.trainersActive,                archived: this.stats.trainersArchived },
    ];
    return rows.map(r => {
      const total = r.active + r.archived || 1;
      return { ...r, activePct: Math.round((r.active / total) * 100), archivedPct: Math.round((r.archived / total) * 100) };
    });
  }
}
