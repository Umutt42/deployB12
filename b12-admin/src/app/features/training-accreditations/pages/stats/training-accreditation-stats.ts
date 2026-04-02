import { Component, OnInit, ViewChild, ElementRef, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../../../shared/shared-imports';
import { ToastService } from '../../../../shared/toast/toast.service';
import {
  TrainingAccreditationApi,
  TrainingAccreditationDto,
  AccreditationRequestStatus,
} from '../../api/training-accreditation.api';

interface AccFilter {
  yearFrom: string;
  yearTo: string;
  status: AccreditationRequestStatus | '';
  type: 'COMPLETE' | 'SUB_MODULES' | '';
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

interface TypeLicenseRow {
  license: string;
  complete: number;
  subModules: number;
  total: number;
}

interface CenterStatRow {
  label: string;
  accepted: number;
  refused: number;
  received: number;
  pending: number;
  total: number;
}

function emptyFilter(): AccFilter {
  return { yearFrom: '', yearTo: '', status: '', type: '', formationType: '' };
}

@Component({
  selector: 'app-training-accreditation-stats',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './training-accreditation-stats.html',
  styleUrl: './training-accreditation-stats.css',
})
export class TrainingAccreditationStats implements OnInit {
  @ViewChild('statsContent') statsRef!: ElementRef<HTMLElement>;

  loading = true;
  error: string | null = null;
  exporting = false;

  private toast = inject(ToastService);

  private allAccreditations: TrainingAccreditationDto[] = [];

  filterArchived: 'active' | 'archived' | 'all' = 'active';

  // Filtres par tableau
  // T1 : type + formationType (année = groupement, statut = colonnes)
  f1: Pick<AccFilter, 'type' | 'formationType'> = { type: '', formationType: '' };

  // T2 : année + statut + formationType (type = groupement)
  f2: Pick<AccFilter, 'yearFrom' | 'yearTo' | 'status' | 'formationType'> = { yearFrom: '', yearTo: '', status: '', formationType: '' };

  // T3 : année + statut + type (formationType = groupement)
  f3: Pick<AccFilter, 'yearFrom' | 'yearTo' | 'status' | 'type'> = { yearFrom: '', yearTo: '', status: '', type: '' };

  // T4 : année + statut + type + formationType
  f4: AccFilter = emptyFilter();

  // T5 : année + statut + type + formationType
  f5: AccFilter = emptyFilter();
  f5ChartMode: 'theme' | 'subtheme' = 'theme';

  // T6 : année + statut (type = groupement)
  f6: Pick<AccFilter, 'yearFrom' | 'yearTo' | 'status'> = { yearFrom: '', yearTo: '', status: '' };

  // T7 : durée par thème / sous-thème
  f7: AccFilter = emptyFilter();

  // T8 : par agrément centre
  f8: AccFilter = emptyFilter();

  constructor(private api: TrainingAccreditationApi) {}

  ngOnInit(): void {
    this.api.findAll().subscribe({
      next: (data) => {
        this.allAccreditations = data ?? [];
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger les agréments formation.';
        this.loading = false;
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Options de filtres
  // ─────────────────────────────────────────────────────────────────

  get filteredBase(): TrainingAccreditationDto[] {
    if (this.filterArchived === 'active')   return this.allAccreditations.filter(a => !a.archived);
    if (this.filterArchived === 'archived') return this.allAccreditations.filter(a => !!a.archived);
    return this.allAccreditations;
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
  // KPIs (sans filtres — vue d'ensemble)
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

  get t1List(): TrainingAccreditationDto[] {
    return this.filteredBase.filter(a => {
      if (this.f1.type === 'COMPLETE'    && a.type !== 'COMPLETE'    && a.type != null) return false;
      if (this.f1.type === 'SUB_MODULES' && a.type !== 'SUB_MODULES') return false;
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

  get hasActiveF1(): boolean { return !!(this.f1.type || this.f1.formationType); }
  resetF1(): void { this.f1 = { type: '', formationType: '' }; }

  t1SegW(count: number, rowTotal: number): string {
    if (!rowTotal) return '0%';
    return ((count / rowTotal) * 100).toFixed(1) + '%';
  }

  // ─────────────────────────────────────────────────────────────────
  // Tableau 2 — par type d'agrément
  // ─────────────────────────────────────────────────────────────────

  get t2List(): TrainingAccreditationDto[] {
    return this.filteredBase.filter(a => {
      if (this.f2.yearFrom && this.yearOf(a) < this.f2.yearFrom) return false;
      if (this.f2.yearTo   && this.yearOf(a) > this.f2.yearTo)   return false;
      if (this.f2.status && a.requestStatus !== this.f2.status) return false;
      if (this.f2.formationType === 'initial'    && !a.initial)    return false;
      if (this.f2.formationType === 'continuous' && !a.continuous) return false;
      return true;
    });
  }

  get t2Total(): number    { return this.t2List.length; }
  get t2Complete(): number { return this.t2List.filter(a => a.type === 'COMPLETE' || !a.type).length; }
  get t2SubModules(): number { return this.t2List.filter(a => a.type === 'SUB_MODULES').length; }
  get t2CompletePct(): string    { return this.pct(this.t2Complete,    this.t2Total); }
  get t2SubModulesPct(): string  { return this.pct(this.t2SubModules,  this.t2Total); }

  get t2DonutGradient(): string {
    if (!this.t2Total) return 'conic-gradient(#e5e7eb 0% 100%)';
    const p = (this.t2Complete / this.t2Total) * 100;
    return `conic-gradient(#0e7a75 0% ${p.toFixed(2)}%, #b7c90d ${p.toFixed(2)}% 100%)`;
  }

  get hasActiveF2(): boolean { return !!(this.f2.yearFrom || this.f2.yearTo || this.f2.status || this.f2.formationType); }
  resetF2(): void { this.f2 = { yearFrom: '', yearTo: '', status: '', formationType: '' }; }

  // ─────────────────────────────────────────────────────────────────
  // Tableau 3 — par type de formation
  // ─────────────────────────────────────────────────────────────────

  get t3List(): TrainingAccreditationDto[] {
    return this.filteredBase.filter(a => {
      if (this.f3.yearFrom && this.yearOf(a) < this.f3.yearFrom) return false;
      if (this.f3.yearTo   && this.yearOf(a) > this.f3.yearTo)   return false;
      if (this.f3.status && a.requestStatus !== this.f3.status) return false;
      if (this.f3.type === 'COMPLETE'    && a.type !== 'COMPLETE'    && a.type != null) return false;
      if (this.f3.type === 'SUB_MODULES' && a.type !== 'SUB_MODULES') return false;
      return true;
    });
  }

  get t3Total(): number     { return this.t3List.length; }
  get t3Initial(): number   { return this.t3List.filter(a => a.initial).length; }
  get t3Continuous(): number { return this.t3List.filter(a => a.continuous).length; }
  get t3Both(): number      { return this.t3List.filter(a => a.initial && a.continuous).length; }
  get t3InitialPct(): string    { return this.pct(this.t3Initial,    this.t3Total); }
  get t3ContinuousPct(): string { return this.pct(this.t3Continuous, this.t3Total); }
  get t3BothPct(): string       { return this.pct(this.t3Both,       this.t3Total); }

  get t3DonutGradient(): string {
    if (!this.t3Total) return 'conic-gradient(#e5e7eb 0% 100%)';
    const pI = (this.t3Initial    / this.t3Total) * 100;
    const pC = (this.t3Continuous / this.t3Total) * 100;
    const pB = (this.t3Both       / this.t3Total) * 100;
    return `conic-gradient(#0e7a75 0% ${pI.toFixed(2)}%, #4d9c18 ${pI.toFixed(2)}% ${(pI + pC).toFixed(2)}%, #12a19a ${(pI + pC).toFixed(2)}% ${(pI + pC + pB).toFixed(2)}%, #e5e7eb ${(pI + pC + pB).toFixed(2)}% 100%)`;
  }

  get hasActiveF3(): boolean { return !!(this.f3.yearFrom || this.f3.yearTo || this.f3.status || this.f3.type); }
  resetF3(): void { this.f3 = { yearFrom: '', yearTo: '', status: '', type: '' }; }

  // ─────────────────────────────────────────────────────────────────
  // Tableau 4 — par type de phytolicence
  // ─────────────────────────────────────────────────────────────────

  get t4List(): TrainingAccreditationDto[] { return this.applyFilter(this.filteredBase, this.f4); }

  get t4LicenseRows(): Array<{ label: string; count: number; pct: string }> {
    const map = new Map<string, number>();
    for (const a of this.t4List) {
      for (const lt of a.licenseTypeLabels ?? []) {
        map.set(lt, (map.get(lt) ?? 0) + 1);
      }
    }
    const total = this.t4Total;
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([label, count]) => ({ label, count, pct: this.pct(count, total) }));
  }

  get t4Total(): number {
    const map = new Map<string, number>();
    for (const a of this.t4List) {
      for (const lt of a.licenseTypeLabels ?? []) map.set(lt, (map.get(lt) ?? 0) + 1);
    }
    return Array.from(map.values()).reduce((s, v) => s + v, 0);
  }

  get t4MaxCount(): number {
    const vals = this.t4LicenseRows.map(r => r.count);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  t4BarW(count: number): string { return Math.round((count / this.t4MaxCount) * 100) + '%'; }

  get hasActiveF4(): boolean { return !!(this.f4.yearFrom || this.f4.yearTo || this.f4.status || this.f4.type || this.f4.formationType); }
  resetF4(): void { this.f4 = emptyFilter(); }

  // ─────────────────────────────────────────────────────────────────
  // Tableau 5 — Thèmes / Sous-thèmes
  // ─────────────────────────────────────────────────────────────────

  get t5List(): TrainingAccreditationDto[] { return this.applyFilter(this.filteredBase, this.f5); }

  get t5Rows(): ThemeSubThemeRow[] {
    const map = new Map<string, ThemeSubThemeRow>();
    for (const a of this.t5List) {
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

  get t5GrandTotal(): number { return this.t5Rows.reduce((s, r) => s + r.count, 0); }

  t5Pct(count: number): string {
    if (!this.t5GrandTotal) return '—';
    return ((count / this.t5GrandTotal) * 100).toFixed(1) + '%';
  }

  get t5ByTheme(): Array<{ theme: string; count: number }> {
    const map = new Map<string, number>();
    for (const r of this.t5Rows) map.set(r.theme, (map.get(r.theme) ?? 0) + r.count);
    return Array.from(map.entries())
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count);
  }

  get t5ChartRows(): Array<{ label: string; sublabel?: string; count: number }> {
    if (this.f5ChartMode === 'subtheme') {
      return [...this.t5Rows]
        .sort((a, b) => b.count - a.count)
        .map(r => ({ label: r.subTheme, sublabel: r.theme, count: r.count }));
    }
    return this.t5ByTheme.map(r => ({ label: r.theme, count: r.count }));
  }

  get t5MaxCount(): number {
    const vals = this.t5ChartRows.map(r => r.count);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  t5BarW(count: number): string { return Math.round((count / this.t5MaxCount) * 100) + '%'; }

  t5ThemeColor(theme: string): string {
    const idx = this.t5ByTheme.findIndex(x => x.theme === theme);
    return this.THEME_COLORS[(idx < 0 ? 0 : idx) % this.THEME_COLORS.length];
  }

  get hasActiveF5(): boolean { return !!(this.f5.yearFrom || this.f5.yearTo || this.f5.status || this.f5.type || this.f5.formationType); }
  resetF5(): void { this.f5 = emptyFilter(); }

  // ─────────────────────────────────────────────────────────────────
  // Tableau 6 — Croisement type × phytolicence
  // ─────────────────────────────────────────────────────────────────

  get t6List(): TrainingAccreditationDto[] {
    return this.applyFilter(this.filteredBase, { ...this.f6, type: '', formationType: '' });
  }

  get t6Rows(): TypeLicenseRow[] {
    const map = new Map<string, { complete: number; subModules: number }>();
    for (const a of this.t6List) {
      for (const lt of a.licenseTypeLabels ?? []) {
        if (!map.has(lt)) map.set(lt, { complete: 0, subModules: 0 });
        const row = map.get(lt)!;
        if (a.type === 'SUB_MODULES') row.subModules++;
        else row.complete++;
      }
    }
    return Array.from(map.entries())
      .map(([license, d]) => ({
        license,
        complete: d.complete,
        subModules: d.subModules,
        total: d.complete + d.subModules,
      }))
      .sort((a, b) => b.total - a.total);
  }

  get t6Total(): TypeLicenseRow {
    const rows = this.t6Rows;
    return {
      license: 'TOTAL',
      complete:   rows.reduce((s, r) => s + r.complete,   0),
      subModules: rows.reduce((s, r) => s + r.subModules, 0),
      total:      rows.reduce((s, r) => s + r.total,      0),
    };
  }

  t6CompletePct(r: TypeLicenseRow): string  { return this.pct(r.complete,   r.total); }
  t6SubModPct(r: TypeLicenseRow): string    { return this.pct(r.subModules, r.total); }

  get hasActiveF6(): boolean { return !!(this.f6.yearFrom || this.f6.yearTo || this.f6.status); }
  resetF6(): void { this.f6 = { yearFrom: '', yearTo: '', status: '' }; }

  // ─────────────────────────────────────────────────────────────────
  // Tableau 7 — Durée par thématiques et sous-thèmes
  // ─────────────────────────────────────────────────────────────────

  get t7List(): TrainingAccreditationDto[] { return this.applyFilter(this.filteredBase, this.f7); }

  get t7Rows(): ThemeDurationRow[] {
    const map = new Map<string, { theme: string; subTheme: string; count: number; totalHours: number }>();
    for (const a of this.t7List) {
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

  get t7GrandTotalHours(): number {
    return Math.round(this.t7Rows.reduce((s, r) => s + r.totalHours, 0) * 10) / 10;
  }
  get t7GrandTotalCount(): number { return this.t7Rows.reduce((s, r) => s + r.count, 0); }

  get t7MaxHours(): number {
    const vals = this.t7Rows.map(r => r.totalHours);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  t7BarW(hours: number): string { return Math.round((hours / this.t7MaxHours) * 100) + '%'; }

  get t7AvgGlobal(): string {
    if (!this.t7GrandTotalCount) return '—';
    return (this.t7GrandTotalHours / this.t7GrandTotalCount).toFixed(1);
  }

  get t7ByTheme(): Array<{ theme: string; hours: number; pct: string; color: string }> {
    const map = new Map<string, number>();
    for (const r of this.t7Rows) {
      map.set(r.theme, Math.round(((map.get(r.theme) ?? 0) + r.totalHours) * 10) / 10);
    }
    const total = this.t7GrandTotalHours;
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([theme, hours], i) => ({
        theme,
        hours,
        pct: total ? ((hours / total) * 100).toFixed(1) + '%' : '0%',
        color: this.THEME_COLORS[i % this.THEME_COLORS.length],
      }));
  }

  get t7DonutGradient(): string {
    if (!this.t7GrandTotalHours) return 'conic-gradient(#e5e7eb 0% 100%)';
    const total = this.t7GrandTotalHours;
    let cumulative = 0;
    const segments = this.t7ByTheme.map(r => {
      const pct = (r.hours / total) * 100;
      const from = cumulative;
      cumulative += pct;
      return `${r.color} ${from.toFixed(2)}% ${cumulative.toFixed(2)}%`;
    });
    if (cumulative < 100) segments.push(`#e5e7eb ${cumulative.toFixed(2)}% 100%`);
    return `conic-gradient(${segments.join(', ')})`;
  }

  get hasActiveF7(): boolean { return !!(this.f7.yearFrom || this.f7.yearTo || this.f7.status || this.f7.type || this.f7.formationType); }
  resetF7(): void { this.f7 = emptyFilter(); }

  // ─────────────────────────────────────────────────────────────────
  // Tableau 8 — Par agrément centre
  // ─────────────────────────────────────────────────────────────────

  get t8List(): TrainingAccreditationDto[] { return this.applyFilter(this.filteredBase, this.f8); }

  get t8Rows(): CenterStatRow[] {
    const map = new Map<string, CenterStatRow>();
    for (const a of this.t8List) {
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

  get t8Total(): CenterStatRow {
    const rows = this.t8Rows;
    return {
      label: 'TOTAL',
      accepted: rows.reduce((s, r) => s + r.accepted, 0),
      refused:  rows.reduce((s, r) => s + r.refused,  0),
      received: rows.reduce((s, r) => s + r.received, 0),
      pending:  rows.reduce((s, r) => s + r.pending,  0),
      total:    rows.reduce((s, r) => s + r.total,    0),
    };
  }

  get t8MaxTotal(): number {
    const vals = this.t8Rows.map(r => r.total);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  t8BarW(count: number): string { return Math.round((count / this.t8MaxTotal) * 100) + '%'; }

  get hasActiveF8(): boolean { return !!(this.f8.yearFrom || this.f8.yearTo || this.f8.status || this.f8.type || this.f8.formationType); }
  resetF8(): void { this.f8 = emptyFilter(); }

  // ─────────────────────────────────────────────────────────────────
  // Utilitaires
  // ─────────────────────────────────────────────────────────────────

  pct(count: number, total: number): string {
    if (!total) return '0%';
    return ((count / total) * 100).toFixed(0) + '%';
  }

  readonly LICENSE_COLORS = ['#0e7a75', '#4d9c18', '#12a19a', '#b7c90d', '#065f5a', '#db2777', '#ca8a04', '#2e6310'];
  readonly THEME_COLORS   = ['#0e7a75', '#4d9c18', '#12a19a', '#b7c90d', '#065f5a', '#db2777', '#ca8a04', '#2e6310', '#6e7800', '#0a6d67'];

  private applyFilter(list: TrainingAccreditationDto[], f: AccFilter): TrainingAccreditationDto[] {
    return list.filter(a => {
      if (f.yearFrom && this.yearOf(a) < f.yearFrom) return false;
      if (f.yearTo   && this.yearOf(a) > f.yearTo)   return false;
      if (f.status && a.requestStatus !== f.status) return false;
      if (f.type === 'COMPLETE'    && a.type !== 'COMPLETE'    && a.type != null) return false;
      if (f.type === 'SUB_MODULES' && a.type !== 'SUB_MODULES') return false;
      if (f.formationType === 'initial'    && !a.initial)    return false;
      if (f.formationType === 'continuous' && !a.continuous) return false;
      return true;
    });
  }

  private groupByYear(list: TrainingAccreditationDto[]): StatusByYearRow[] {
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

  private yearOf(a: TrainingAccreditationDto): string {
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
            <Data ss:Type="String">Agréments formation — par année et statut</Data>
          </Cell>
        </Row>
        <Row ss:Height="18">
          <Cell ss:StyleID="subtitle" ss:MergeAcross="5">
            <Data ss:Type="String">Exporté le ${today} — ${yearRows.length} année(s) — ${yearTotal.total} agrément(s)</Data>
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

    // Sheet 2 — par phytolicence
    const licMap = new Map<string, number>();
    for (const a of this.filteredBase) {
      for (const lt of a.licenseTypeLabels ?? []) {
        licMap.set(lt, (licMap.get(lt) ?? 0) + 1);
      }
    }
    const licTotal = Array.from(licMap.values()).reduce((s, v) => s + v, 0);
    const licRows = Array.from(licMap.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([label, count]) => ({ label, count, pct: licTotal ? ((count / licTotal) * 100).toFixed(1) + '%' : '0%' }));
    const sheet2 = `<Worksheet ss:Name="Par phytolicence">
      <Table ss:DefaultRowHeight="18">
        <Column ss:Width="220"/><Column ss:Width="100"/><Column ss:Width="80"/>
        <Row ss:Height="28">
          <Cell ss:StyleID="title" ss:MergeAcross="2">
            <Data ss:Type="String">Agréments formation — par type de phytolicence</Data>
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

    // Sheet 3 — par thème
    const themeMap = new Map<string, number>();
    for (const a of this.filteredBase) {
      for (const t of a.themeLabels ?? []) {
        themeMap.set(t, (themeMap.get(t) ?? 0) + 1);
      }
    }
    const themeTotal = Array.from(themeMap.values()).reduce((s, v) => s + v, 0);
    const themeRows = Array.from(themeMap.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([label, count]) => ({ label, count, pct: themeTotal ? ((count / themeTotal) * 100).toFixed(1) + '%' : '0%' }));
    const sheet3 = `<Worksheet ss:Name="Par thème">
      <Table ss:DefaultRowHeight="18">
        <Column ss:Width="220"/><Column ss:Width="100"/><Column ss:Width="80"/>
        <Row ss:Height="28">
          <Cell ss:StyleID="title" ss:MergeAcross="2">
            <Data ss:Type="String">Agréments formation — par thème</Data>
          </Cell>
        </Row>
        <Row ss:Height="18">
          <Cell ss:StyleID="subtitle" ss:MergeAcross="2">
            <Data ss:Type="String">Exporté le ${today} — ${themeRows.length} thème(s) — ${themeTotal} occurrence(s)</Data>
          </Cell>
        </Row>
        <Row ss:Height="8"><Cell/></Row>
        <Row ss:Height="22">
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Thème</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Nombre</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Part (%)</Data></Cell>
        </Row>
        ${themeRows.map((r, i) => {
          const z = i % 2 === 1;
          return `<Row ss:Height="18">
            <Cell ss:StyleID="${z ? 'nameZ' : 'name'}"><Data ss:Type="String">${this.escapeXml(r.label)}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.count}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="String">${r.pct}</Data></Cell>
          </Row>`;
        }).join('\n')}
        <Row ss:Height="20">
          <Cell ss:StyleID="totalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${themeTotal}</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="String">100%</Data></Cell>
        </Row>
      </Table>
    </Worksheet>`;

    // Sheet 4 — par type d'agrément (COMPLETE vs SUB_MODULES)
    const allAcc = this.filteredBase;
    const t2ExpComplete   = allAcc.filter(a => a.type === 'COMPLETE' || !a.type).length;
    const t2ExpSubModules = allAcc.filter(a => a.type === 'SUB_MODULES').length;
    const t2ExpTotal      = allAcc.length;
    const t2Pct = (n: number) => t2ExpTotal ? ((n / t2ExpTotal) * 100).toFixed(1) + '%' : '0%';
    const sheet4 = `<Worksheet ss:Name="Type agrément">
      <Table ss:DefaultRowHeight="18">
        <Column ss:Width="200"/><Column ss:Width="100"/><Column ss:Width="80"/>
        <Row ss:Height="28">
          <Cell ss:StyleID="title" ss:MergeAcross="2">
            <Data ss:Type="String">Agréments formation — par type d'agrément</Data>
          </Cell>
        </Row>
        <Row ss:Height="18">
          <Cell ss:StyleID="subtitle" ss:MergeAcross="2">
            <Data ss:Type="String">Exporté le ${today} — ${t2ExpTotal} agrément(s)</Data>
          </Cell>
        </Row>
        <Row ss:Height="8"><Cell/></Row>
        <Row ss:Height="22">
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Type d'agrément</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Nombre</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Part (%)</Data></Cell>
        </Row>
        <Row ss:Height="18">
          <Cell ss:StyleID="name"><Data ss:Type="String">Agrément complet</Data></Cell>
          <Cell ss:StyleID="num"><Data ss:Type="Number">${t2ExpComplete}</Data></Cell>
          <Cell ss:StyleID="num"><Data ss:Type="String">${t2Pct(t2ExpComplete)}</Data></Cell>
        </Row>
        <Row ss:Height="18">
          <Cell ss:StyleID="nameZ"><Data ss:Type="String">Sous-modules</Data></Cell>
          <Cell ss:StyleID="numZ"><Data ss:Type="Number">${t2ExpSubModules}</Data></Cell>
          <Cell ss:StyleID="numZ"><Data ss:Type="String">${t2Pct(t2ExpSubModules)}</Data></Cell>
        </Row>
        <Row ss:Height="20">
          <Cell ss:StyleID="totalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${t2ExpTotal}</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="String">100%</Data></Cell>
        </Row>
      </Table>
    </Worksheet>`;

    // Sheet 5 — par type de formation (initiale / continue)
    const t3ExpInitial    = allAcc.filter(a => a.initial).length;
    const t3ExpContinuous = allAcc.filter(a => a.continuous).length;
    const t3ExpBoth       = allAcc.filter(a => a.initial && a.continuous).length;
    const t3ExpTotal      = allAcc.length;
    const t3Pct = (n: number) => t3ExpTotal ? ((n / t3ExpTotal) * 100).toFixed(1) + '%' : '0%';
    const sheet5 = `<Worksheet ss:Name="Type formation">
      <Table ss:DefaultRowHeight="18">
        <Column ss:Width="200"/><Column ss:Width="100"/><Column ss:Width="80"/>
        <Row ss:Height="28">
          <Cell ss:StyleID="title" ss:MergeAcross="2">
            <Data ss:Type="String">Agréments formation — par type de formation</Data>
          </Cell>
        </Row>
        <Row ss:Height="18">
          <Cell ss:StyleID="subtitle" ss:MergeAcross="2">
            <Data ss:Type="String">Exporté le ${today} — ${t3ExpTotal} agrément(s)</Data>
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
          <Cell ss:StyleID="num"><Data ss:Type="Number">${t3ExpInitial}</Data></Cell>
          <Cell ss:StyleID="num"><Data ss:Type="String">${t3Pct(t3ExpInitial)}</Data></Cell>
        </Row>
        <Row ss:Height="18">
          <Cell ss:StyleID="nameZ"><Data ss:Type="String">Continue</Data></Cell>
          <Cell ss:StyleID="numZ"><Data ss:Type="Number">${t3ExpContinuous}</Data></Cell>
          <Cell ss:StyleID="numZ"><Data ss:Type="String">${t3Pct(t3ExpContinuous)}</Data></Cell>
        </Row>
        <Row ss:Height="18">
          <Cell ss:StyleID="name"><Data ss:Type="String">Les deux</Data></Cell>
          <Cell ss:StyleID="num"><Data ss:Type="Number">${t3ExpBoth}</Data></Cell>
          <Cell ss:StyleID="num"><Data ss:Type="String">${t3Pct(t3ExpBoth)}</Data></Cell>
        </Row>
        <Row ss:Height="20">
          <Cell ss:StyleID="totalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${t3ExpTotal}</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="String">100%</Data></Cell>
        </Row>
      </Table>
    </Worksheet>`;

    // Sheet 6 — par thème et sous-thème (détail)
    const tsMap = new Map<string, { theme: string; subTheme: string; count: number }>();
    for (const a of allAcc) {
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
    const sheet6 = `<Worksheet ss:Name="Thème et sous-thème">
      <Table ss:DefaultRowHeight="18">
        <Column ss:Width="200"/><Column ss:Width="200"/><Column ss:Width="100"/><Column ss:Width="80"/>
        <Row ss:Height="28">
          <Cell ss:StyleID="title" ss:MergeAcross="3">
            <Data ss:Type="String">Agréments formation — par thème et sous-thème</Data>
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

    // Sheet 7 — croisement type × phytolicence
    const t6ExpMap = new Map<string, { complete: number; subModules: number }>();
    for (const a of allAcc) {
      for (const lt of a.licenseTypeLabels ?? []) {
        if (!t6ExpMap.has(lt)) t6ExpMap.set(lt, { complete: 0, subModules: 0 });
        const row = t6ExpMap.get(lt)!;
        if (a.type === 'SUB_MODULES') row.subModules++;
        else row.complete++;
      }
    }
    const t6ExpRows = Array.from(t6ExpMap.entries())
      .map(([license, d]) => ({ license, complete: d.complete, subModules: d.subModules, total: d.complete + d.subModules }))
      .sort((a, b) => b.total - a.total);
    const t6ExpTotal = {
      complete:   t6ExpRows.reduce((s, r) => s + r.complete,   0),
      subModules: t6ExpRows.reduce((s, r) => s + r.subModules, 0),
      total:      t6ExpRows.reduce((s, r) => s + r.total,      0),
    };
    const sheet7 = `<Worksheet ss:Name="Type × phytolicence">
      <Table ss:DefaultRowHeight="18">
        <Column ss:Width="200"/><Column ss:Width="100"/><Column ss:Width="100"/><Column ss:Width="80"/><Column ss:Width="80"/>
        <Row ss:Height="28">
          <Cell ss:StyleID="title" ss:MergeAcross="4">
            <Data ss:Type="String">Agréments formation — croisement type × phytolicence</Data>
          </Cell>
        </Row>
        <Row ss:Height="18">
          <Cell ss:StyleID="subtitle" ss:MergeAcross="4">
            <Data ss:Type="String">Exporté le ${today} — ${t6ExpRows.length} phytolicence(s)</Data>
          </Cell>
        </Row>
        <Row ss:Height="8"><Cell/></Row>
        <Row ss:Height="22">
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Phytolicence</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Complet</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Sous-modules</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Total</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">% Complet</Data></Cell>
        </Row>
        ${t6ExpRows.map((r, i) => {
          const z = i % 2 === 1;
          const pct = r.total ? ((r.complete / r.total) * 100).toFixed(1) + '%' : '0%';
          return `<Row ss:Height="18">
          <Cell ss:StyleID="${z ? 'nameZ' : 'name'}"><Data ss:Type="String">${this.escapeXml(r.license)}</Data></Cell>
          <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.complete}</Data></Cell>
          <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.subModules}</Data></Cell>
          <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.total}</Data></Cell>
          <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="String">${pct}</Data></Cell>
        </Row>`;
        }).join('\n')}
        <Row ss:Height="20">
          <Cell ss:StyleID="totalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${t6ExpTotal.complete}</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${t6ExpTotal.subModules}</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${t6ExpTotal.total}</Data></Cell>
          <Cell ss:StyleID="totalNum"><Data ss:Type="String">${t6ExpTotal.total ? ((t6ExpTotal.complete / t6ExpTotal.total) * 100).toFixed(1) + '%' : '0%'}</Data></Cell>
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
  ${sheet6}
  ${sheet7}
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    this.triggerDownload(blob, `agréments-formation-statistiques-${today}.xls`);
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
      pdf.save(`agréments-formation-statistiques-${today}.pdf`);
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
