import { Component, OnInit, ViewChild, ElementRef, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../../../shared/shared-imports';
import { TrainingActivityApi, TrainingActivityDto } from '../../api/training-activity.api';
import { ToastService } from '../../../../shared/toast/toast.service';

interface Filters {
  sector: string;
  theme: string;
  licenseType: string;
  province: string;
  mode: string;   // '' | 'online' | 'onsite'
  type: string;   // '' | 'initial' | 'continuous'
  pilotCenter: string;
  centerAccreditation: string;
}

interface StatsRow {
  label: string;
  count: number;
  participants: number;
  avg: string;
}

interface ThemeSubThemeRow {
  theme: string;
  subTheme: string;
  count: number;
  participants: number;
  totalHours: number;
}

interface HourBucketRow {
  bucket: string;
  count: number;
  pct: string;
}

function emptyFilters(): Filters {
  return { sector: '', theme: '', licenseType: '', province: '', mode: '', type: '', pilotCenter: '', centerAccreditation: '' };
}

@Component({
  selector: 'app-training-activity-stats',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './training-activity-stats.html',
  styleUrl: './training-activity-stats.css',
})
export class TrainingActivityStats implements OnInit {
  @ViewChild('statsContent') statsRef!: ElementRef<HTMLElement>;

  loading = true;
  error: string | null = null;
  exporting = false;

  private allActivities: TrainingActivityDto[] = [];

  filterArchived: 'active' | 'archived' | 'all' = 'active';

  /** Filtres Tableau 1 (vue par année, sans filtre année) */
  f1: Filters = emptyFilters();

  /** Filtres Tableaux 2 & 3 (partagés) */
  f23: Filters = emptyFilters();
  f23YearFrom = ''; f23YearTo = '';
  f23Year = '';

  /** Filtres Tableau 4 — par centre */
  f4: Filters = emptyFilters();
  f4YearFrom = ''; f4YearTo = '';

  /** Filtres Tableau 5 — par province */
  f5: Filters = emptyFilters();
  f5YearFrom = ''; f5YearTo = '';

  /** Filtres Tableau 6 — par centre de formation (agrément centre) */
  f6: Filters = emptyFilters();
  f6YearFrom = ''; f6YearTo = '';

  /** Filtres Tableau 8 — par type de formation */
  f8: Filters = emptyFilters();
  f8YearFrom = ''; f8YearTo = '';

  /** Filtres Tableau 9 — par secteur */
  f9: Filters = emptyFilters();
  f9YearFrom = ''; f9YearTo = '';

  /** Filtres Tableau 10 — par mode de présence */
  f10: Filters = emptyFilters();
  f10YearFrom = ''; f10YearTo = '';

  /** Filtres Tableau 11 — ratio participants/activité par centre */
  f11: Filters = emptyFilters();
  f11YearFrom = ''; f11YearTo = '';

  /** Filtres Tableau 12 — CP / Sans CP */
  f12: Filters = emptyFilters();
  f12YearFrom = ''; f12YearTo = '';

  /** Filtres Tableau 13 — par thème / sous-thème */
  f13: Filters = emptyFilters();
  f13YearFrom = ''; f13YearTo = '';
  f13SubThemes: string[] = [];
  t13ChartMode: 'theme' | 'subtheme' = 'theme';

  /** Filtres Tableau 7 — par type de phytolicence */
  f7: Filters = emptyFilters();
  f7YearFrom = ''; f7YearTo = '';

  /** Filtres Tableau 14 — distribution horaire */
  f14: Filters = emptyFilters();
  f14YearFrom = ''; f14YearTo = '';

  /** Tableau 15 — évolution mensuelle : sélecteur d'année */
  t15Year = String(new Date().getFullYear());

  readonly MONTHS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];

  readonly COLORS = [
    '#0e7a75', '#4d9c18', '#12a19a', '#b7c90d', '#065f5a',
    '#2e6310', '#6e7800', '#0a6d67', '#84cc16', '#e7f39a',
  ];

  private toast = inject(ToastService);

  constructor(private api: TrainingActivityApi) {}

  ngOnInit(): void {
    this.api.findAll().subscribe({
      next: (data) => {
        this.allActivities = data ?? [];
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger les activités de formation.';
        this.loading = false;
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Base filtrée selon le filtre actif/archivé global
  // ─────────────────────────────────────────────────────────────────

  get filteredItems(): TrainingActivityDto[] {
    if (this.filterArchived === 'active')   return this.allActivities.filter(a => !a.archived);
    if (this.filterArchived === 'archived') return this.allActivities.filter(a => !!a.archived);
    return this.allActivities;
  }

  // ─────────────────────────────────────────────────────────────────
  // Options de filtres (calculées depuis toutes les données)
  // ─────────────────────────────────────────────────────────────────

  get availableYears(): string[] {
    const s = new Set<string>();
    for (const a of this.filteredItems) {
      const y = this.yearOf(a);
      if (y) s.add(y);
    }
    return Array.from(s).sort();
  }

  get availableSectors(): string[] {
    return this.uniqueLabels(a => a.sectorLabels);
  }

  get availableThemes(): string[] {
    return this.uniqueLabels(a => a.themeLabels);
  }

  get availableLicenseTypes(): string[] {
    return this.uniqueLabels(a => a.licenseTypeLabels);
  }

  get availableProvinces(): string[] {
    const s = new Set<string>();
    for (const a of this.allActivities) {
      if (a.province) s.add(a.province);
    }
    return Array.from(s).sort();
  }

  get availablePilotCenters(): string[] {
    return this.uniqueLabels(a => a.pilotCenterLabels);
  }

  get availableSubThemes(): string[] {
    return this.uniqueLabels(a => a.subThemeLabels);
  }

  get availableCenterAccreditations(): string[] {
    const s = new Set<string>();
    for (const a of this.allActivities) {
      if (a.centerAccreditationLabel) s.add(a.centerAccreditationLabel);
    }
    return Array.from(s).sort();
  }

  private uniqueLabels(fn: (a: TrainingActivityDto) => string[] | null | undefined): string[] {
    const s = new Set<string>();
    for (const a of this.allActivities) {
      for (const v of fn(a) ?? []) s.add(v);
    }
    return Array.from(s).sort();
  }

  // ─────────────────────────────────────────────────────────────────
  // KPIs (données brutes, aucun filtre)
  // ─────────────────────────────────────────────────────────────────

  get kpiTotal(): number {
    return this.filteredItems.length;
  }

  get kpiParticipants(): number {
    return this.filteredItems.reduce((s, a) => s + (a.numberOfParticipants ?? 0), 0);
  }

  get kpiAvg(): string {
    if (this.kpiTotal === 0) return '—';
    return (this.kpiParticipants / this.kpiTotal).toFixed(1);
  }

  get kpiOnlinePct(): string {
    if (this.kpiTotal === 0) return '—';
    const n = this.filteredItems.filter(a => a.online).length;
    return ((n / this.kpiTotal) * 100).toFixed(0) + '%';
  }

  // ─────────────────────────────────────────────────────────────────
  // Lignes des tableaux
  // ─────────────────────────────────────────────────────────────────

  /** Tableau 1 — par année, filtres contextuels (sans filtre année) */
  get t1Rows(): StatsRow[] {
    return this.groupByYear(this.applyFilters(this.filteredItems, this.f1));
  }
  get t1Total(): StatsRow { return this.totalOf(this.t1Rows); }

  /** Tableau 2 — par année, filtres f23 + filtre plage d'années */
  get t2Rows(): StatsRow[] {
    const rows = this.groupByYear(this.applyFilters(this.filteredItems, this.f23));
    return rows.filter(r =>
      (!this.f23YearFrom || r.label >= this.f23YearFrom) &&
      (!this.f23YearTo   || r.label <= this.f23YearTo)
    );
  }
  get t2Total(): StatsRow { return this.totalOf(this.t2Rows); }

  /** Tableau 3 — par mois (seulement si une année est sélectionnée) */
  get t3Rows(): StatsRow[] {
    if (!this.f23Year) return [];
    return this.groupByMonth(this.applyFilters(this.filteredItems, this.f23, this.f23Year, this.f23Year));
  }
  get t3Total(): StatsRow { return this.totalOf(this.t3Rows); }

  get hasActiveF1(): boolean {
    const f = this.f1;
    return !!(f.sector || f.theme || f.licenseType || f.province || f.mode || f.type);
  }

  get hasActiveF23(): boolean {
    const f = this.f23;
    return !!((this.f23YearFrom || this.f23YearTo) || f.theme || f.licenseType || f.province || f.mode || f.type || f.pilotCenter || f.centerAccreditation);
  }

  resetF1(): void { this.f1 = emptyFilters(); }
  resetF23(): void { this.f23 = emptyFilters(); this.f23YearFrom = ''; this.f23YearTo = ''; this.f23Year = ''; }
  resetF4(): void { this.f4 = emptyFilters(); this.f4YearFrom = ''; this.f4YearTo = ''; }
  resetF5(): void { this.f5 = emptyFilters(); this.f5YearFrom = ''; this.f5YearTo = ''; }
  resetF6(): void { this.f6 = emptyFilters(); this.f6YearFrom = ''; this.f6YearTo = ''; }
  resetF7(): void { this.f7 = emptyFilters(); this.f7YearFrom = ''; this.f7YearTo = ''; }
  resetF8(): void { this.f8 = emptyFilters(); this.f8YearFrom = ''; this.f8YearTo = ''; }
  resetF9(): void { this.f9 = emptyFilters(); this.f9YearFrom = ''; this.f9YearTo = ''; }
  resetF10(): void { this.f10 = emptyFilters(); this.f10YearFrom = ''; this.f10YearTo = ''; }
  resetF11(): void { this.f11 = emptyFilters(); this.f11YearFrom = ''; this.f11YearTo = ''; }
  resetF12(): void { this.f12 = emptyFilters(); this.f12YearFrom = ''; this.f12YearTo = ''; }
  resetF13(): void { this.f13 = emptyFilters(); this.f13YearFrom = ''; this.f13YearTo = ''; this.f13SubThemes = []; }

  /** Tableau 8 — par type de formation (initiale / continue) */
  get t8Rows(): StatsRow[] {
    return this.groupByFormationType(this.applyFilters(this.filteredItems, this.f8, this.f8YearFrom, this.f8YearTo));
  }
  get t8Total(): StatsRow { return this.totalOf(this.t8Rows); }

  /** Tableau 9 — par secteur */
  get t9Rows(): StatsRow[] {
    return this.groupBySector(this.applyFilters(this.filteredItems, this.f9, this.f9YearFrom, this.f9YearTo));
  }
  get t9Total(): StatsRow { return this.totalOf(this.t9Rows); }

  /** Tableau 10 — par mode de présence (en ligne / présentiel / en ligne + adresse) */
  get t10Rows(): StatsRow[] {
    return this.groupByPresenceMode(this.applyFilters(this.filteredItems, this.f10, this.f10YearFrom, this.f10YearTo));
  }
  get t10Total(): StatsRow { return this.totalOf(this.t10Rows); }

  /** Tableau 12 — CP (phytodama) / Sans CP */
  get t12Rows(): StatsRow[] {
    return this.groupByPhytodama(this.applyFilters(this.filteredItems, this.f12, this.f12YearFrom, this.f12YearTo));
  }
  get t12Total(): StatsRow { return this.totalOf(this.t12Rows); }

  /** Tableau 11 — ratio participants / activité par centre de formation, trié par ratio desc */
  get t11Rows(): StatsRow[] {
    return this.groupByCenterAccreditation(
      this.applyFilters(this.filteredItems, this.f11, this.f11YearFrom, this.f11YearTo)
    ).sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg));
  }
  get t11Total(): StatsRow { return this.totalOf(this.t11Rows); }

  get hasActiveF8(): boolean {
    const f = this.f8;
    return !!((this.f8YearFrom || this.f8YearTo) || f.pilotCenter || f.centerAccreditation || f.licenseType || f.province || f.mode);
  }
  get hasActiveF9(): boolean {
    const f = this.f9;
    return !!((this.f9YearFrom || this.f9YearTo) || f.pilotCenter || f.centerAccreditation || f.licenseType || f.province || f.mode || f.type);
  }
  get hasActiveF10(): boolean {
    const f = this.f10;
    return !!((this.f10YearFrom || this.f10YearTo) || f.pilotCenter || f.centerAccreditation || f.licenseType || f.type);
  }
  get hasActiveF11(): boolean {
    const f = this.f11;
    return !!((this.f11YearFrom || this.f11YearTo) || f.pilotCenter || f.centerAccreditation || f.licenseType || f.province || f.mode || f.type);
  }
  get hasActiveF12(): boolean {
    const f = this.f12;
    return !!((this.f12YearFrom || this.f12YearTo) || f.sector || f.centerAccreditation || f.licenseType || f.province || f.mode || f.type);
  }

  /** Tableau 13 — par thème / sous-thème */
  get t13Rows(): ThemeSubThemeRow[] {
    let items = this.applyFilters(this.filteredItems, this.f13, this.f13YearFrom, this.f13YearTo);
    if (this.f13SubThemes.length > 0) {
      items = items.filter(a => this.f13SubThemes.some(st => (a.subThemeLabels ?? []).includes(st)));
    }
    return this.groupByThemeSubTheme(items);
  }
  get t13Total(): ThemeSubThemeRow {
    const rows = this.t13Rows;
    return {
      theme: 'TOTAL',
      subTheme: '',
      count: rows.reduce((s, r) => s + r.count, 0),
      participants: rows.reduce((s, r) => s + r.participants, 0),
      totalHours: rows.reduce((s, r) => s + r.totalHours, 0),
    };
  }
  get hasActiveF13(): boolean {
    const f = this.f13;
    return !!((this.f13YearFrom || this.f13YearTo) || f.sector || f.licenseType || f.province || f.mode || f.type || f.pilotCenter || f.centerAccreditation || this.f13SubThemes.length > 0);
  }

  /** Tableau 13 — agrégation par thème (pour le graphique) */
  get t13ByTheme(): Array<{ theme: string; count: number; participants: number; totalHours: number }> {
    const map = new Map<string, { count: number; participants: number; totalHours: number }>();
    for (const r of this.t13Rows) {
      if (!map.has(r.theme)) map.set(r.theme, { count: 0, participants: 0, totalHours: 0 });
      const g = map.get(r.theme)!;
      g.count += r.count;
      g.participants += r.participants;
      g.totalHours += r.totalHours;
    }
    return Array.from(map.entries())
      .map(([theme, d]) => ({ theme, ...d }))
      .sort((a, b) => b.totalHours - a.totalHours);
  }

  // ── T13 : donut volume horaire par thème ─────────────────────────
  get t13DonutItems(): Array<{ label: string; count: number; color: string }> {
    return this.makeDonutItems(
      this.t13ByTheme.map(r => ({ label: r.theme, count: r.totalHours, participants: 0, avg: '' }))
    );
  }
  get t13DonutGradient(): string {
    return this.makeDonutGradient(this.t13DonutItems, this.t13Total.totalHours);
  }
  get t13DonutLabels() {
    return this.makeDonutLabels(this.t13DonutItems, this.t13Total.totalHours);
  }

  /** Données du graphique selon le mode sélectionné */
  get t13ChartRows(): Array<{ theme: string; subTheme?: string; count: number; participants: number; totalHours: number }> {
    if (this.t13ChartMode === 'subtheme') {
      return this.t13Rows
        .map(r => ({ theme: r.theme, subTheme: r.subTheme, count: r.count, participants: r.participants, totalHours: r.totalHours }))
        .sort((a, b) => b.totalHours - a.totalHours);
    }
    return this.t13ByTheme;
  }

  get t13MaxHours(): number {
    const vals = this.t13ChartRows.map(r => r.totalHours);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  get t13MaxCount(): number {
    const vals = this.t13ChartRows.map(r => r.count);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  t13HoursBarW(h: number): string {
    return Math.round((h / this.t13MaxHours) * 100) + '%';
  }
  t13CountBarW(c: number): string {
    return Math.round((c / this.t13MaxCount) * 100) + '%';
  }
  t13HoursPct(h: number): string {
    const total = this.t13Total.totalHours;
    if (!total) return '0%';
    return ((h / total) * 100).toFixed(1) + '%';
  }

  /** Tableau 4 — par centre pilote */
  get t4Rows(): StatsRow[] {
    return this.groupByCenter(this.applyFilters(this.filteredItems, this.f4, this.f4YearFrom, this.f4YearTo));
  }
  get t4Total(): StatsRow { return this.totalOf(this.t4Rows); }

  /** Tableau 5 — par province */
  get t5Rows(): StatsRow[] {
    return this.groupByProvince(this.applyFilters(this.filteredItems, this.f5, this.f5YearFrom, this.f5YearTo));
  }
  get t5Total(): StatsRow { return this.totalOf(this.t5Rows); }

  get hasActiveF4(): boolean {
    const f = this.f4;
    return !!((this.f4YearFrom || this.f4YearTo) || f.centerAccreditation || f.theme || f.licenseType || f.province || f.mode || f.type);
  }
  get hasActiveF5(): boolean {
    const f = this.f5;
    return !!((this.f5YearFrom || this.f5YearTo) || f.pilotCenter || f.centerAccreditation || f.licenseType || f.province || f.mode || f.type);
  }

  /** Tableau 6 — par centre de formation (agrément centre) */
  get t6Rows(): StatsRow[] {
    return this.groupByCenterAccreditation(this.applyFilters(this.filteredItems, this.f6, this.f6YearFrom, this.f6YearTo));
  }
  get t6Total(): StatsRow { return this.totalOf(this.t6Rows); }

  /** Tableau 7 — par type de phytolicence */
  get t7Rows(): StatsRow[] {
    return this.groupByLicenseType(this.applyFilters(this.filteredItems, this.f7, this.f7YearFrom, this.f7YearTo));
  }
  get t7Total(): StatsRow { return this.totalOf(this.t7Rows); }

  get hasActiveF6(): boolean {
    const f = this.f6;
    return !!((this.f6YearFrom || this.f6YearTo) || f.pilotCenter || f.centerAccreditation || f.licenseType || f.province || f.mode || f.type);
  }
  get hasActiveF7(): boolean {
    const f = this.f7;
    return !!((this.f7YearFrom || this.f7YearTo) || f.pilotCenter || f.centerAccreditation || f.province || f.mode || f.type);
  }

  // ─────────────────────────────────────────────────────────────────
  // Tableau 14 — Distribution horaire
  // ─────────────────────────────────────────────────────────────────

  get t14List(): TrainingActivityDto[] {
    return this.applyFilters(this.filteredItems, this.f14, this.f14YearFrom, this.f14YearTo);
  }

  private get t14WithDuration(): TrainingActivityDto[] {
    return this.t14List.filter(a => a.durationHours != null && a.durationHours > 0);
  }

  get t14Count(): number    { return this.t14List.length; }
  get t14WithDurationCount(): number { return this.t14WithDuration.length; }
  get t14MissingCount(): number { return this.t14List.filter(a => !a.durationHours).length; }

  get t14TotalHours(): number {
    return this.t14WithDuration.reduce((s, a) => s + (a.durationHours ?? 0), 0);
  }

  get t14AvgHours(): string {
    const items = this.t14WithDuration;
    if (!items.length) return '—';
    return (this.t14TotalHours / items.length).toFixed(1);
  }

  get t14MinHours(): number | null {
    const items = this.t14WithDuration;
    return items.length ? Math.min(...items.map(a => a.durationHours!)) : null;
  }

  get t14MaxHours(): number | null {
    const items = this.t14WithDuration;
    return items.length ? Math.max(...items.map(a => a.durationHours!)) : null;
  }

  get t14BucketRows(): HourBucketRow[] {
    const items = this.t14WithDuration;
    const total = items.length;
    const buckets = [
      { bucket: '0 – 2h',   min: 0,  max: 2        },
      { bucket: '2 – 4h',   min: 2,  max: 4        },
      { bucket: '4 – 8h',   min: 4,  max: 8        },
      { bucket: '8 – 16h',  min: 8,  max: 16       },
      { bucket: '> 16h',    min: 16, max: Infinity  },
    ];
    return buckets.map(b => {
      const count = items.filter(a => a.durationHours! >= b.min && a.durationHours! < b.max).length;
      return { bucket: b.bucket, count, pct: total ? ((count / total) * 100).toFixed(1) + '%' : '0%' };
    });
  }

  get t14MaxBucketCount(): number {
    return Math.max(1, ...this.t14BucketRows.map(r => r.count));
  }
  t14BarW(count: number): string { return Math.round((count / this.t14MaxBucketCount) * 100) + '%'; }

  get hasActiveF14(): boolean {
    const f = this.f14;
    return !!((this.f14YearFrom || this.f14YearTo) || f.pilotCenter || f.centerAccreditation || f.theme || f.licenseType || f.province || f.mode || f.type);
  }
  resetF14(): void { this.f14 = emptyFilters(); this.f14YearFrom = ''; this.f14YearTo = ''; }

  // ─────────────────────────────────────────────────────────────────
  // Tableau 15 — Évolution mensuelle
  // ─────────────────────────────────────────────────────────────────

  get t15Rows(): StatsRow[] {
    const activities = this.applyFilters(this.filteredItems, emptyFilters(), this.t15Year, this.t15Year);
    const byMonth = new Map<number, { count: number; participants: number }>();
    for (const a of activities) {
      const m = this.monthOf(a);
      if (m === null) continue;
      if (!byMonth.has(m)) byMonth.set(m, { count: 0, participants: 0 });
      const r = byMonth.get(m)!;
      r.count++;
      r.participants += a.numberOfParticipants ?? 0;
    }
    return this.MONTHS.map((name, i) => {
      const d = byMonth.get(i + 1) ?? { count: 0, participants: 0 };
      return this.makeRow(name, d.count, d.participants);
    });
  }

  get t15Total(): StatsRow { return this.totalOf(this.t15Rows); }

  get t15MaxCount(): number { return Math.max(1, ...this.t15Rows.map(r => r.count)); }

  t15BarH(count: number): string {
    return Math.round((count / this.t15MaxCount) * 120) + 'px';
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers de calcul
  // ─────────────────────────────────────────────────────────────────

  private applyFilters(
    activities: TrainingActivityDto[],
    f: Filters,
    yearFrom = '',
    yearTo = '',
  ): TrainingActivityDto[] {
    return activities.filter(a => {
      if (yearFrom && this.yearOf(a) < yearFrom) return false;
      if (yearTo   && this.yearOf(a) > yearTo)   return false;
      if (f.sector && !(a.sectorLabels ?? []).includes(f.sector)) return false;
      if (f.theme && !(a.themeLabels ?? []).includes(f.theme)) return false;
      if (f.licenseType && !(a.licenseTypeLabels ?? []).includes(f.licenseType)) return false;
      if (f.province && a.province !== f.province) return false;
      if (f.mode === 'online' && !a.online) return false;
      if (f.mode === 'onsite' && !!a.online) return false;
      if (f.type === 'initial' && !a.initial) return false;
      if (f.type === 'continuous' && !a.continuous) return false;
      if (f.pilotCenter === '__none__' && (a.pilotCenterLabels ?? []).length > 0) return false;
      else if (f.pilotCenter && f.pilotCenter !== '__none__' && !(a.pilotCenterLabels ?? []).includes(f.pilotCenter)) return false;
      if (f.centerAccreditation && a.centerAccreditationLabel !== f.centerAccreditation) return false;
      return true;
    });
  }

  private groupByYear(activities: TrainingActivityDto[]): StatsRow[] {
    const map = new Map<string, { count: number; participants: number }>();
    for (const a of activities) {
      const y = this.yearOf(a);
      if (!y) continue;
      if (!map.has(y)) map.set(y, { count: 0, participants: 0 });
      const r = map.get(y)!;
      r.count++;
      r.participants += a.numberOfParticipants ?? 0;
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, d]) => this.makeRow(label, d.count, d.participants));
  }

  private groupByMonth(activities: TrainingActivityDto[]): StatsRow[] {
    const map = new Map<number, { count: number; participants: number }>();
    for (const a of activities) {
      const m = this.monthOf(a);
      if (m === null) continue;
      if (!map.has(m)) map.set(m, { count: 0, participants: 0 });
      const r = map.get(m)!;
      r.count++;
      r.participants += a.numberOfParticipants ?? 0;
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([m, d]) => this.makeRow(this.MONTHS[m - 1], d.count, d.participants));
  }

  private groupByPhytodama(activities: TrainingActivityDto[]): StatsRow[] {
    const withCP    = activities.filter(a => (a.pilotCenterLabels ?? []).length > 0);
    const withoutCP = activities.filter(a => (a.pilotCenterLabels ?? []).length === 0);
    const rows: StatsRow[] = [];
    if (withCP.length > 0)
      rows.push(this.makeRow('Avec CP', withCP.length,
        withCP.reduce((s, a) => s + (a.numberOfParticipants ?? 0), 0)));
    if (withoutCP.length > 0)
      rows.push(this.makeRow('Sans CP', withoutCP.length,
        withoutCP.reduce((s, a) => s + (a.numberOfParticipants ?? 0), 0)));
    return rows.sort((a, b) => b.count - a.count);
  }

  private groupByPresenceMode(activities: TrainingActivityDto[]): StatsRow[] {
    const hasAddress = (a: TrainingActivityDto) => !!(a.ville || a.street);
    const online    = activities.filter(a =>  !!a.online && !hasAddress(a));
    const onsite    = activities.filter(a => !a.online);
    const hybrid    = activities.filter(a =>  !!a.online &&  hasAddress(a));
    const rows: StatsRow[] = [];
    if (online.length > 0)
      rows.push(this.makeRow('En ligne', online.length,
        online.reduce((s, a) => s + (a.numberOfParticipants ?? 0), 0)));
    if (onsite.length > 0)
      rows.push(this.makeRow('Présentiel', onsite.length,
        onsite.reduce((s, a) => s + (a.numberOfParticipants ?? 0), 0)));
    if (hybrid.length > 0)
      rows.push(this.makeRow('Bi-modal', hybrid.length,
        hybrid.reduce((s, a) => s + (a.numberOfParticipants ?? 0), 0)));
    return rows.sort((a, b) => b.count - a.count);
  }

  private groupByFormationType(activities: TrainingActivityDto[]): StatsRow[] {
    const rows: StatsRow[] = [];
    const initial = activities.filter(a => a.initial);
    const continuous = activities.filter(a => a.continuous);
    if (initial.length > 0)
      rows.push(this.makeRow('Initiale', initial.length,
        initial.reduce((s, a) => s + (a.numberOfParticipants ?? 0), 0)));
    if (continuous.length > 0)
      rows.push(this.makeRow('Continue', continuous.length,
        continuous.reduce((s, a) => s + (a.numberOfParticipants ?? 0), 0)));
    return rows.sort((a, b) => b.count - a.count);
  }

  private groupBySector(activities: TrainingActivityDto[]): StatsRow[] {
    const map = new Map<string, { count: number; participants: number }>();
    for (const a of activities) {
      for (const s of a.sectorLabels ?? []) {
        if (!map.has(s)) map.set(s, { count: 0, participants: 0 });
        const r = map.get(s)!;
        r.count++;
        r.participants += a.numberOfParticipants ?? 0;
      }
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([label, d]) => this.makeRow(label, d.count, d.participants));
  }

  private groupByCenterAccreditation(activities: TrainingActivityDto[]): StatsRow[] {
    const map = new Map<string, { count: number; participants: number }>();
    for (const a of activities) {
      const label = a.centerAccreditationLabel || 'Non défini';
      if (!map.has(label)) map.set(label, { count: 0, participants: 0 });
      const r = map.get(label)!;
      r.count++;
      r.participants += a.numberOfParticipants ?? 0;
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([label, d]) => this.makeRow(label, d.count, d.participants));
  }

  private groupByLicenseType(activities: TrainingActivityDto[]): StatsRow[] {
    const map = new Map<string, { count: number; participants: number }>();
    for (const a of activities) {
      for (const lt of a.licenseTypeLabels ?? []) {
        if (!map.has(lt)) map.set(lt, { count: 0, participants: 0 });
        const r = map.get(lt)!;
        r.count++;
        r.participants += a.numberOfParticipants ?? 0;
      }
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([label, d]) => this.makeRow(label, d.count, d.participants));
  }

  private groupByCenter(activities: TrainingActivityDto[]): StatsRow[] {
    const map = new Map<string, { count: number; participants: number }>();
    for (const a of activities) {
      for (const c of a.pilotCenterLabels ?? []) {
        if (!map.has(c)) map.set(c, { count: 0, participants: 0 });
        const r = map.get(c)!;
        r.count++;
        r.participants += a.numberOfParticipants ?? 0;
      }
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([label, d]) => this.makeRow(label, d.count, d.participants));
  }

  private groupByProvince(activities: TrainingActivityDto[]): StatsRow[] {
    const map = new Map<string, { count: number; participants: number }>();
    for (const a of activities) {
      const p = a.province || 'Non défini';
      if (!map.has(p)) map.set(p, { count: 0, participants: 0 });
      const r = map.get(p)!;
      r.count++;
      r.participants += a.numberOfParticipants ?? 0;
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([label, d]) => this.makeRow(label, d.count, d.participants));
  }

  private groupByThemeSubTheme(activities: TrainingActivityDto[]): ThemeSubThemeRow[] {
    const map = new Map<string, ThemeSubThemeRow>();
    for (const a of activities) {
      const themes = a.themeLabels?.length ? a.themeLabels : ['—'];
      const subThemes = a.subThemeLabels?.length ? a.subThemeLabels : ['—'];
      for (const theme of themes) {
        for (const subTheme of subThemes) {
          const key = `${theme}||${subTheme}`;
          if (!map.has(key)) {
            map.set(key, { theme, subTheme, count: 0, participants: 0, totalHours: 0 });
          }
          const row = map.get(key)!;
          row.count++;
          row.participants += a.numberOfParticipants ?? 0;
          row.totalHours += a.durationHours ?? 0;
        }
      }
    }
    return Array.from(map.values())
      .sort((a, b) => a.theme.localeCompare(b.theme) || a.subTheme.localeCompare(b.subTheme));
  }

  private makeRow(label: string, count: number, participants: number): StatsRow {
    return {
      label,
      count,
      participants,
      avg: count > 0 ? (participants / count).toFixed(1) : '—',
    };
  }

  private totalOf(rows: StatsRow[]): StatsRow {
    const count = rows.reduce((s, r) => s + r.count, 0);
    const parts = rows.reduce((s, r) => s + r.participants, 0);
    return this.makeRow('TOTAL', count, parts);
  }

  private yearOf(a: TrainingActivityDto): string {
    if (!a.startDate) return '';
    return String(new Date(a.startDate).getFullYear());
  }

  private monthOf(a: TrainingActivityDto): number | null {
    if (!a.startDate) return null;
    return new Date(a.startDate).getMonth() + 1;
  }

  // ─────────────────────────────────────────────────────────────────
  // Getters pour les graphiques
  // ─────────────────────────────────────────────────────────────────

  // ── T1 : barres verticales + ligne de tendance moy. participants ──
  get t1MaxCount(): number {
    const vals = this.t1Rows.map(r => r.count);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  t1BarHF(count: number): string {
    return Math.round((count / this.t1MaxCount) * 100) + '%';
  }
  get t1TrendPoints(): string {
    const rows = this.t1Rows;
    if (rows.length < 2) return '';
    const n = rows.length;
    const avgs = rows.map(r => parseFloat(r.avg) || 0);
    const maxAvg = Math.max(...avgs, 0.1);
    return rows.map((r, i) => {
      const x = ((i + 0.5) / n) * 100;
      const avg = parseFloat(r.avg) || 0;
      const y = 12 + (1 - avg / maxAvg) * 76;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }
  get t1TrendCircles(): { cx: string; cy: string; avg: string }[] {
    const rows = this.t1Rows;
    if (!rows.length) return [];
    const n = rows.length;
    const avgs = rows.map(r => parseFloat(r.avg) || 0);
    const maxAvg = Math.max(...avgs, 0.1);
    return rows.map((r, i) => {
      const cx = ((i + 0.5) / n) * 100;
      const avg = parseFloat(r.avg) || 0;
      const cy = 12 + (1 - avg / maxAvg) * 76;
      return { cx: cx.toFixed(1), cy: cy.toFixed(1), avg: r.avg };
    });
  }

  // ── T2 : barres horizontales ──────────────────────────────────────
  get t2MaxCount(): number {
    const vals = this.t2Rows.map(r => r.count);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  t2BarW(count: number): string {
    return Math.round((count / this.t2MaxCount) * 100) + '%';
  }
  t2Pct(count: number): string {
    const total = this.t2Total.count;
    if (!total) return '0%';
    return ((count / total) * 100).toFixed(1) + '%';
  }

  // ── T4 : barres horizontales par centre ──────────────────────────
  get t4MaxCount(): number {
    const vals = this.t4Rows.map(r => r.count);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  t4BarW(count: number): string {
    return Math.round((count / this.t4MaxCount) * 100) + '%';
  }
  t4Pct(count: number): string {
    const total = this.t4Total.count;
    if (!total) return '0%';
    return ((count / total) * 100).toFixed(1) + '%';
  }

  // ── T5 : barres horizontales par province ─────────────────────────
  get t5MaxCount(): number {
    const vals = this.t5Rows.map(r => r.count);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  t5BarW(count: number): string {
    return Math.round((count / this.t5MaxCount) * 100) + '%';
  }
  t5Pct(count: number): string {
    const total = this.t5Total.count;
    if (!total) return '0%';
    return ((count / total) * 100).toFixed(1) + '%';
  }

  // ── T6 : barres horizontales par centre de formation ─────────────
  get t6MaxCount(): number {
    const vals = this.t6Rows.map(r => r.count);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  t6BarW(count: number): string {
    return Math.round((count / this.t6MaxCount) * 100) + '%';
  }
  t6Pct(count: number): string {
    const total = this.t6Total.count;
    if (!total) return '0%';
    return ((count / total) * 100).toFixed(1) + '%';
  }

  // ── T7 : barres horizontales par type de phytolicence ─────────────
  get t7MaxCount(): number {
    const vals = this.t7Rows.map(r => r.count);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  t7BarW(count: number): string {
    return Math.round((count / this.t7MaxCount) * 100) + '%';
  }
  t7Pct(count: number): string {
    const total = this.t7Total.count;
    if (!total) return '0%';
    return ((count / total) * 100).toFixed(1) + '%';
  }

  // ── T8 : donut type de formation ─────────────────────────────────
  get t8DonutItems(): Array<{ label: string; count: number; color: string }> {
    return this.makeDonutItems(this.t8Rows);
  }
  get t8DonutGradient(): string {
    return this.makeDonutGradient(this.t8DonutItems, this.t8Total.count);
  }
  get t8DonutLabels() { return this.makeDonutLabels(this.t8DonutItems, this.t8Total.count); }

  // ── T12 : donut CP / Sans CP ─────────────────────────────────────
  get t12DonutItems(): Array<{ label: string; count: number; color: string }> {
    return this.makeDonutItems(this.t12Rows);
  }
  get t12DonutGradient(): string {
    return this.makeDonutGradient(this.t12DonutItems, this.t12Total.count);
  }
  get t12DonutLabels() { return this.makeDonutLabels(this.t12DonutItems, this.t12Total.count); }

  // ── T11 : barres horizontales ratio par centre ───────────────────
  get t11MaxRatio(): number {
    const vals = this.t11Rows.map(r => parseFloat(r.avg) || 0);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  t11BarW(avg: string): string {
    return Math.round((parseFloat(avg) / this.t11MaxRatio) * 100) + '%';
  }

  // ── T10 : donut mode de présence ─────────────────────────────────
  get t10DonutItems(): Array<{ label: string; count: number; color: string }> {
    return this.makeDonutItems(this.t10Rows);
  }
  get t10DonutGradient(): string {
    return this.makeDonutGradient(this.t10DonutItems, this.t10Total.count);
  }
  get t10DonutLabels() { return this.makeDonutLabels(this.t10DonutItems, this.t10Total.count); }

  // ── T9 : barres horizontales par secteur ──────────────────────────
  get t9MaxCount(): number {
    const vals = this.t9Rows.map(r => r.count);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  t9BarW(count: number): string {
    return Math.round((count / this.t9MaxCount) * 100) + '%';
  }
  t9Pct(count: number): string {
    const total = this.t9Total.count;
    if (!total) return '0%';
    return ((count / total) * 100).toFixed(1) + '%';
  }

  // ── T5 & T7 : donuts ─────────────────────────────────────────────
  get t5DonutItems(): Array<{ label: string; count: number; color: string }> {
    return this.makeDonutItems(this.t5Rows);
  }
  get t5DonutGradient(): string {
    return this.makeDonutGradient(this.t5DonutItems, this.t5Total.count);
  }

  get t7DonutItems(): Array<{ label: string; count: number; color: string }> {
    return this.makeDonutItems(this.t7Rows);
  }
  get t7DonutGradient(): string {
    return this.makeDonutGradient(this.t7DonutItems, this.t7Total.count);
  }

  pctOf(count: number, total: number): string {
    if (!total) return '0.0';
    return ((count / total) * 100).toFixed(1);
  }

  get t5DonutLabels(): Array<{ pct: string; left: string; top: string; show: boolean }> {
    return this.makeDonutLabels(this.t5DonutItems, this.t5Total.count);
  }
  get t7DonutLabels(): Array<{ pct: string; left: string; top: string; show: boolean }> {
    return this.makeDonutLabels(this.t7DonutItems, this.t7Total.count);
  }

  private makeDonutLabels(
    items: Array<{ count: number }>,
    total: number,
  ): Array<{ pct: string; left: string; top: string; show: boolean }> {
    // Donut: outer radius 90px, inner radius 54px → label at r=72 (midpoint of ring)
    const cx = 90, cy = 90, r = 72;
    let current = 0;
    return items.map(item => {
      const p = total > 0 ? (item.count / total) * 100 : 0;
      const midAngle = ((current + p / 2) / 100) * 2 * Math.PI;
      const x = cx + r * Math.sin(midAngle);
      const y = cy - r * Math.cos(midAngle);
      current += p;
      return {
        pct: Math.round(p) + '%',
        left: x.toFixed(1) + 'px',
        top:  y.toFixed(1) + 'px',
        show: p >= 8,
      };
    });
  }

  private makeDonutItems(rows: StatsRow[]): Array<{ label: string; count: number; color: string }> {
    if (!rows.length) return [];
    const limit = 8;
    if (rows.length <= limit) {
      return rows.map((r, i) => ({ label: r.label, count: r.count, color: this.COLORS[i % this.COLORS.length] }));
    }
    const top = rows.slice(0, limit).map((r, i) => ({ label: r.label, count: r.count, color: this.COLORS[i] }));
    const rest = rows.slice(limit).reduce((s, r) => s + r.count, 0);
    return [...top, { label: 'Autres', count: rest, color: '#94a3b8' }];
  }

  private makeDonutGradient(items: Array<{ count: number; color: string }>, total: number): string {
    if (!items.length) return 'conic-gradient(#e5e7eb 0% 100%)';
    let current = 0;
    const parts: string[] = [];
    for (const item of items) {
      const p = (item.count / total) * 100;
      parts.push(`${item.color} ${current.toFixed(2)}% ${(current + p).toFixed(2)}%`);
      current += p;
    }
    return `conic-gradient(${parts.join(', ')})`;
  }

  // ── T3 : barres mensuelles + ligne de tendance SVG ────────────────
  get t3MaxCount(): number {
    const vals = this.t3Rows.map(r => r.count);
    return vals.length ? Math.max(...vals, 1) : 1;
  }
  t3BarH(count: number): string {
    return Math.round((count / this.t3MaxCount) * 100) + '%';
  }
  get t3TrendPoints(): string {
    const rows = this.t3Rows;
    if (rows.length < 2) return '';
    const n = rows.length;
    const avgs = rows.map(r => parseFloat(r.avg) || 0);
    const maxAvg = Math.max(...avgs, 0.1);
    return rows.map((r, i) => {
      const x = ((i + 0.5) / n) * 100;
      const avg = parseFloat(r.avg) || 0;
      const y = 12 + (1 - avg / maxAvg) * 76;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }
  get t3TrendCircles(): { cx: string; cy: string; avg: string }[] {
    const rows = this.t3Rows;
    if (!rows.length) return [];
    const n = rows.length;
    const avgs = rows.map(r => parseFloat(r.avg) || 0);
    const maxAvg = Math.max(...avgs, 0.1);
    return rows.map((r, i) => {
      const cx = ((i + 0.5) / n) * 100;
      const avg = parseFloat(r.avg) || 0;
      const cy = 12 + (1 - avg / maxAvg) * 76;
      return { cx: cx.toFixed(1), cy: cy.toFixed(1), avg: r.avg };
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Export Excel (3 feuilles)
  // ─────────────────────────────────────────────────────────────────

  exportExcel(): void {
    const today = new Date().toISOString().slice(0, 10);

    const sheet1 = this.buildSheet(
      'Vue par année', 'Année', this.t1Rows, this.t1Total,
      this.filterDesc(this.f1),
    );
    const sheet2 = this.buildSheet(
      'Vue filtrée', 'Année', this.t2Rows, this.t2Total,
      this.filterDesc(this.f23, this.f23YearFrom, this.f23YearTo),
    );
    const sheet3 = this.f23Year
      ? this.buildSheet(
          `Mois ${this.f23Year}`, 'Mois', this.t3Rows, this.t3Total,
          this.filterDesc(this.f23, this.f23Year, this.f23Year),
        )
      : this.buildEmptySheet('Vue mensuelle', '(aucune année sélectionnée dans Vue filtrée)');

    const sheet4 = this.buildSheet(
      'Par centre', 'Centre', this.t4Rows, this.t4Total,
      this.filterDesc(this.f4, this.f4YearFrom, this.f4YearTo),
    );
    const sheet5 = this.buildSheet(
      'Par province', 'Province', this.t5Rows, this.t5Total,
      this.filterDesc(this.f5, this.f5YearFrom, this.f5YearTo),
    );

    const sheet6 = this.buildSheet(
      'Par centre formation', 'Centre de formation', this.t6Rows, this.t6Total,
      this.filterDesc(this.f6, this.f6YearFrom, this.f6YearTo),
    );
    const sheet7 = this.buildSheet(
      'Par type phytolicence', 'Type phytolicence', this.t7Rows, this.t7Total,
      this.filterDesc(this.f7, this.f7YearFrom, this.f7YearTo),
    );

    const sheet8 = this.buildSheet(
      'Par type formation', 'Type', this.t8Rows, this.t8Total,
      this.filterDesc(this.f8, this.f8YearFrom, this.f8YearTo),
    );
    const sheet9 = this.buildSheet(
      'Par secteur', 'Secteur', this.t9Rows, this.t9Total,
      this.filterDesc(this.f9, this.f9YearFrom, this.f9YearTo),
    );
    const sheet10 = this.buildSheet(
      'Par mode présence', 'Mode', this.t10Rows, this.t10Total,
      this.filterDesc(this.f10, this.f10YearFrom, this.f10YearTo),
    );
    const sheet11 = this.buildSheet(
      'Ratio par centre', 'Centre de formation', this.t11Rows, this.t11Total,
      this.filterDesc(this.f11, this.f11YearFrom, this.f11YearTo),
    );
    const sheet12 = this.buildSheet(
      'CP vs Sans CP', 'Type CP', this.t12Rows, this.t12Total,
      this.filterDesc(this.f12, this.f12YearFrom, this.f12YearTo),
    );

    // Sheet 13 — par thème et sous-thème
    const t13ExpRows  = this.t13Rows;
    const t13ExpTotal = this.t13Total;
    const t13DataRows = t13ExpRows.map((r, i) => {
      const z = i % 2 === 1;
      const avgH = r.count > 0 ? (r.totalHours / r.count).toFixed(1) : '—';
      return `<Row ss:Height="18">
        <Cell ss:StyleID="${z ? 'nameZ' : 'name'}"><Data ss:Type="String">${this.escapeXml(r.theme)}</Data></Cell>
        <Cell ss:StyleID="${z ? 'nameZ' : 'name'}"><Data ss:Type="String">${this.escapeXml(r.subTheme)}</Data></Cell>
        <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.count}</Data></Cell>
        <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="${r.participants > 0 ? 'Number' : 'String'}">${r.participants > 0 ? r.participants : '—'}</Data></Cell>
        <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="${r.totalHours > 0 ? 'Number' : 'String'}">${r.totalHours > 0 ? r.totalHours.toFixed(1) : '—'}</Data></Cell>
        <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="String">${avgH}</Data></Cell>
      </Row>`;
    }).join('');
    const t13AvgTotalH = t13ExpTotal.count > 0 ? (t13ExpTotal.totalHours / t13ExpTotal.count).toFixed(1) : '—';
    const sheet13 = `
  <Worksheet ss:Name="Par thème et sous-thème">
    <Table ss:DefaultRowHeight="18">
      <Column ss:Width="160"/><Column ss:Width="160"/><Column ss:Width="100"/>
      <Column ss:Width="100"/><Column ss:Width="100"/><Column ss:Width="120"/>
      <Row ss:Height="28">
        <Cell ss:StyleID="title" ss:MergeAcross="5">
          <Data ss:Type="String">Activités de formation — Par thème et sous-thème</Data>
        </Cell>
      </Row>
      <Row ss:Height="18">
        <Cell ss:StyleID="subtitle" ss:MergeAcross="5">
          <Data ss:Type="String">${this.escapeXml(this.filterDesc(this.f13, this.f13YearFrom, this.f13YearTo))}</Data>
        </Cell>
      </Row>
      <Row ss:Height="8"><Cell/></Row>
      <Row ss:Height="22">
        <Cell ss:StyleID="hdr"><Data ss:Type="String">Thème</Data></Cell>
        <Cell ss:StyleID="hdr"><Data ss:Type="String">Sous-thème</Data></Cell>
        <Cell ss:StyleID="hdr"><Data ss:Type="String">Nb formations</Data></Cell>
        <Cell ss:StyleID="hdr"><Data ss:Type="String">Participants</Data></Cell>
        <Cell ss:StyleID="hdr"><Data ss:Type="String">Heures totales</Data></Cell>
        <Cell ss:StyleID="hdr"><Data ss:Type="String">Moy. heures/formation</Data></Cell>
      </Row>
      ${t13DataRows}
      <Row ss:Height="20">
        <Cell ss:StyleID="totalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
        <Cell ss:StyleID="totalLabel"></Cell>
        <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${t13ExpTotal.count}</Data></Cell>
        <Cell ss:StyleID="totalNum"><Data ss:Type="${t13ExpTotal.participants > 0 ? 'Number' : 'String'}">${t13ExpTotal.participants > 0 ? t13ExpTotal.participants : '—'}</Data></Cell>
        <Cell ss:StyleID="totalNum"><Data ss:Type="${t13ExpTotal.totalHours > 0 ? 'Number' : 'String'}">${t13ExpTotal.totalHours > 0 ? t13ExpTotal.totalHours.toFixed(1) : '—'}</Data></Cell>
        <Cell ss:StyleID="totalNum"><Data ss:Type="String">${t13AvgTotalH}</Data></Cell>
      </Row>
    </Table>
  </Worksheet>`;

    // Sheet 14 — distribution horaire
    const t14Buckets  = this.t14BucketRows;
    const t14BucketDataRows = t14Buckets.map((r, i) => {
      const z = i % 2 === 1;
      return `<Row ss:Height="18">
        <Cell ss:StyleID="${z ? 'nameZ' : 'name'}"><Data ss:Type="String">${this.escapeXml(r.bucket)}</Data></Cell>
        <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.count}</Data></Cell>
        <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="String">${r.pct}</Data></Cell>
      </Row>`;
    }).join('');
    const t14AvgLabel = this.t14AvgHours === '—' ? '—' : this.t14AvgHours + 'h';
    const sheet14 = `
  <Worksheet ss:Name="Distribution horaire">
    <Table ss:DefaultRowHeight="18">
      <Column ss:Width="180"/><Column ss:Width="100"/><Column ss:Width="80"/>
      <Row ss:Height="28">
        <Cell ss:StyleID="title" ss:MergeAcross="2">
          <Data ss:Type="String">Activités de formation — Distribution horaire</Data>
        </Cell>
      </Row>
      <Row ss:Height="18">
        <Cell ss:StyleID="subtitle" ss:MergeAcross="2">
          <Data ss:Type="String">${this.escapeXml(this.filterDesc(this.f14, this.f14YearFrom, this.f14YearTo))}</Data>
        </Cell>
      </Row>
      <Row ss:Height="8"><Cell/></Row>
      <Row ss:Height="18">
        <Cell ss:StyleID="name"><Data ss:Type="String">Activités avec durée renseignée</Data></Cell>
        <Cell ss:StyleID="num" ss:MergeAcross="1"><Data ss:Type="Number">${this.t14WithDurationCount}</Data></Cell>
      </Row>
      <Row ss:Height="18">
        <Cell ss:StyleID="nameZ"><Data ss:Type="String">Activités sans durée</Data></Cell>
        <Cell ss:StyleID="numZ" ss:MergeAcross="1"><Data ss:Type="Number">${this.t14MissingCount}</Data></Cell>
      </Row>
      <Row ss:Height="18">
        <Cell ss:StyleID="name"><Data ss:Type="String">Total heures cumulées</Data></Cell>
        <Cell ss:StyleID="num" ss:MergeAcross="1"><Data ss:Type="${this.t14TotalHours > 0 ? 'Number' : 'String'}">${this.t14TotalHours > 0 ? this.t14TotalHours.toFixed(1) : '—'}</Data></Cell>
      </Row>
      <Row ss:Height="18">
        <Cell ss:StyleID="nameZ"><Data ss:Type="String">Durée moyenne par formation</Data></Cell>
        <Cell ss:StyleID="numZ" ss:MergeAcross="1"><Data ss:Type="String">${t14AvgLabel}</Data></Cell>
      </Row>
      <Row ss:Height="18">
        <Cell ss:StyleID="name"><Data ss:Type="String">Durée min / max</Data></Cell>
        <Cell ss:StyleID="num" ss:MergeAcross="1"><Data ss:Type="String">${this.t14MinHours ?? '—'}h / ${this.t14MaxHours ?? '—'}h</Data></Cell>
      </Row>
      <Row ss:Height="8"><Cell/></Row>
      <Row ss:Height="22">
        <Cell ss:StyleID="hdr"><Data ss:Type="String">Tranche horaire</Data></Cell>
        <Cell ss:StyleID="hdr"><Data ss:Type="String">Nb formations</Data></Cell>
        <Cell ss:StyleID="hdr"><Data ss:Type="String">Part (%)</Data></Cell>
      </Row>
      ${t14BucketDataRows}
      <Row ss:Height="20">
        <Cell ss:StyleID="totalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
        <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${this.t14WithDurationCount}</Data></Cell>
        <Cell ss:StyleID="totalNum"><Data ss:Type="String">100%</Data></Cell>
      </Row>
    </Table>
  </Worksheet>`;

    // Sheet 15 — évolution mensuelle
    const t15FilterDesc = this.t15Year
      ? `Année sélectionnée : ${this.t15Year}`
      : 'Aucun filtre actif — toutes les années';
    const sheet15 = this.buildSheet(
      'Évolution mensuelle', 'Mois', this.t15Rows, this.t15Total, t15FilterDesc,
    );

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  ${this.excelStyles()}
  ${sheet1}
  ${sheet2}
  ${sheet3}
  ${sheet4}
  ${sheet5}
  ${sheet6}
  ${sheet7}
  ${sheet8}
  ${sheet9}
  ${sheet10}
  ${sheet11}
  ${sheet12}
  ${sheet13}
  ${sheet14}
  ${sheet15}
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    this.triggerDownload(blob, `activites-statistiques-${today}.xls`);
  }

  private buildSheet(
    name: string,
    labelCol: string,
    rows: StatsRow[],
    total: StatsRow,
    filterDesc: string,
  ): string {
    const dataRows = rows.map((r, i) => {
      const z = i % 2 === 1;
      return `
      <Row ss:Height="18">
        <Cell ss:StyleID="${z ? 'nameZ' : 'name'}"><Data ss:Type="String">${this.escapeXml(r.label)}</Data></Cell>
        <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.count}</Data></Cell>
        <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="${r.participants > 0 ? 'Number' : 'String'}">${r.participants > 0 ? r.participants : '—'}</Data></Cell>
        <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="String">${r.avg}</Data></Cell>
      </Row>`;
    }).join('');

    const emptyRow = rows.length === 0
      ? `<Row ss:Height="18"><Cell ss:MergeAcross="3" ss:StyleID="name"><Data ss:Type="String">Aucune donnée pour ces filtres.</Data></Cell></Row>`
      : '';

    return `
  <Worksheet ss:Name="${this.escapeXml(name)}">
    <Table ss:DefaultRowHeight="18">
      <Column ss:Width="160"/>
      <Column ss:Width="120"/>
      <Column ss:Width="120"/>
      <Column ss:Width="140"/>
      <Row ss:Height="28">
        <Cell ss:StyleID="title" ss:MergeAcross="3">
          <Data ss:Type="String">Activités de formation — ${this.escapeXml(name)}</Data>
        </Cell>
      </Row>
      <Row ss:Height="18">
        <Cell ss:StyleID="subtitle" ss:MergeAcross="3">
          <Data ss:Type="String">${this.escapeXml(filterDesc)}</Data>
        </Cell>
      </Row>
      <Row ss:Height="8"><Cell/></Row>
      <Row ss:Height="22">
        <Cell ss:StyleID="hdr"><Data ss:Type="String">${labelCol}</Data></Cell>
        <Cell ss:StyleID="hdr"><Data ss:Type="String">Nb formations</Data></Cell>
        <Cell ss:StyleID="hdr"><Data ss:Type="String">Participants</Data></Cell>
        <Cell ss:StyleID="hdr"><Data ss:Type="String">Moy. participants</Data></Cell>
      </Row>
      ${dataRows}
      ${emptyRow}
      <Row ss:Height="20">
        <Cell ss:StyleID="totalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
        <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${total.count}</Data></Cell>
        <Cell ss:StyleID="totalNum"><Data ss:Type="${total.participants > 0 ? 'Number' : 'String'}">${total.participants > 0 ? total.participants : '—'}</Data></Cell>
        <Cell ss:StyleID="totalNum"><Data ss:Type="String">${total.avg}</Data></Cell>
      </Row>
    </Table>
  </Worksheet>`;
  }

  private buildEmptySheet(name: string, message: string): string {
    return `
  <Worksheet ss:Name="${this.escapeXml(name)}">
    <Table>
      <Row ss:Height="28">
        <Cell ss:StyleID="subtitle">
          <Data ss:Type="String">${this.escapeXml(message)}</Data>
        </Cell>
      </Row>
    </Table>
  </Worksheet>`;
  }

  private excelStyles(): string {
    const border = (color = '#e2e8f0', w = 1) =>
      `<Borders>` +
      ['Top', 'Bottom', 'Left', 'Right'].map(p =>
        `<Border ss:Position="${p}" ss:LineStyle="Continuous" ss:Weight="${w}" ss:Color="${color}"/>`
      ).join('') +
      `</Borders>`;

    return `<Styles>
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
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
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
    </Style>
  </Styles>`;
  }

  private filterDesc(f: Filters, yearFrom = '', yearTo = ''): string {
    const parts: string[] = [];
    if (yearFrom && yearTo && yearFrom === yearTo) parts.push(`Année : ${yearFrom}`);
    else if (yearFrom && yearTo) parts.push(`Années : ${yearFrom} – ${yearTo}`);
    else if (yearFrom) parts.push(`Depuis : ${yearFrom}`);
    else if (yearTo) parts.push(`Jusqu'à : ${yearTo}`);
    if (f.sector) parts.push(`Secteur : ${f.sector}`);
    if (f.theme) parts.push(`Thématique : ${f.theme}`);
    if (f.licenseType) parts.push(`Type licence : ${f.licenseType}`);
    if (f.province) parts.push(`Province : ${f.province}`);
    if (f.mode === 'online') parts.push('Mode : En ligne');
    if (f.mode === 'onsite') parts.push('Mode : Présentiel');
    if (f.type === 'initial') parts.push('Type : Initiale');
    if (f.type === 'continuous') parts.push('Type : Continue');
    return parts.length > 0
      ? `Filtres actifs — ${parts.join(' | ')}`
      : 'Aucun filtre actif — toutes les activités';
  }

  // ─────────────────────────────────────────────────────────────────
  // Export PDF
  // ─────────────────────────────────────────────────────────────────

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
        scale: 2,
        useCORS: true,
        scrollY: 0,
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
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
      pdf.save(`activites-statistiques-${today}.pdf`);
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
    return (str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
