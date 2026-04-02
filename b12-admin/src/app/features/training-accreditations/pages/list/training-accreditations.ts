import { Component, HostListener, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';
import { HasRoleDirective } from '../../../../core/auth/has-role.directive';
import { ScrollMirrorDirective } from '../../../../shared/directives/scroll-mirror.directive';
import { ToastService } from '../../../../shared/toast/toast.service';
import { SidebarCountsService } from '../../../../shared/layout/sidebar/sidebar-counts.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

import {
  TrainingAccreditationApi,
  TrainingAccreditationDto,
} from '../../api/training-accreditation.api';

type SortKey =
  | 'centerAccreditation' | 'title' | 'partners' | 'licenseTypes'
  | 'themes' | 'durationHours' | 'trainers'
  | 'trainingType' | 'receivedDate' | 'requestStatus'
  | 'accreditationNumber' | 'trainingPoints' | 'startDate' | 'endDate'
  | 'subsidized' | 'comment' | 'createdAt' | 'updatedAt' | 'updatedBy'
  | 'sectors' | 'pilotCenters' | 'price' | 'publicCible' | 'type';

type ActionKey =
  | '' | 'archive' | 'unarchive' | 'duplicate' | 'delete'
  | 'export_csv_all' | 'export_xlsx_all' | 'export_pdf_all'
  | 'export_csv_selected' | 'export_xlsx_selected' | 'export_pdf_selected'
  | 'export_csv_all_archived' | 'export_xlsx_all_archived' | 'export_pdf_all_archived';

@Component({
  selector: 'app-training-accreditations',
  standalone: true,
  imports: [...SHARED_IMPORTS, HasRoleDirective, ScrollMirrorDirective],
  templateUrl: './training-accreditations.html',
  styleUrl: './training-accreditations.css',
})
export class TrainingAccreditations implements OnInit {
  items: TrainingAccreditationDto[] = [];
  archivedItems: TrainingAccreditationDto[] = [];
  private allItems: TrainingAccreditationDto[] = [];
  private initialLoadDone = false;

  loading = false;
  error: string | null = null;

  search = '';
  selectedYear: number | null = null;
  availableYears: number[] = [];

  filterStatus = '';
  filterCenterAccreditationId: number | null = null;
  availableCenterAccreditations: { id: number; label: string }[] = [];
  filterTrainingType: '' | 'initial' | 'continuous' = '';
  filterEndYear: number | null = null;
  filterEndMonth: number | null = null;
  availableEndYears: number[] = [];
  filterExpiration = '';

  readonly MONTHS = [
    { v: 1, l: 'Janvier' }, { v: 2, l: 'Février' }, { v: 3, l: 'Mars' },
    { v: 4, l: 'Avril' }, { v: 5, l: 'Mai' }, { v: 6, l: 'Juin' },
    { v: 7, l: 'Juillet' }, { v: 8, l: 'Août' }, { v: 9, l: 'Septembre' },
    { v: 10, l: 'Octobre' }, { v: 11, l: 'Novembre' }, { v: 12, l: 'Décembre' },
  ];

  sortKey: SortKey = 'title';
  sortDir: 'asc' | 'desc' = 'asc';

  pageSize = 50;
  currentPage = 1;

  pagedItems: TrainingAccreditationDto[] = [];
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
  dropdownStyle: Record<string, string> = {};

  showCenterAccreditation   = true;
  showPartners              = true;
  showTitle                 = true;
  showLicenseTypes          = true;
  showThemes                = true;
  showDurationHours         = true;
  showTrainers              = true;
  showTrainingType          = true;
  showReceivedDate          = true;
  showRequestStatus         = true;
  showAccreditationNumber   = true;
  showTrainingPoints        = true;
  showStartDate             = true;
  showEndDate               = true;
  showSubsidized            = true;
  showPrice                 = true;
  showComment               = false;
  showCreatedAt             = false;
  showUpdatedAt             = false;
  showUpdatedBy             = false;
  showSectors               = true;
  showPilotCenters          = true;
  showPublicCible           = false;
  showType                  = true;

  private readonly STORAGE_KEY = 'b12.training-accreditations.columns.v7';

  private toast = inject(ToastService);
  private sidebarCounts = inject(SidebarCountsService);
  private confirmDialog = inject(ConfirmDialogService);

  get hasActiveFilter(): boolean {
    return this.search.trim() !== '' || this.filterStatus !== '' ||
      this.filterCenterAccreditationId !== null ||
      this.filterTrainingType !== '' ||
      this.filterEndYear !== null || this.filterEndMonth !== null ||
      this.filterExpiration !== '' ||
      this.selectedYear !== null;
  }

  constructor(private api: TrainingAccreditationApi, private router: Router) {}

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
        this.computeAvailableEndYears();
        this.computeAvailableCenterAccreditations();
        this.applyLocalFilters();
        this.selected.clear();
        this.action = '';
        this.loading = false;
        if (!this.initialLoadDone) {
          this.initialLoadDone = true;
          this.archiveExpiredItems();
        }
      },
      error: (err) => {
        console.error(err);
        this.error = err?.error?.message || 'Impossible de charger les agréments formations.';
        this.loading = false;
      },
    });
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

  private computeAvailableEndYears(): void {
    const years = new Set<number>();
    for (const a of this.allItems) {
      if (a.endDate) years.add(parseInt(a.endDate.substring(0, 4), 10));
    }
    this.availableEndYears = Array.from(years).sort((a, b) => a - b);
  }

  private computeAvailableYears(): void {
    const years = new Set<number>();
    for (const a of this.allItems) {
      if (a.receivedDate) years.add(parseInt(a.receivedDate.substring(0, 4), 10));
      if (a.startDate)    years.add(parseInt(a.startDate.substring(0, 4), 10));
    }
    this.availableYears = Array.from(years).sort((a, b) => a - b);
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

  setFilterStatus(v: string): void       { this.filterStatus = v;    this.applyLocalFilters(); this.selected.clear(); }
  setFilterCenterAccreditation(v: string): void {
    this.filterCenterAccreditationId = v ? Number(v) : null;
    this.applyLocalFilters();
    this.selected.clear();
  }
  setFilterTrainingType(v: string): void { this.filterTrainingType = v as any; this.applyLocalFilters(); this.selected.clear(); }
  setFilterEndYear(v: string): void  { this.filterEndYear  = v ? Number(v) : null; this.applyLocalFilters(); this.selected.clear(); }
  setFilterEndMonth(v: string): void { this.filterEndMonth = v ? Number(v) : null; this.applyLocalFilters(); this.selected.clear(); }
  setFilterExpiration(v: string): void   { this.filterExpiration = v; this.applyLocalFilters(); this.selected.clear(); this.action = ''; }

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
    if (this.action === 'duplicate') return this.selected.size !== 1;
    return this.selected.size === 0;
  }

  async runAction(): Promise<void> {
    if (!this.action) return;

    if (this.action === 'duplicate') {
      if (this.selected.size !== 1) {
        this.toast.warning('Veuillez sélectionner exactement 1 agrément à dupliquer.');
        return;
      }
      const id = Array.from(this.selected.values())[0];
      this.router.navigate(['/training-accreditations/new'], { queryParams: { cloneId: id } });
      return;
    }

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
      const ok = await this.confirmDialog.confirm(`Supprimer ${ids.length} agrément(s) formation ? Cette action est irréversible.`, { danger: true });
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
          ? `training-accreditations-selection.${format}`
          : `training-accreditations.${format}`;
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
        this.toast.error("Erreur lors de l'export (backend manquant ?).");
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

  private archiveExpiredItems(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expired = this.allItems.filter((a) => {
      if (a.archived) return false;
      if (!a.endDate) return false;
      return new Date(a.endDate) < today;
    });
    if (expired.length === 0) return;
    const ids = expired.map((a) => a.id!);
    this.bulkProcess(ids, (id) => this.api.archive(id, true));
  }

  private applyLocalFilters(): void {
    this.currentPage = 1;
    const q = this.search.trim().toLowerCase();
    let arr = [...this.allItems];

    if (this.selectedYear !== null) {
      const y = this.selectedYear;
      arr = arr.filter(a => {
        const ry = a.receivedDate ? parseInt(a.receivedDate.substring(0, 4), 10) : null;
        const sy = a.startDate    ? parseInt(a.startDate.substring(0, 4), 10) : null;
        return ry === y || sy === y;
      });
    }

    if (this.filterStatus)    arr = arr.filter(a => (a.requestStatus ?? '') === this.filterStatus);
    if (this.filterCenterAccreditationId !== null) {
      arr = arr.filter(a => a.centerAccreditationId === this.filterCenterAccreditationId);
    }
    if (this.filterTrainingType === 'initial')   arr = arr.filter(a => a.initial);
    if (this.filterTrainingType === 'continuous') arr = arr.filter(a => a.continuous);
    if (this.filterEndYear !== null) {
      arr = arr.filter(a => a.endDate ? parseInt(a.endDate.substring(0, 4), 10) === this.filterEndYear : false);
    }
    if (this.filterEndMonth !== null) {
      arr = arr.filter(a => a.endDate ? parseInt(a.endDate.substring(5, 7), 10) === this.filterEndMonth : false);
    }
    if (this.filterExpiration) {
      const now = new Date();
      arr = arr.filter((a) => {
        if (!a.endDate) return this.filterExpiration === 'no_date';
        const end = new Date(a.endDate);
        const days = Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (this.filterExpiration === 'gt_120')         return days > 120;
        if (this.filterExpiration === 'between_60_120') return days > 60 && days <= 120;
        if (this.filterExpiration === 'lte_60')         return days <= 60;
        return true;
      });
    }

    if (q) {
      arr = arr.filter(a =>
        (a.title ?? '').toLowerCase().includes(q) ||
        (a.centerAccreditationLabel ?? '').toLowerCase().includes(q) ||
        (a.accreditationNumber ?? '').toLowerCase().includes(q) ||
        this.formatSet(a.licenseTypeLabels).toLowerCase().includes(q) ||
        this.formatSet(a.themeLabels).toLowerCase().includes(q) ||
        this.formatSet(a.trainerLabels).toLowerCase().includes(q) ||
        this.formatRequestStatus(a.requestStatus).toLowerCase().includes(q) ||
        this.formatSet(a.sectorLabels).toLowerCase().includes(q) ||
        this.formatSet(a.pilotCenterLabels).toLowerCase().includes(q) ||
        (a.publicCible ?? '').toLowerCase().includes(q) ||
        this.formatSet(a.subModuleLabels).toLowerCase().includes(q)
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

  private sortValue(x: TrainingAccreditationDto): string | number {
    switch (this.sortKey) {
      case 'centerAccreditation': return (x.centerAccreditationLabel ?? '').toLowerCase();
      case 'title':               return (x.title ?? '').toLowerCase();
      case 'partners':            return this.formatSet(x.partnerAccreditationLabels).toLowerCase();
      case 'licenseTypes':        return this.formatSet(x.licenseTypeLabels).toLowerCase();
      case 'themes':              return this.formatSet(x.themeLabels).toLowerCase();
      case 'durationHours':       return x.durationHours ?? 0;
      case 'price':               return x.price ?? 0;
      case 'trainers':            return this.formatSet(x.trainerLabels).toLowerCase();
      case 'trainingType':        return x.initial ? 'initiale' : x.continuous ? 'continue' : '';
      case 'receivedDate':        return x.receivedDate ?? '';
      case 'requestStatus':       return this.formatRequestStatus(x.requestStatus);
      case 'accreditationNumber': return (x.accreditationNumber ?? '').toLowerCase();
      case 'trainingPoints':      return x.trainingPoints ?? 0;
      case 'startDate':           return x.startDate ?? '';
      case 'endDate':             return x.endDate ?? '';
      case 'subsidized':          return x.subsidized ? 1 : 0;
      case 'comment':             return (x.comment ?? '').toLowerCase();
      case 'createdAt':           return x.createdAt ? new Date(x.createdAt).getTime() : 0;
      case 'updatedAt':           return x.updatedAt ? new Date(x.updatedAt).getTime() : 0;
      case 'updatedBy':           return (x.updatedBy ?? '').toLowerCase();
      case 'sectors':             return this.formatSet(x.sectorLabels).toLowerCase();
      case 'pilotCenters':        return this.formatSet(x.pilotCenterLabels).toLowerCase();
      case 'publicCible':         return (x.publicCible ?? '').toLowerCase();
      case 'type':                return x.type === 'SUB_MODULES' ? 'sous-modules' : 'complet';
    }
  }

  // ─── Formatters ───────────────────────────────────────────────

  formatSet(labels?: string[] | null, max = 2): string {
    if (!labels || labels.length === 0) return '-';
    const sorted = [...labels].sort();
    const head = sorted.slice(0, max).join(', ');
    const rest = sorted.length - max;
    return rest > 0 ? `${head} +${rest}` : head;
  }

  formatThemesAndSubThemes(x: TrainingAccreditationDto): string {
    const t  = x.themeLabels?.length    ? x.themeLabels.join(', ')    : '';
    const st = x.subThemeLabels?.length ? x.subThemeLabels.join(', ') : '';
    if (!t && !st) return '-';
    return [t, st].filter(Boolean).join(' / ');
  }

  formatTrainingType(x: TrainingAccreditationDto): string {
    if (x.initial) return 'Initiale';
    if (x.continuous) return 'Continue';
    return '-';
  }

  formatRequestStatus(status?: string | null): string {
    if (!status) return '-';
    const map: Record<string, string> = {
      RECEIVED: 'reçu', ACCEPTED: 'accepté', REFUSED: 'refusé', PENDING: 'en attente',
    };
    return map[status] ?? status.toLowerCase();
  }

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

  endDateClass(endDate?: string | null): string {
    if (!endDate) return '';
    const days = Math.floor((new Date(endDate).getTime() - Date.now()) / 86_400_000);
    if (days <= 60)  return 'date-expired';
    if (days <= 120) return 'date-expiring-soon';
    return 'date-ok';
  }

  tableColspan(): number {
    let c = 1;
    if (this.showCenterAccreditation) c++;
    if (this.showPartners)            c++;
    if (this.showTitle)               c++;
    if (this.showLicenseTypes)        c++;
    if (this.showThemes)              c++;
    if (this.showDurationHours)       c++;
    if (this.showPrice)               c++;
    if (this.showTrainers)            c++;
    if (this.showTrainingType)        c++;
    if (this.showReceivedDate)        c++;
    if (this.showRequestStatus)       c++;
    if (this.showAccreditationNumber) c++;
    if (this.showTrainingPoints)      c++;
    if (this.showStartDate)           c++;
    if (this.showEndDate)             c++;
    if (this.showSubsidized)          c++;
    if (this.showComment)             c++;
    if (this.showCreatedAt)           c++;
    if (this.showUpdatedAt)           c++;
    if (this.showUpdatedBy)           c++;
    if (this.showSectors)             c++;
    if (this.showPilotCenters)        c++;
    if (this.showPublicCible)         c++;
    if (this.showType)                c++;
    return c;
  }

  get optionalColumnsTotal(): number { return 24; }
  get optionalColumnsShown(): number {
    return [
      this.showCenterAccreditation, this.showPartners, this.showTitle,
      this.showLicenseTypes, this.showThemes, this.showDurationHours,
      this.showPrice,
      this.showTrainers, this.showTrainingType, this.showReceivedDate,
      this.showRequestStatus, this.showAccreditationNumber, this.showTrainingPoints,
      this.showStartDate, this.showEndDate, this.showSubsidized, this.showComment,
      this.showCreatedAt, this.showUpdatedAt, this.showUpdatedBy,
      this.showSectors, this.showPilotCenters, this.showPublicCible, this.showType,
    ].filter(Boolean).length;
  }
  get columnsButtonLabel(): string { return `Afficher / masquer (${this.optionalColumnsShown}/${this.optionalColumnsTotal}) ▾`; }

  toggleColumnsMenu(event: MouseEvent): void {
    this.columnsOpen = !this.columnsOpen;
    if (this.columnsOpen) {
      const btn = event.currentTarget as HTMLElement;
      const rect = btn.getBoundingClientRect();
      this.dropdownStyle = {
        top: `${rect.bottom + 6}px`,
        right: `${window.innerWidth - rect.right}px`,
      };
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        showCenterAccreditation: this.showCenterAccreditation,
        showPartners: this.showPartners, showTitle: this.showTitle,
        showLicenseTypes: this.showLicenseTypes, showThemes: this.showThemes,
        showDurationHours: this.showDurationHours,
        showPrice: this.showPrice,
        showTrainers: this.showTrainers, showTrainingType: this.showTrainingType,
        showReceivedDate: this.showReceivedDate,
        showRequestStatus: this.showRequestStatus, showAccreditationNumber: this.showAccreditationNumber,
        showTrainingPoints: this.showTrainingPoints, showStartDate: this.showStartDate,
        showEndDate: this.showEndDate, showSubsidized: this.showSubsidized,
        showComment: this.showComment, showCreatedAt: this.showCreatedAt,
        showUpdatedAt: this.showUpdatedAt, showUpdatedBy: this.showUpdatedBy,
        showSectors: this.showSectors, showPilotCenters: this.showPilotCenters,
        showPublicCible: this.showPublicCible, showType: this.showType,
      }));
    } catch {}
  }

  private restoreColumnPrefs(): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const o = JSON.parse(raw);
      if (typeof o.showCenterAccreditation === 'boolean') this.showCenterAccreditation = o.showCenterAccreditation;
      if (typeof o.showPartners === 'boolean')            this.showPartners = o.showPartners;
      if (typeof o.showTitle === 'boolean')               this.showTitle = o.showTitle;
      if (typeof o.showLicenseTypes === 'boolean')        this.showLicenseTypes = o.showLicenseTypes;
      if (typeof o.showThemes === 'boolean')              this.showThemes = o.showThemes;
      if (typeof o.showDurationHours === 'boolean')       this.showDurationHours = o.showDurationHours;
      if (typeof o.showPrice === 'boolean')               this.showPrice = o.showPrice;
      if (typeof o.showTrainers === 'boolean')            this.showTrainers = o.showTrainers;
      if (typeof o.showTrainingType === 'boolean')        this.showTrainingType = o.showTrainingType;
      if (typeof o.showReceivedDate === 'boolean')        this.showReceivedDate = o.showReceivedDate;
      if (typeof o.showRequestStatus === 'boolean')       this.showRequestStatus = o.showRequestStatus;
      if (typeof o.showAccreditationNumber === 'boolean') this.showAccreditationNumber = o.showAccreditationNumber;
      if (typeof o.showTrainingPoints === 'boolean')      this.showTrainingPoints = o.showTrainingPoints;
      if (typeof o.showStartDate === 'boolean')           this.showStartDate = o.showStartDate;
      if (typeof o.showEndDate === 'boolean')             this.showEndDate = o.showEndDate;
      if (typeof o.showSubsidized === 'boolean')          this.showSubsidized = o.showSubsidized;
      if (typeof o.showComment === 'boolean')             this.showComment = o.showComment;
      if (typeof o.showCreatedAt === 'boolean')           this.showCreatedAt = o.showCreatedAt;
      if (typeof o.showUpdatedAt === 'boolean')           this.showUpdatedAt = o.showUpdatedAt;
      if (typeof o.showUpdatedBy === 'boolean')           this.showUpdatedBy = o.showUpdatedBy;
      if (typeof o.showSectors === 'boolean')             this.showSectors = o.showSectors;
      if (typeof o.showPilotCenters === 'boolean')        this.showPilotCenters = o.showPilotCenters;
      if (typeof o.showPublicCible === 'boolean')         this.showPublicCible = o.showPublicCible;
      if (typeof o.showType === 'boolean')                this.showType = o.showType;
    } catch {}
  }

  // setters pour persist
  setShow(field: keyof TrainingAccreditations, v: boolean): void {
    if (!v && this.optionalColumnsShown <= 1) return;
    (this as any)[field] = v;
    this.persist();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!(ev.target as HTMLElement)?.closest('.columns-menu')) this.columnsOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEsc(): void { this.columnsOpen = false; }
}
