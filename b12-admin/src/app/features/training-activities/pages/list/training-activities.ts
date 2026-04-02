import { Component, HostListener, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';
import { HasRoleDirective } from '../../../../core/auth/has-role.directive';
import { ScrollMirrorDirective } from '../../../../shared/directives/scroll-mirror.directive';
import { ToastService } from '../../../../shared/toast/toast.service';
import { SidebarCountsService } from '../../../../shared/layout/sidebar/sidebar-counts.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

import { TrainingActivityApi, TrainingActivityDto } from '../../api/training-activity.api';

type SortKey =
  | 'trainingAccreditation' | 'centerAccreditation' | 'startDate' | 'endDate' | 'numberOfParticipants'
  | 'online' | 'memberPrice' | 'nonMemberPrice' | 'phytodama'
  | 'address' | 'province' | 'createdAt' | 'updatedAt' | 'updatedBy';

type ActionKey =
  | '' | 'archive' | 'unarchive' | 'delete' | 'duplicate'
  | 'export_csv_all' | 'export_xlsx_all' | 'export_pdf_all'
  | 'export_csv_selected' | 'export_xlsx_selected' | 'export_pdf_selected'
  | 'export_csv_all_archived' | 'export_xlsx_all_archived' | 'export_pdf_all_archived';

@Component({
  selector: 'app-training-activities',
  standalone: true,
  imports: [...SHARED_IMPORTS, HasRoleDirective, ScrollMirrorDirective],
  templateUrl: './training-activities.html',
  styleUrl: './training-activities.css',
})
export class TrainingActivities implements OnInit {
  items: TrainingActivityDto[] = [];
  archivedItems: TrainingActivityDto[] = [];
  private allItems: TrainingActivityDto[] = [];

  loading = false;
  error: string | null = null;

  search = '';
  selectedYear: number | null = null;
  availableYears: number[] = [];

  filterOnline: '' | 'true' | 'false' = '';
  filterPhytodama: '' | 'true' | 'false' = '';
  filterCenterAccreditationId: number | null = null;
  availableCenterAccreditations: { id: number; label: string }[] = [];

  filterProvince = '';
  availableProvinces: string[] = [];

  filterStartYear: number | null = null;
  filterStartMonth: number | null = null;
  readonly MONTHS = [
    { v: 1, l: 'Janvier' }, { v: 2, l: 'Février' }, { v: 3, l: 'Mars' },
    { v: 4, l: 'Avril' }, { v: 5, l: 'Mai' }, { v: 6, l: 'Juin' },
    { v: 7, l: 'Juillet' }, { v: 8, l: 'Août' }, { v: 9, l: 'Septembre' },
    { v: 10, l: 'Octobre' }, { v: 11, l: 'Novembre' }, { v: 12, l: 'Décembre' },
  ];
  sortKey: SortKey = 'startDate';
  sortDir: 'asc' | 'desc' = 'desc';

  pageSize = 50;
  currentPage = 1;

  pagedItems: TrainingActivityDto[] = [];
  pageNumbers: number[] = [];

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.items.length / this.pageSize));
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePaged();
  }

  private updatePaged(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedItems = this.items.slice(start, start + this.pageSize);
    this.pageNumbers = this.buildPageNumbers(this.totalPages, this.currentPage);
  }

  private buildPageNumbers(total: number, current: number): number[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [1];
    if (current > 3) pages.push(-1);
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  }

  selected = new Set<number>();
  archivingIds = new Set<number>();
  action: ActionKey = '';

  columnsOpen = false;

  showTrainingAccreditation = true;
  showCenterAccreditation   = true;
  showStartDate             = true;
  showEndDate               = true;
  showNumberOfParticipants  = true;
  showOnline                = true;
  showMemberPrice           = true;
  showNonMemberPrice        = true;
  showPhytodama             = true;
  showAddress               = true;
  showProvince              = true;
  showThemes                = true;
  showLicenseTypes          = true;
  showPartnerAccreditations = true;
  showTrainingType          = true;
  showPilotCenters          = true;
  showSectors               = true;
  showCreatedAt             = false;
  showUpdatedAt             = false;
  showUpdatedBy             = false;

  private readonly STORAGE_KEY = 'b12.training-activities.columns.v4';

  private toast = inject(ToastService);
  private sidebarCounts = inject(SidebarCountsService);
  private confirmDialog = inject(ConfirmDialogService);

  get hasActiveFilter(): boolean {
    return this.search.trim() !== '' || this.selectedYear !== null ||
      this.filterOnline !== '' || this.filterPhytodama !== '' ||
      this.filterCenterAccreditationId !== null ||
      this.filterProvince !== '' ||
      this.filterStartYear !== null || this.filterStartMonth !== null;
  }

  constructor(private api: TrainingActivityApi, private router: Router) {}

  ngOnInit(): void {
    this.restoreColumnPrefs();
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.api.findAll().subscribe({
      next: (items) => {
        this.allItems = items ?? [];
        this.computeAvailableYears();
        this.computeAvailableCenterAccreditations();
        this.computeAvailableProvinces();
        this.applyLocalFilters();
        this.selected.clear();
        this.action = '';
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = err?.error?.message || 'Impossible de charger les activités de formation.';
        this.loading = false;
      },
    });
  }

  private computeAvailableYears(): void {
    const years = new Set<number>();
    for (const a of this.allItems) {
      if (a.startDate) years.add(parseInt(a.startDate.substring(0, 4), 10));
    }
    this.availableYears = Array.from(years).sort((a, b) => b - a);
  }

  private computeAvailableCenterAccreditations(): void {
    const map = new Map<number, string>();
    for (const a of this.allItems) {
      if (a.centerAccreditationId != null && a.centerAccreditationLabel) {
        map.set(a.centerAccreditationId, a.centerAccreditationLabel);
      }
    }
    this.availableCenterAccreditations = Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private computeAvailableProvinces(): void {
    const set = new Set<string>();
    for (const a of this.allItems) {
      if (a.province?.trim()) set.add(a.province.trim());
    }
    this.availableProvinces = Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  setYear(y: number | null): void {
    this.selectedYear = y;
    this.applyLocalFilters();
    this.selected.clear();
  }

  onSearchChange(value: string): void {
    this.search = value;
    this.applyLocalFilters();
    this.selected.clear();
  }

  setFilterOnline(v: string): void    { this.filterOnline = v as any;    this.applyLocalFilters(); this.selected.clear(); }
  setFilterPhytodama(v: string): void { this.filterPhytodama = v as any; this.applyLocalFilters(); this.selected.clear(); }
  setFilterCenterAccreditation(v: string): void {
    this.filterCenterAccreditationId = v ? Number(v) : null;
    this.applyLocalFilters();
    this.selected.clear();
  }
  setFilterProvince(v: string): void {
    this.filterProvince = v;
    this.applyLocalFilters();
    this.selected.clear();
  }
  setFilterStartYear(v: string): void  { this.filterStartYear  = v ? Number(v) : null; this.applyLocalFilters(); this.selected.clear(); }
  setFilterStartMonth(v: string): void { this.filterStartMonth = v ? Number(v) : null; this.applyLocalFilters(); this.selected.clear(); }

  setSort(key: SortKey): void {
    if (this.sortKey === key) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortKey = key; this.sortDir = 'asc'; }
    this.applyLocalFilters();
  }

  toggleAll(checked: boolean): void {
    this.selected.clear();
    if (checked) this.items.forEach(x => { if (x.id != null) this.selected.add(x.id); });
  }

  toggleOne(id: number, checked: boolean): void {
    if (checked) this.selected.add(id);
    else this.selected.delete(id);
  }

  isSelected(id: number): boolean { return this.selected.has(id); }
  selectedCount(): number          { return this.selected.size; }

  isSendDisabled(): boolean {
    if (!this.action || this.loading) return true;
    if (this.action.includes('_all')) return false;
    return this.selected.size === 0;
  }

  async runAction(): Promise<void> {
    if (!this.action) return;

    if (this.action.includes('_all')) {
      const format = this.extractFormat(this.action);
      const includeArchived = this.action.includes('_archived');
      this.handleExport(format, false, includeArchived);
      return;
    }

    if (this.action.endsWith('_selected')) {
      if (this.selected.size === 0) { this.toast.warning('Aucun élément sélectionné.'); return; }
      const format = this.extractFormat(this.action);
      this.handleExport(format, true);
      return;
    }

    if (this.action === 'duplicate') {
      if (this.selected.size !== 1) {
        this.toast.warning('Veuillez sélectionner exactement 1 activité à dupliquer.');
        return;
      }
      const id = Array.from(this.selected.values())[0];
      this.router.navigate(['/training-activities/new'], { queryParams: { cloneId: id } });
      return;
    }

    if (this.selected.size === 0) return;
    const ids = Array.from(this.selected.values());
    this.loading = true;

    if (this.action === 'archive' || this.action === 'unarchive') {
      const archived = this.action === 'archive';
      for (const id of ids) this.archivingIds.add(id);
      this.bulkProcess(ids, (id) => this.api.archive(id, archived));
      return;
    }

    if (this.action === 'delete') {
      const ok = await this.confirmDialog.confirm(`Supprimer ${ids.length} activité(s) de formation ? Cette action est irréversible.`, { danger: true });
      if (!ok) { this.loading = false; return; }
      this.bulkProcess(ids, (id) => this.api.delete(id));
    }
  }

  private extractFormat(action: string): 'csv' | 'xlsx' | 'pdf' {
    if (action.includes('csv'))  return 'csv';
    if (action.includes('xlsx')) return 'xlsx';
    return 'pdf';
  }

  private handleExport(format: 'csv' | 'xlsx' | 'pdf', selected: boolean, includeArchived = false): void {
    this.loading = true;
    const request = selected
      ? this.api.exportSelected(format, Array.from(this.selected))
      : this.api.exportAll(format, includeArchived);

    request.subscribe({
      next: (blob) => {
        const filename = selected
          ? `training-activities-selection.${format}`
          : `training-activities.${format}`;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
        this.loading = false;
        this.action = '';
      },
      error: (err) => {
        console.error(err);
        this.toast.error("Erreur lors de l'export.");
        this.loading = false;
      },
    });
  }

  private bulkProcess(ids: number[], call: (id: number) => Observable<any>): void {
    let done = 0; let failed = 0;
    ids.forEach(id => {
      call(id).subscribe({
        next: () => { done++; this.afterBulk(done, failed, ids.length); },
        error: () => { failed++; this.afterBulk(done, failed, ids.length); },
      });
    });
  }

  private afterBulk(done: number, failed: number, total: number): void {
    if (done + failed < total) return;
    this.loading = false;
    this.action = '';
    this.selected.clear();
    if (failed > 0) {
      this.toast.warning(`${done} réussi(s), ${failed} erreur(s).`);
      this.archivingIds.clear();
      this.load();
    } else {
      this.toast.success('Opération effectuée avec succès.');
      this.sidebarCounts.refresh();
      if (this.archivingIds.size > 0) {
        setTimeout(() => { this.archivingIds.clear(); this.load(); }, 400);
      } else {
        this.load();
      }
    }
  }

  private applyLocalFilters(): void {
    this.currentPage = 1;
    const q = this.search.trim().toLowerCase();
    let arr = [...this.allItems];

    if (this.selectedYear !== null) {
      const y = this.selectedYear;
      arr = arr.filter(a => a.startDate ? parseInt(a.startDate.substring(0, 4), 10) === y : false);
    }

    if (this.filterOnline    === 'true')  arr = arr.filter(a => a.online);
    if (this.filterOnline    === 'false') arr = arr.filter(a => !a.online);
    if (this.filterPhytodama === 'true')  arr = arr.filter(a => a.phytodama);
    if (this.filterPhytodama === 'false') arr = arr.filter(a => !a.phytodama);
    if (this.filterCenterAccreditationId !== null) {
      arr = arr.filter(a => a.centerAccreditationId === this.filterCenterAccreditationId);
    }
    if (this.filterProvince) {
      arr = arr.filter(a => (a.province ?? '').toLowerCase() === this.filterProvince.toLowerCase());
    }
    if (this.filterStartYear !== null) {
      arr = arr.filter(a => a.startDate ? parseInt(a.startDate.substring(0, 4), 10) === this.filterStartYear : false);
    }
    if (this.filterStartMonth !== null) {
      arr = arr.filter(a => a.startDate ? parseInt(a.startDate.substring(5, 7), 10) === this.filterStartMonth : false);
    }
    if (q) {
      arr = arr.filter(a =>
        (a.trainingAccreditationLabel ?? '').toLowerCase().includes(q) ||
        (a.street ?? '').toLowerCase().includes(q) ||
        (a.number ?? '').toLowerCase().includes(q) ||
        (a.postalCode ?? '').toLowerCase().includes(q) ||
        (a.ville ?? '').toLowerCase().includes(q) ||
        (a.province ?? '').toLowerCase().includes(q)
      );
    }

    arr.sort((a, b) => {
      const av = this.sortValue(a);
      const bv = this.sortValue(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * (this.sortDir === 'asc' ? 1 : -1);
      const res = String(av).localeCompare(String(bv));
      return this.sortDir === 'asc' ? res : -res;
    });

    this.items         = arr.filter(x => !x.archived);
    this.archivedItems = arr.filter(x => x.archived);
    this.updatePaged();
  }

  private sortValue(x: TrainingActivityDto): string | number {
    switch (this.sortKey) {
      case 'trainingAccreditation': return (x.trainingAccreditationLabel ?? '').toLowerCase();
      case 'centerAccreditation':   return (x.centerAccreditationLabel ?? '').toLowerCase();
      case 'startDate':             return x.startDate ?? '';
      case 'endDate':               return x.endDate ?? '';
      case 'numberOfParticipants':  return x.numberOfParticipants ?? 0;
      case 'online':                return x.online ? 1 : 0;
      case 'memberPrice':           return x.memberPrice ?? 0;
      case 'nonMemberPrice':        return x.nonMemberPrice ?? 0;
      case 'phytodama':             return x.phytodama ? 1 : 0;
      case 'address':               return (x.ville ?? '').toLowerCase();
      case 'province':              return (x.province ?? '').toLowerCase();
      case 'createdAt':             return x.createdAt ? new Date(x.createdAt).getTime() : 0;
      case 'updatedAt':             return x.updatedAt ? new Date(x.updatedAt).getTime() : 0;
      case 'updatedBy':             return (x.updatedBy ?? '').toLowerCase();
    }
  }

  // ─── Labels multi-valeurs ─────────────────────────────────────

  formatSet(labels?: string[] | null, max = 2): string {
    if (!labels || labels.length === 0) return '-';
    const sorted = [...labels].sort();
    const head = sorted.slice(0, max).join(', ');
    const rest = sorted.length - max;
    return rest > 0 ? `${head} +${rest}` : head;
  }

  formatSetFull(labels?: string[] | null): string {
    if (!labels || labels.length === 0) return '-';
    return [...labels].sort().join(', ');
  }

  trainingTypeLabel(x: TrainingActivityDto): string {
    const parts: string[] = [];
    if (x.initial)    parts.push('Initiale');
    if (x.continuous) parts.push('Continue');
    return parts.length ? parts.join(', ') : '-';
  }

  themesLabelFull(x: TrainingActivityDto): string {
    const parts: string[] = [];
    if (x.themeLabels?.length)    parts.push(...[...x.themeLabels].sort());
    if (x.subThemeLabels?.length) parts.push(...[...x.subThemeLabels].sort());
    return parts.length ? parts.join(', ') : '-';
  }

  // ─── Formatters ───────────────────────────────────────────────

  formatLocalDate(iso?: string | null): string {
    if (!iso) return '-';
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  formatDate(iso?: string): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    const datePart = new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
    const timePart = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    return `${datePart} ${timePart}`;
  }

  formatPrice(price?: number | null): string {
    if (price == null) return '-';
    return new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(price);
  }

  rowColorClass(x: TrainingActivityDto): string {
    if (x.phytodama) return 'row-green';
    if (x.endDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(x.endDate);
      end.setHours(0, 0, 0, 0);
      const diffDays = (today.getTime() - end.getTime()) / 86_400_000;
      if (diffDays > 10) return 'row-red';
      if (diffDays >= 0) return 'row-orange';
    }
    return '';
  }

  tableColspan(): number {
    let c = 1;
    if (this.showTrainingAccreditation) c++;
    if (this.showCenterAccreditation)   c++;
    if (this.showStartDate)             c++;
    if (this.showEndDate)               c++;
    if (this.showNumberOfParticipants)  c++;
    if (this.showOnline)                c++;
    if (this.showMemberPrice)           c++;
    if (this.showNonMemberPrice)        c++;
    if (this.showPhytodama)             c++;
    if (this.showAddress)               c++;
    if (this.showProvince)              c++;
    if (this.showThemes)                c++;
    if (this.showLicenseTypes)          c++;
    if (this.showPartnerAccreditations) c++;
    if (this.showTrainingType)          c++;
    if (this.showPilotCenters)          c++;
    if (this.showSectors)               c++;
    if (this.showCreatedAt)             c++;
    if (this.showUpdatedAt)             c++;
    if (this.showUpdatedBy)             c++;
    return c;
  }

  get optionalColumnsTotal(): number { return 20; }
  get optionalColumnsShown(): number {
    return [
      this.showTrainingAccreditation, this.showCenterAccreditation, this.showStartDate, this.showEndDate,
      this.showNumberOfParticipants, this.showOnline, this.showMemberPrice,
      this.showNonMemberPrice, this.showPhytodama, this.showAddress,
      this.showProvince, this.showThemes, this.showLicenseTypes, this.showPartnerAccreditations,
      this.showTrainingType, this.showPilotCenters, this.showSectors,
      this.showCreatedAt, this.showUpdatedAt, this.showUpdatedBy,
    ].filter(Boolean).length;
  }
  get columnsButtonLabel(): string { return `Afficher / masquer (${this.optionalColumnsShown}/${this.optionalColumnsTotal}) ▾`; }

  toggleColumnsMenu(): void { this.columnsOpen = !this.columnsOpen; }

  setShowTrainingAccreditation(v: boolean) { if (!v && this.optionalColumnsShown <= 1) return; this.showTrainingAccreditation = v; this.persist(); }
  setShowCenterAccreditation(v: boolean)   { if (!v && this.optionalColumnsShown <= 1) return; this.showCenterAccreditation = v;   this.persist(); }
  setShowStartDate(v: boolean)             { if (!v && this.optionalColumnsShown <= 1) return; this.showStartDate = v;             this.persist(); }
  setShowEndDate(v: boolean)               { if (!v && this.optionalColumnsShown <= 1) return; this.showEndDate = v;               this.persist(); }
  setShowNumberOfParticipants(v: boolean)  { if (!v && this.optionalColumnsShown <= 1) return; this.showNumberOfParticipants = v;  this.persist(); }
  setShowOnline(v: boolean)                { if (!v && this.optionalColumnsShown <= 1) return; this.showOnline = v;                this.persist(); }
  setShowMemberPrice(v: boolean)           { if (!v && this.optionalColumnsShown <= 1) return; this.showMemberPrice = v;           this.persist(); }
  setShowNonMemberPrice(v: boolean)        { if (!v && this.optionalColumnsShown <= 1) return; this.showNonMemberPrice = v;        this.persist(); }
  setShowPhytodama(v: boolean)             { if (!v && this.optionalColumnsShown <= 1) return; this.showPhytodama = v;             this.persist(); }
  setShowAddress(v: boolean)               { if (!v && this.optionalColumnsShown <= 1) return; this.showAddress = v;               this.persist(); }
  setShowProvince(v: boolean)              { if (!v && this.optionalColumnsShown <= 1) return; this.showProvince = v;              this.persist(); }
  setShowThemes(v: boolean)                { if (!v && this.optionalColumnsShown <= 1) return; this.showThemes = v;                this.persist(); }
  setShowLicenseTypes(v: boolean)          { if (!v && this.optionalColumnsShown <= 1) return; this.showLicenseTypes = v;          this.persist(); }
  setShowPartnerAccreditations(v: boolean) { if (!v && this.optionalColumnsShown <= 1) return; this.showPartnerAccreditations = v; this.persist(); }
  setShowTrainingType(v: boolean)          { if (!v && this.optionalColumnsShown <= 1) return; this.showTrainingType = v;          this.persist(); }
  setShowPilotCenters(v: boolean)          { if (!v && this.optionalColumnsShown <= 1) return; this.showPilotCenters = v;          this.persist(); }
  setShowSectors(v: boolean)               { if (!v && this.optionalColumnsShown <= 1) return; this.showSectors = v;               this.persist(); }
  setShowCreatedAt(v: boolean)             { if (!v && this.optionalColumnsShown <= 1) return; this.showCreatedAt = v;             this.persist(); }
  setShowUpdatedAt(v: boolean)             { if (!v && this.optionalColumnsShown <= 1) return; this.showUpdatedAt = v;             this.persist(); }
  setShowUpdatedBy(v: boolean)             { if (!v && this.optionalColumnsShown <= 1) return; this.showUpdatedBy = v;             this.persist(); }

  private persist(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        showTrainingAccreditation: this.showTrainingAccreditation,
        showCenterAccreditation: this.showCenterAccreditation,
        showStartDate: this.showStartDate, showEndDate: this.showEndDate,
        showNumberOfParticipants: this.showNumberOfParticipants,
        showOnline: this.showOnline, showMemberPrice: this.showMemberPrice,
        showNonMemberPrice: this.showNonMemberPrice, showPhytodama: this.showPhytodama,
        showAddress: this.showAddress,
        showProvince: this.showProvince,
        showThemes: this.showThemes, showLicenseTypes: this.showLicenseTypes,
        showPartnerAccreditations: this.showPartnerAccreditations,
        showTrainingType: this.showTrainingType,
        showPilotCenters: this.showPilotCenters, showSectors: this.showSectors,
        showCreatedAt: this.showCreatedAt, showUpdatedAt: this.showUpdatedAt,
        showUpdatedBy: this.showUpdatedBy,
      }));
    } catch {}
  }

  private restoreColumnPrefs(): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const o = JSON.parse(raw);
      if (typeof o.showTrainingAccreditation === 'boolean') this.showTrainingAccreditation = o.showTrainingAccreditation;
      if (typeof o.showCenterAccreditation === 'boolean')   this.showCenterAccreditation = o.showCenterAccreditation;
      if (typeof o.showStartDate === 'boolean')             this.showStartDate = o.showStartDate;
      if (typeof o.showEndDate === 'boolean')               this.showEndDate = o.showEndDate;
      if (typeof o.showNumberOfParticipants === 'boolean')  this.showNumberOfParticipants = o.showNumberOfParticipants;
      if (typeof o.showOnline === 'boolean')                this.showOnline = o.showOnline;
      if (typeof o.showMemberPrice === 'boolean')           this.showMemberPrice = o.showMemberPrice;
      if (typeof o.showNonMemberPrice === 'boolean')        this.showNonMemberPrice = o.showNonMemberPrice;
      if (typeof o.showPhytodama === 'boolean')             this.showPhytodama = o.showPhytodama;
      if (typeof o.showAddress === 'boolean')               this.showAddress = o.showAddress;
      if (typeof o.showProvince === 'boolean')              this.showProvince = o.showProvince;
      if (typeof o.showThemes === 'boolean')                this.showThemes = o.showThemes;
      if (typeof o.showLicenseTypes === 'boolean')          this.showLicenseTypes = o.showLicenseTypes;
      if (typeof o.showPartnerAccreditations === 'boolean') this.showPartnerAccreditations = o.showPartnerAccreditations;
      if (typeof o.showTrainingType === 'boolean')          this.showTrainingType = o.showTrainingType;
      if (typeof o.showPilotCenters === 'boolean')          this.showPilotCenters = o.showPilotCenters;
      if (typeof o.showSectors === 'boolean')               this.showSectors = o.showSectors;
      if (typeof o.showCreatedAt === 'boolean')             this.showCreatedAt = o.showCreatedAt;
      if (typeof o.showUpdatedAt === 'boolean')             this.showUpdatedAt = o.showUpdatedAt;
      if (typeof o.showUpdatedBy === 'boolean')             this.showUpdatedBy = o.showUpdatedBy;
    } catch {}
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!(ev.target as HTMLElement)?.closest('.columns-menu')) this.columnsOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEsc(): void { this.columnsOpen = false; }
}
