import { Component, OnInit, ViewChild, ElementRef, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../../../shared/shared-imports';
import { ToastService } from '../../../../shared/toast/toast.service';
import { SubModuleApi, SubModuleDto, AccreditationRequestStatus } from '../../api/sub-module.api';

interface SubFilter {
  yearFrom: string;
  yearTo: string;
  status: AccreditationRequestStatus | '';
  formationType: 'initial' | 'continuous' | '';
}

interface StatusByYearRow {
  year: string;
  accepted: number;
  refused: number;
  received: number;
  pending: number;
  total: number;
}

interface ThemeSubThemeRow {
  theme: string;
  subTheme: string;
  count: number;
}

interface ThemeDurationRow {
  theme: string;
  subTheme: string;
  count: number;
  totalHours: number;
  avgHours: string;
}

interface CenterStatRow {
  label: string;
  accepted: number;
  refused: number;
  received: number;
  pending: number;
  total: number;
}

function emptyFilter(): SubFilter {
  return { yearFrom: '', yearTo: '', status: '', formationType: '' };
}

@Component({
  selector: 'app-sub-module-stats',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './sub-module-stats.html',
  styleUrl: './sub-module-stats.css',
})
export class SubModuleStats implements OnInit {
  @ViewChild('statsContent') statsRef!: ElementRef<HTMLElement>;

  loading = true;
  error: string | null = null;
  exporting = false;

  private toast = inject(ToastService);

  private allItems: SubModuleDto[] = [];

  filterArchived: 'active' | 'archived' | 'all' = 'active';

  // T1 : par année / statut (filter: formationType)
  f1: Pick<SubFilter, 'formationType'> = { formationType: '' };

  // T2 : par type de formation (filter: année + statut)
  f2: Pick<SubFilter, 'yearFrom' | 'yearTo' | 'status'> = { yearFrom: '', yearTo: '', status: '' };

  // T3 : par type de phytolicence
  f3: SubFilter = emptyFilter();

  // T4 : thèmes / sous-thèmes
  f4: SubFilter = emptyFilter();
  f4ChartMode: 'theme' | 'subtheme' = 'theme';

  // T5 : durée par thème / sous-thème
  f5: SubFilter = emptyFilter();

  // T6 : par agrément centre
  f6: SubFilter = emptyFilter();

  constructor(private api: SubModuleApi) {}

  ngOnInit(): void {
    this.api.findAll().subscribe({
      next: (data) => {
        this.allItems = data ?? [];
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger les sous-modules.';
        this.loading = false;
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Base filtrée (actif / archivé)
  // ─────────────────────────────────────────────────────────────────

  get filteredBase(): SubModuleDto[] {
    if (this.filterArchived === 'active')   return this.allItems.filter(a => !a.archived);
    if (this.filterArchived === 'archived') return this.allItems.filter(a => !!a.archived);
    return this.allItems;
  }

  get availableYears(): string[] {
    const s = new Set<string>();
    for (const a of this.filteredBase) {
      const y = this.yearOf(a);
      if (y) s.add(y);
    }
    return Array.from(s).sort();
  }

  // ─────────────────────────────────────────────────────────────────
  // KPIs
  // ─────────────────────────────────────────────────────────────────

  get kpiTotal(): number    { return this.filteredBase.length; }
  get kpiAccepted(): number { return this.filteredBase.filter(a => a.requestStatus === 'ACCEPTED').length; }
  get kpiRefused(): number  { return this.filteredBase.filter(a => a.requestStatus === 'REFUSED').length; }
  get kpiReceived(): number { return this.filteredBase.filter(a => a.requestStatus === 'RECEIVED').length; }
  get kpiPending(): number  { return this.filteredBase.filter(a => a.requestStatus === 'PENDING').length; }

  get kpiAcceptedPct(): string {
    if (!this.kpiTotal) return '—';
    return ((this.kpiAccepted / this.kpiTotal) * 100).toFixed(0) + '%';
  }

  // ─────────────────────────────────────────────────────────────────
  // Tableau 1 — par année / statut
  // ─────────────────────────────────────────────────────────────────

  get t1List(): SubModuleDto[] {
    return this.filteredBase.filter(a => {
      if (this.f1.formationType === 'initial'    && !a.initial)    return false;
      if (this.f1.formationType === 'continuous' && !a.continuous) return false;
      return true;
    });
  }

  get t1Rows(): StatusByYearRow[] { return this.groupByYear(this.t1List); }

  get t1Total(): StatusByYearRow {
    const rows = this.t1Rows;
    return {
      year: 'TOTAL',
      accepted: rows.reduce((s, r) => s + r.accepted, 0),
      refused:  rows.reduce((s, r) => s + r.refused,  0),
      received: rows.reduce((s, r) => s + r.received, 0),
      pending:  rows.reduce((s, r) => s + r.pending,  0),
      total:    rows.reduce((s, r) => s + r.total,    0),
    };
  }

  get hasActiveF1(): boolean { return !!this.f1.formationType; }
  resetF1(): void { this.f1 = { formationType: '' }; }

  t1SegW(count: number, rowTotal: number): string {
    if (!rowTotal) return '0%';
    return ((count / rowTotal) * 100).toFixed(1) + '%';
  }

  // ─────────────────────────────────────────────────────────────────
  // Tableau 2 — par type de formation
  // ─────────────────────────────────────────────────────────────────

  get t2List(): SubModuleDto[] {
    return this.filteredBase.filter(a => {
      if (this.f2.yearFrom && this.yearOf(a) < this.f2.yearFrom) return false;
      if (this.f2.yearTo   && this.yearOf(a) > this.f2.yearTo)   return false;
      if (this.f2.status && a.requestStatus !== this.f2.status) return false;
      return true;
    });
  }

  get t2Total(): number     { return this.t2List.length; }
  get t2Initial(): number   { return this.t2List.filter(a => a.initial).length; }
  get t2Continuous(): number { return this.t2List.filter(a => a.continuous).length; }
  get t2Both(): number      { return this.t2List.filter(a => a.initial && a.continuous).length; }
  get t2InitialPct(): string    { return this.pct(this.t2Initial,    this.t2Total); }
  get t2ContinuousPct(): string { return this.pct(this.t2Continuous, this.t2Total); }
  get t2BothPct(): string       { return this.pct(this.t2Both,       this.t2Total); }

  get t2DonutGradient(): string {
    if (!this.t2Total) return 'conic-gradient(#e5e7eb 0% 100%)';
    const pI = (this.t2Initial    / this.t2Total) * 100;
    const pC = (this.t2Continuous / this.t2Total) * 100;
    const pB = (this.t2Both       / this.t2Total) * 100;
    return `conic-gradient(#0e7a75 0% ${pI.toFixed(2)}%, #4d9c18 ${pI.toFixed(2)}% ${(pI + pC).toFixed(2)}%, #12a19a ${(pI + pC).toFixed(2)}% ${(pI + pC + pB).toFixed(2)}%, #e5e7eb ${(pI + pC + pB).toFixed(2)}% 100%)`;
  }

  get hasActiveF2(): boolean { return !!(this.f2.yearFrom || this.f2.yearTo || this.f2.status); }
  resetF2(): void { this.f2 = { yearFrom: '', yearTo: '', status: '' }; }

  // ─────────────────────────────────────────────────────────────────
  // Tableau 3 — par type de phytolicence
  // ─────────────────────────────────────────────────────────────────

  get t3List(): SubModuleDto[] { return this.applyFilter(this.filteredBase, this.f3); }

  get t3LicenseRows(): Array<{ label: string; count: number; pct: string }> {
    const map = new Map<string, number>();
    for (const a of this.t3List) {
      for (const lt of a.licenseTypeLabels ?? []) {
        map.set(lt, (map.get(lt) ?? 0) + 1);
      }
    }
    const total = this.t3Total;
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([label, count]) => ({ label, count, pct: this.pct(count, total) }));
  }

  get t3Total(): number {
    const map = new Map<string, number>();
    for (const a of this.t3List) {
      for (const lt of a.licenseTypeLabels ?? []) map.set(lt, (map.get(lt) ?? 0) + 1);
    }
    return Array.from(map.values()).reduce((s, v) => s + v, 0);
  }

  get t3MaxCount(): number {
    const vals = this.t3LicenseRows.map(r => r.count);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  t3BarW(count: number): string { return Math.round((count / this.t3MaxCount) * 100) + '%'; }

  get hasActiveF3(): boolean { return !!(this.f3.yearFrom || this.f3.yearTo || this.f3.status || this.f3.formationType); }
  resetF3(): void { this.f3 = emptyFilter(); }

  // ─────────────────────────────────────────────────────────────────
  // Tableau 4 — Thèmes / Sous-thèmes
  // ─────────────────────────────────────────────────────────────────

  get t4List(): SubModuleDto[] { return this.applyFilter(this.filteredBase, this.f4); }

  get t4Rows(): ThemeSubThemeRow[] {
    const map = new Map<string, ThemeSubThemeRow>();
    for (const a of this.t4List) {
      const themes    = a.themeLabels?.length    ? a.themeLabels    : ['—'];
      const subThemes = a.subThemeLabels?.length ? a.subThemeLabels : ['—'];
      for (const theme of themes) {
        for (const subTheme of subThemes) {
          const key = `${theme}||${subTheme}`;
          if (!map.has(key)) map.set(key, { theme, subTheme, count: 0 });
          map.get(key)!.count++;
        }
      }
    }
    return Array.from(map.values())
      .sort((a, b) => a.theme.localeCompare(b.theme) || a.subTheme.localeCompare(b.subTheme));
  }

  get t4GrandTotal(): number { return this.t4Rows.reduce((s, r) => s + r.count, 0); }

  t4Pct(count: number): string {
    if (!this.t4GrandTotal) return '—';
    return ((count / this.t4GrandTotal) * 100).toFixed(1) + '%';
  }

  get t4ByTheme(): Array<{ theme: string; count: number }> {
    const map = new Map<string, number>();
    for (const r of this.t4Rows) map.set(r.theme, (map.get(r.theme) ?? 0) + r.count);
    return Array.from(map.entries())
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count);
  }

  get t4ChartRows(): Array<{ label: string; sublabel?: string; count: number }> {
    if (this.f4ChartMode === 'subtheme') {
      return [...this.t4Rows]
        .sort((a, b) => b.count - a.count)
        .map(r => ({ label: r.subTheme, sublabel: r.theme, count: r.count }));
    }
    return this.t4ByTheme.map(r => ({ label: r.theme, count: r.count }));
  }

  get t4MaxCount(): number {
    const vals = this.t4ChartRows.map(r => r.count);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  t4BarW(count: number): string { return Math.round((count / this.t4MaxCount) * 100) + '%'; }

  t4ThemeColor(theme: string): string {
    const idx = this.t4ByTheme.findIndex(x => x.theme === theme);
    return this.THEME_COLORS[(idx < 0 ? 0 : idx) % this.THEME_COLORS.length];
  }

  get hasActiveF4(): boolean { return !!(this.f4.yearFrom || this.f4.yearTo || this.f4.status || this.f4.formationType); }
  resetF4(): void { this.f4 = emptyFilter(); }

  // ─────────────────────────────────────────────────────────────────
  // Tableau 5 — Durée par thème / sous-thème
  // ─────────────────────────────────────────────────────────────────

  get t5List(): SubModuleDto[] { return this.applyFilter(this.filteredBase, this.f5); }

  get t5Rows(): ThemeDurationRow[] {
    const map = new Map<string, { theme: string; subTheme: string; count: number; totalHours: number }>();
    for (const a of this.t5List) {
      if (!a.durationHours) continue;
      const themes    = a.themeLabels?.length    ? a.themeLabels    : ['—'];
      const subThemes = a.subThemeLabels?.length ? a.subThemeLabels : ['—'];
      for (const theme of themes) {
        for (const subTheme of subThemes) {
          const key = `${theme}||${subTheme}`;
          if (!map.has(key)) map.set(key, { theme, subTheme, count: 0, totalHours: 0 });
          const row = map.get(key)!;
          row.count++;
          row.totalHours += a.durationHours;
        }
      }
    }
    return Array.from(map.values())
      .map(r => ({
        ...r,
        totalHours: Math.round(r.totalHours * 10) / 10,
        avgHours: r.count ? (r.totalHours / r.count).toFixed(1) : '—',
      }))
      .sort((a, b) => b.totalHours - a.totalHours || a.theme.localeCompare(b.theme));
  }

  get t5GrandTotalHours(): number {
    return Math.round(this.t5Rows.reduce((s, r) => s + r.totalHours, 0) * 10) / 10;
  }
  get t5GrandTotalCount(): number { return this.t5Rows.reduce((s, r) => s + r.count, 0); }

  get t5MaxHours(): number {
    const vals = this.t5Rows.map(r => r.totalHours);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  t5BarW(hours: number): string { return Math.round((hours / this.t5MaxHours) * 100) + '%'; }

  get t5AvgGlobal(): string {
    if (!this.t5GrandTotalCount) return '—';
    return (this.t5GrandTotalHours / this.t5GrandTotalCount).toFixed(1);
  }

  get t5ByTheme(): Array<{ theme: string; hours: number; pct: string; color: string }> {
    const map = new Map<string, number>();
    for (const r of this.t5Rows) {
      map.set(r.theme, Math.round(((map.get(r.theme) ?? 0) + r.totalHours) * 10) / 10);
    }
    const total = this.t5GrandTotalHours;
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([theme, hours], i) => ({
        theme,
        hours,
        pct: total ? ((hours / total) * 100).toFixed(1) + '%' : '0%',
        color: this.THEME_COLORS[i % this.THEME_COLORS.length],
      }));
  }

  get t5DonutGradient(): string {
    if (!this.t5GrandTotalHours) return 'conic-gradient(#e5e7eb 0% 100%)';
    const total = this.t5GrandTotalHours;
    let cumulative = 0;
    const segments = this.t5ByTheme.map(r => {
      const pct = (r.hours / total) * 100;
      const from = cumulative;
      cumulative += pct;
      return `${r.color} ${from.toFixed(2)}% ${cumulative.toFixed(2)}%`;
    });
    if (cumulative < 100) segments.push(`#e5e7eb ${cumulative.toFixed(2)}% 100%`);
    return `conic-gradient(${segments.join(', ')})`;
  }

  get hasActiveF5(): boolean { return !!(this.f5.yearFrom || this.f5.yearTo || this.f5.status || this.f5.formationType); }
  resetF5(): void { this.f5 = emptyFilter(); }

  // ─────────────────────────────────────────────────────────────────
  // Tableau 6 — Par agrément centre
  // ─────────────────────────────────────────────────────────────────

  get t6List(): SubModuleDto[] { return this.applyFilter(this.filteredBase, this.f6); }

  get t6Rows(): CenterStatRow[] {
    const map = new Map<string, CenterStatRow>();
    for (const a of this.t6List) {
      const label = a.centerAccreditationLabel ?? '—';
      if (!map.has(label)) map.set(label, { label, accepted: 0, refused: 0, received: 0, pending: 0, total: 0 });
      const row = map.get(label)!;
      row.total++;
      if      (a.requestStatus === 'ACCEPTED') row.accepted++;
      else if (a.requestStatus === 'REFUSED')  row.refused++;
      else if (a.requestStatus === 'RECEIVED') row.received++;
      else if (a.requestStatus === 'PENDING')  row.pending++;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }

  get t6Total(): CenterStatRow {
    const rows = this.t6Rows;
    return {
      label: 'TOTAL',
      accepted: rows.reduce((s, r) => s + r.accepted, 0),
      refused:  rows.reduce((s, r) => s + r.refused,  0),
      received: rows.reduce((s, r) => s + r.received, 0),
      pending:  rows.reduce((s, r) => s + r.pending,  0),
      total:    rows.reduce((s, r) => s + r.total,    0),
    };
  }

  get t6MaxTotal(): number {
    const vals = this.t6Rows.map(r => r.total);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  t6BarW(count: number): string { return Math.round((count / this.t6MaxTotal) * 100) + '%'; }

  get hasActiveF6(): boolean { return !!(this.f6.yearFrom || this.f6.yearTo || this.f6.status || this.f6.formationType); }
  resetF6(): void { this.f6 = emptyFilter(); }

  // ─────────────────────────────────────────────────────────────────
  // Utilitaires
  // ─────────────────────────────────────────────────────────────────

  pct(count: number, total: number): string {
    if (!total) return '0%';
    return ((count / total) * 100).toFixed(0) + '%';
  }

  readonly LICENSE_COLORS = ['#0e7a75', '#4d9c18', '#12a19a', '#b7c90d', '#065f5a', '#db2777', '#ca8a04', '#2e6310'];
  readonly THEME_COLORS   = ['#0e7a75', '#4d9c18', '#12a19a', '#b7c90d', '#065f5a', '#db2777', '#ca8a04', '#2e6310', '#6e7800', '#0a6d67'];

  private applyFilter(list: SubModuleDto[], f: SubFilter): SubModuleDto[] {
    return list.filter(a => {
      if (f.yearFrom && this.yearOf(a) < f.yearFrom) return false;
      if (f.yearTo   && this.yearOf(a) > f.yearTo)   return false;
      if (f.status && a.requestStatus !== f.status) return false;
      if (f.formationType === 'initial'    && !a.initial)    return false;
      if (f.formationType === 'continuous' && !a.continuous) return false;
      return true;
    });
  }

  private groupByYear(list: SubModuleDto[]): StatusByYearRow[] {
    const map = new Map<string, StatusByYearRow>();
    for (const a of list) {
      const y = this.yearOf(a);
      if (!y) continue;
      if (!map.has(y)) map.set(y, { year: y, accepted: 0, refused: 0, received: 0, pending: 0, total: 0 });
      const r = map.get(y)!;
      r.total++;
      if      (a.requestStatus === 'ACCEPTED') r.accepted++;
      else if (a.requestStatus === 'REFUSED')  r.refused++;
      else if (a.requestStatus === 'RECEIVED') r.received++;
      else if (a.requestStatus === 'PENDING')  r.pending++;
    }
    return Array.from(map.values()).sort((a, b) => a.year.localeCompare(b.year));
  }

  private yearOf(a: SubModuleDto): string {
    const d = a.receivedDate || a.startDate;
    if (!d) return '';
    return String(new Date(d).getFullYear());
  }

  // ─────────────────────────────────────────────
  // Export
  // ─────────────────────────────────────────────

  exportExcel(): void {
    const today = new Date().toISOString().slice(0, 10);

    const border = (color = '#e2e8f0', w = 1) =>
      `<Borders>` +
      ['Top', 'Bottom', 'Left', 'Right'].map(p =>
        `<Border ss:Position="${p}" ss:LineStyle="Continuous" ss:Weight="${w}" ss:Color="${color}"/>`
      ).join('') + `</Borders>`;

    const styles = `
      <Style ss:ID="title">
        <Font ss:Bold="1" ss:Size="14" ss:Color="#1e293b" ss:FontName="Arial"/>
        <Alignment ss:Vertical="Center"/>
      </Style>
      <Style ss:ID="subtitle">
        <Font ss:Size="10" ss:Color="#64748b" ss:FontName="Arial"/>
        <Alignment ss:Vertical="Center"/>
      </Style>
      <Style ss:ID="hdr">
        <Font ss:Bold="1" ss:Size="10" ss:Color="#FFFFFF" ss:FontName="Arial"/>
        <Interior ss:Color="#0e7a75" ss:Pattern="Solid"/>
        <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
        ${border('#065f5a')}
      </Style>
      <Style ss:ID="name">
        <Font ss:Size="10" ss:Color="#1e293b" ss:FontName="Arial"/>
        <Alignment ss:Vertical="Center"/>
        ${border()}
      </Style>
      <Style ss:ID="num">
        <Font ss:Size="10" ss:Color="#1e293b" ss:FontName="Arial"/>
        <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
        ${border()}
      </Style>
      <Style ss:ID="nameZ">
        <Font ss:Size="10" ss:Color="#1e293b" ss:FontName="Arial"/>
        <Interior ss:Color="#f8fafc" ss:Pattern="Solid"/>
        <Alignment ss:Vertical="Center"/>
        ${border()}
      </Style>
      <Style ss:ID="numZ">
        <Font ss:Size="10" ss:Color="#1e293b" ss:FontName="Arial"/>
        <Interior ss:Color="#f8fafc" ss:Pattern="Solid"/>
        <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
        ${border()}
      </Style>
      <Style ss:ID="totalLabel">
        <Font ss:Bold="1" ss:Size="10" ss:Color="#1e293b" ss:FontName="Arial"/>
        <Interior ss:Color="#cce8e7" ss:Pattern="Solid"/>
        <Alignment ss:Vertical="Center"/>
        ${border('#99d5d3', 2)}
      </Style>
      <Style ss:ID="totalNum">
        <Font ss:Bold="1" ss:Size="10" ss:Color="#1e293b" ss:FontName="Arial"/>
        <Interior ss:Color="#cce8e7" ss:Pattern="Solid"/>
        <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
        ${border('#99d5d3', 2)}
      </Style>`;

    // Sheet 1 — par année / statut
    const yearRows = this.groupByYear(this.filteredBase);
    const yearTotal = {
      accepted: yearRows.reduce((s, r) => s + r.accepted, 0),
      refused:  yearRows.reduce((s, r) => s + r.refused,  0),
      received: yearRows.reduce((s, r) => s + r.received, 0),
      pending:  yearRows.reduce((s, r) => s + r.pending,  0),
      total:    yearRows.reduce((s, r) => s + r.total,    0),
    };
    const sheet1 = `<Worksheet ss:Name="Par année">
      <Table ss:DefaultRowHeight="18">
        <Column ss:Width="100"/><Column ss:Width="80"/><Column ss:Width="80"/><Column ss:Width="80"/><Column ss:Width="80"/><Column ss:Width="80"/>
        <Row ss:Height="28">
          <Cell ss:StyleID="title" ss:MergeAcross="5">
            <Data ss:Type="String">Sous-modules — par année et statut</Data>
          </Cell>
        </Row>
        <Row ss:Height="18">
          <Cell ss:StyleID="subtitle" ss:MergeAcross="5">
            <Data ss:Type="String">Exporté le ${today} — ${yearRows.length} année(s) — ${yearTotal.total} sous-module(s)</Data>
          </Cell>
        </Row>
        <Row ss:Height="8"><Cell/></Row>
        <Row ss:Height="22">
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Année</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Accepté</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Refusé</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">En cours</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">En attente</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Total</Data></Cell>
        </Row>
        ${yearRows.map((r, i) => {
          const z = i % 2 === 1;
          return `<Row ss:Height="18">
            <Cell ss:StyleID="${z ? 'nameZ' : 'name'}"><Data ss:Type="String">${this.escapeXml(r.year)}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.accepted}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.refused}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.received}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.pending}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.total}</Data></Cell>
          </Row>`;
        }).join('\n')}
        <Row ss:Height="20">
          <Cell ss:StyleID="totalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${yearTotal.accepted}</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${yearTotal.refused}</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${yearTotal.received}</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${yearTotal.pending}</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${yearTotal.total}</Data></Cell>
        </Row>
      </Table>
    </Worksheet>`;

    // Sheet 2 — par type de formation
    const allItems = this.filteredBase;
    const t2ExpInitial    = allItems.filter(a => a.initial).length;
    const t2ExpContinuous = allItems.filter(a => a.continuous).length;
    const t2ExpBoth       = allItems.filter(a => a.initial && a.continuous).length;
    const t2ExpTotal      = allItems.length;
    const t2Pct = (n: number) => t2ExpTotal ? ((n / t2ExpTotal) * 100).toFixed(1) + '%' : '0%';
    const sheet2 = `<Worksheet ss:Name="Type formation">
      <Table ss:DefaultRowHeight="18">
        <Column ss:Width="200"/><Column ss:Width="100"/><Column ss:Width="80"/>
        <Row ss:Height="28">
          <Cell ss:StyleID="title" ss:MergeAcross="2">
            <Data ss:Type="String">Sous-modules — par type de formation</Data>
          </Cell>
        </Row>
        <Row ss:Height="18">
          <Cell ss:StyleID="subtitle" ss:MergeAcross="2">
            <Data ss:Type="String">Exporté le ${today} — ${t2ExpTotal} sous-module(s)</Data>
          </Cell>
        </Row>
        <Row ss:Height="8"><Cell/></Row>
        <Row ss:Height="22">
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Type de formation</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Nombre</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Part (%)</Data></Cell>
        </Row>
        <Row ss:Height="18">
          <Cell ss:StyleID="name"><Data ss:Type="String">Initiale</Data></Cell>
          <Cell ss:StyleID="num"><Data ss:Type="Number">${t2ExpInitial}</Data></Cell>
          <Cell ss:StyleID="num"><Data ss:Type="String">${t2Pct(t2ExpInitial)}</Data></Cell>
        </Row>
        <Row ss:Height="18">
          <Cell ss:StyleID="nameZ"><Data ss:Type="String">Continue</Data></Cell>
          <Cell ss:StyleID="numZ"><Data ss:Type="Number">${t2ExpContinuous}</Data></Cell>
          <Cell ss:StyleID="numZ"><Data ss:Type="String">${t2Pct(t2ExpContinuous)}</Data></Cell>
        </Row>
        <Row ss:Height="18">
          <Cell ss:StyleID="name"><Data ss:Type="String">Les deux</Data></Cell>
          <Cell ss:StyleID="num"><Data ss:Type="Number">${t2ExpBoth}</Data></Cell>
          <Cell ss:StyleID="num"><Data ss:Type="String">${t2Pct(t2ExpBoth)}</Data></Cell>
        </Row>
        <Row ss:Height="20">
          <Cell ss:StyleID="totalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${t2ExpTotal}</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="String">100%</Data></Cell>
        </Row>
      </Table>
    </Worksheet>`;

    // Sheet 3 — par phytolicence
    const licMap = new Map<string, number>();
    for (const a of allItems) {
      for (const lt of a.licenseTypeLabels ?? []) {
        licMap.set(lt, (licMap.get(lt) ?? 0) + 1);
      }
    }
    const licTotal = Array.from(licMap.values()).reduce((s, v) => s + v, 0);
    const licRows = Array.from(licMap.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([label, count]) => ({ label, count, pct: licTotal ? ((count / licTotal) * 100).toFixed(1) + '%' : '0%' }));
    const sheet3 = `<Worksheet ss:Name="Par phytolicence">
      <Table ss:DefaultRowHeight="18">
        <Column ss:Width="220"/><Column ss:Width="100"/><Column ss:Width="80"/>
        <Row ss:Height="28">
          <Cell ss:StyleID="title" ss:MergeAcross="2">
            <Data ss:Type="String">Sous-modules — par type de phytolicence</Data>
          </Cell>
        </Row>
        <Row ss:Height="18">
          <Cell ss:StyleID="subtitle" ss:MergeAcross="2">
            <Data ss:Type="String">Exporté le ${today} — ${licRows.length} type(s) — ${licTotal} occurrence(s)</Data>
          </Cell>
        </Row>
        <Row ss:Height="8"><Cell/></Row>
        <Row ss:Height="22">
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Phytolicence</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Nombre</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Part (%)</Data></Cell>
        </Row>
        ${licRows.map((r, i) => {
          const z = i % 2 === 1;
          return `<Row ss:Height="18">
            <Cell ss:StyleID="${z ? 'nameZ' : 'name'}"><Data ss:Type="String">${this.escapeXml(r.label)}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.count}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="String">${r.pct}</Data></Cell>
          </Row>`;
        }).join('\n')}
        <Row ss:Height="20">
          <Cell ss:StyleID="totalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${licTotal}</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="String">100%</Data></Cell>
        </Row>
      </Table>
    </Worksheet>`;

    // Sheet 4 — par thème et sous-thème
    const tsMap = new Map<string, { theme: string; subTheme: string; count: number }>();
    for (const a of allItems) {
      const themes    = a.themeLabels?.length    ? a.themeLabels    : ['—'];
      const subThemes = a.subThemeLabels?.length ? a.subThemeLabels : ['—'];
      for (const theme of themes) {
        for (const subTheme of subThemes) {
          const key = `${theme}||${subTheme}`;
          if (!tsMap.has(key)) tsMap.set(key, { theme, subTheme, count: 0 });
          tsMap.get(key)!.count++;
        }
      }
    }
    const tsRows = Array.from(tsMap.values())
      .sort((a, b) => a.theme.localeCompare(b.theme) || a.subTheme.localeCompare(b.subTheme));
    const tsGrandTotal = tsRows.reduce((s, r) => s + r.count, 0);
    const sheet4 = `<Worksheet ss:Name="Thème et sous-thème">
      <Table ss:DefaultRowHeight="18">
        <Column ss:Width="200"/><Column ss:Width="200"/><Column ss:Width="100"/><Column ss:Width="80"/>
        <Row ss:Height="28">
          <Cell ss:StyleID="title" ss:MergeAcross="3">
            <Data ss:Type="String">Sous-modules — par thème et sous-thème</Data>
          </Cell>
        </Row>
        <Row ss:Height="18">
          <Cell ss:StyleID="subtitle" ss:MergeAcross="3">
            <Data ss:Type="String">Exporté le ${today} — ${tsRows.length} combinaison(s) — ${tsGrandTotal} occurrence(s)</Data>
          </Cell>
        </Row>
        <Row ss:Height="8"><Cell/></Row>
        <Row ss:Height="22">
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Thème</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Sous-thème</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Nombre</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Part (%)</Data></Cell>
        </Row>
        ${tsRows.map((r, i) => {
          const z = i % 2 === 1;
          const pct = tsGrandTotal ? ((r.count / tsGrandTotal) * 100).toFixed(1) + '%' : '0%';
          return `<Row ss:Height="18">
          <Cell ss:StyleID="${z ? 'nameZ' : 'name'}"><Data ss:Type="String">${this.escapeXml(r.theme)}</Data></Cell>
          <Cell ss:StyleID="${z ? 'nameZ' : 'name'}"><Data ss:Type="String">${this.escapeXml(r.subTheme)}</Data></Cell>
          <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.count}</Data></Cell>
          <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="String">${pct}</Data></Cell>
        </Row>`;
        }).join('\n')}
        <Row ss:Height="20">
          <Cell ss:StyleID="totalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
          <Cell ss:StyleID="totalLabel"></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${tsGrandTotal}</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="String">100%</Data></Cell>
        </Row>
      </Table>
    </Worksheet>`;

    // Sheet 5 — par agrément centre
    const centerMap = new Map<string, { accepted: number; refused: number; received: number; pending: number; total: number }>();
    for (const a of allItems) {
      const label = a.centerAccreditationLabel ?? '—';
      if (!centerMap.has(label)) centerMap.set(label, { accepted: 0, refused: 0, received: 0, pending: 0, total: 0 });
      const row = centerMap.get(label)!;
      row.total++;
      if      (a.requestStatus === 'ACCEPTED') row.accepted++;
      else if (a.requestStatus === 'REFUSED')  row.refused++;
      else if (a.requestStatus === 'RECEIVED') row.received++;
      else if (a.requestStatus === 'PENDING')  row.pending++;
    }
    const centerRows = Array.from(centerMap.entries())
      .map(([label, d]) => ({ label, ...d }))
      .sort((a, b) => b.total - a.total);
    const centerTotal = {
      accepted: centerRows.reduce((s, r) => s + r.accepted, 0),
      refused:  centerRows.reduce((s, r) => s + r.refused,  0),
      received: centerRows.reduce((s, r) => s + r.received, 0),
      pending:  centerRows.reduce((s, r) => s + r.pending,  0),
      total:    centerRows.reduce((s, r) => s + r.total,    0),
    };
    const sheet5 = `<Worksheet ss:Name="Par agrément centre">
      <Table ss:DefaultRowHeight="18">
        <Column ss:Width="240"/><Column ss:Width="80"/><Column ss:Width="80"/><Column ss:Width="80"/><Column ss:Width="80"/><Column ss:Width="80"/>
        <Row ss:Height="28">
          <Cell ss:StyleID="title" ss:MergeAcross="5">
            <Data ss:Type="String">Sous-modules — par agrément centre</Data>
          </Cell>
        </Row>
        <Row ss:Height="18">
          <Cell ss:StyleID="subtitle" ss:MergeAcross="5">
            <Data ss:Type="String">Exporté le ${today} — ${centerRows.length} agrément(s) centre — ${centerTotal.total} sous-module(s)</Data>
          </Cell>
        </Row>
        <Row ss:Height="8"><Cell/></Row>
        <Row ss:Height="22">
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Agrément centre</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Accepté</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Refusé</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">En cours</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">En attente</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Total</Data></Cell>
        </Row>
        ${centerRows.map((r, i) => {
          const z = i % 2 === 1;
          return `<Row ss:Height="18">
            <Cell ss:StyleID="${z ? 'nameZ' : 'name'}"><Data ss:Type="String">${this.escapeXml(r.label)}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.accepted}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.refused}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.received}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.pending}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.total}</Data></Cell>
          </Row>`;
        }).join('\n')}
        <Row ss:Height="20">
          <Cell ss:StyleID="totalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${centerTotal.accepted}</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${centerTotal.refused}</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${centerTotal.received}</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${centerTotal.pending}</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${centerTotal.total}</Data></Cell>
        </Row>
      </Table>
    </Worksheet>`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Styles>${styles}</Styles>
  ${sheet1}
  ${sheet2}
  ${sheet3}
  ${sheet4}
  ${sheet5}
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    this.triggerDownload(blob, `sous-modules-statistiques-${today}.xls`);
  }

  async exportPdf(): Promise<void> {
    this.exporting = true;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const element = this.statsRef.nativeElement;
      const prevOverflow = element.style.overflow;
      const prevHeight = element.style.height;
      element.style.overflow = 'visible';
      element.style.height = 'auto';
      const canvas = await html2canvas(element, {
        scale: 2, useCORS: true, scrollY: 0,
        width: element.scrollWidth, height: element.scrollHeight,
        windowWidth: element.scrollWidth, windowHeight: element.scrollHeight,
      });
      element.style.overflow = prevOverflow;
      element.style.height = prevHeight;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const pageHeightPx = Math.floor((pdfH * canvas.width) / pdfW);
      const totalPages = Math.ceil(canvas.height / pageHeightPx);
      for (let i = 0; i < totalPages; i++) {
        if (i > 0) pdf.addPage();
        const srcY = i * pageHeightPx;
        const srcH = Math.min(pageHeightPx, canvas.height - srcY);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = pageHeightPx;
        const ctx = pageCanvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pdfW, pdfH);
      }
      const today = new Date().toISOString().slice(0, 10);
      pdf.save(`sous-modules-statistiques-${today}.pdf`);
    } catch (err) {
      console.error(err);
      this.toast.error('Erreur lors de la génération du PDF.');
    } finally {
      this.exporting = false;
    }
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
