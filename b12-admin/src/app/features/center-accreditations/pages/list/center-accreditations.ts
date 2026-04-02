import { Component, HostListener, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';
import { HasRoleDirective } from '../../../../core/auth/has-role.directive';
import { ScrollMirrorDirective } from '../../../../shared/directives/scroll-mirror.directive';
import { ToastService } from '../../../../shared/toast/toast.service';
import { SidebarCountsService } from '../../../../shared/layout/sidebar/sidebar-counts.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

import {
  CenterAccreditationApi,
  CenterAccreditationDto,
  ContactPersonDto,
  TrainingSiteAddressDto,
} from '../../api/center-accreditation.api';
import { TrainingCenterApi, TrainingCenterDto } from '../../../training-centers/api/training-center.api';
import { SectorApi, SectorDto } from '../../../sectors/api/sector.api';
import { PilotCenterApi, PilotCenterDto } from '../../../pilot-centers/api/pilot-center.api';

type SortKey =
  | 'name' | 'companyNumber' | 'hqCity'
  | 'sectors' | 'pilotCenters' | 'contactPeople' | 'trainingSiteAddresses'
  | 'receivedDate' | 'requestStatus' | 'accreditationNumber'
  | 'startDate' | 'endDate' | 'initial' | 'continuous' | 'archived'
  | 'createdAt' | 'updatedAt' | 'updatedBy';

type ActionKey =
  | '' | 'archive' | 'unarchive' | 'duplicate' | 'delete'
  | 'export_csv_all' | 'export_xlsx_all' | 'export_pdf_all'
  | 'export_csv_selected' | 'export_xlsx_selected' | 'export_pdf_selected'
  | 'export_csv_all_archived' | 'export_xlsx_all_archived' | 'export_pdf_all_archived';

type CenterAccreditationRow = CenterAccreditationDto & {
  tcName: string;
  tcCompanyNumber: string;
  tcSectorIds: number[];
  tcPilotCenterIds: number[];
  tcHqStreet?: string | null;
  tcHqNumber?: string | null;
  tcHqPostalCode?: string | null;
  tcHqCity?: string | null;
  tcHqProvince?: string | null;
};

@Component({
  selector: 'app-center-accreditations',
  standalone: true,
  imports: [...SHARED_IMPORTS, HasRoleDirective, ScrollMirrorDirective],
  templateUrl: './center-accreditations.html',
  styleUrl: './center-accreditations.css',
})
export class CenterAccreditations implements OnInit {
  items: CenterAccreditationRow[] = [];
  archivedItems: CenterAccreditationRow[] = [];
  private allItems: CenterAccreditationRow[] = [];

  private sectorNameById = new Map<number, string>();
  private pilotCenterNameById = new Map<number, string>();

  loading = false;
  error: string | null = null;
  private initialLoadDone = false;

  search = '';
  selectedYear: number | null = null;
  availableYears: number[] = [];

  filterStatus     = '';
  filterTcId: number | null = null;
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

  availableTrainingCenters: { id: number; name: string }[] = [];

  private computeFilterOptions(): void {
    const seen = new Map<number, string>();
    for (const a of this.allItems) {
      if (a.trainingCenterId != null && !seen.has(a.trainingCenterId)) {
        seen.set(a.trainingCenterId, a.tcName);
      }
    }
    this.availableTrainingCenters = Array.from(seen.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }

  setFilterStatus(value: string): void {
    this.filterStatus = value;
    this.applyLocalFilters();
    this.selected.clear();
    this.action = '';
  }

  setFilterTcId(value: number | null): void {
    this.filterTcId = value;
    this.applyLocalFilters();
    this.selected.clear();
    this.action = '';
  }

  setFilterEndYear(v: string): void  { this.filterEndYear  = v ? Number(v) : null; this.applyLocalFilters(); this.selected.clear(); this.action = ''; }
  setFilterEndMonth(v: string): void { this.filterEndMonth = v ? Number(v) : null; this.applyLocalFilters(); this.selected.clear(); this.action = ''; }

  setFilterExpiration(value: string): void {
    this.filterExpiration = value;
    this.applyLocalFilters();
    this.selected.clear();
    this.action = '';
  }

  sortKey: SortKey = 'name';
  sortDir: 'asc' | 'desc' = 'asc';

  pageSize = 50;
  currentPage = 1;

  pagedItems: CenterAccreditationRow[] = [];
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

  showName              = true;
  showCompanyNumber     = true;
  showHqCity            = true;
  showSectors           = true;
  showPilotCenters      = true;
  showContactPeople     = true;
  showSiteAddresses     = true;
  showReceivedDate      = true;
  showRequestStatus     = true;
  showAccreditationNumber = true;
  showStartDate         = true;
  showEndDate           = true;
  showInitial           = true;
  showContinuous        = true;
  showCreatedAt         = false;
  showUpdatedAt         = false;
  showUpdatedBy         = false;

  private readonly STORAGE_KEY = 'b12.center-accreditations.columns.v2';

  private toast = inject(ToastService);
  private sidebarCounts = inject(SidebarCountsService);
  private confirmDialog = inject(ConfirmDialogService);

  get hasActiveFilter(): boolean {
    return this.search.trim() !== '' || this.filterStatus !== '' ||
      this.filterTcId !== null ||
      this.filterEndYear !== null || this.filterEndMonth !== null ||
      this.filterExpiration !== '' ||
      this.selectedYear !== null;
  }

  constructor(
    private api: CenterAccreditationApi,
    private tcApi: TrainingCenterApi,
    private sectorApi: SectorApi,
    private pilotCenterApi: PilotCenterApi,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.restoreColumnPrefs();
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      accreditations: this.api.findAll(),
      centers: this.tcApi.findAll(),
      sectors: this.sectorApi.findAll(),
      pilotCenters: this.pilotCenterApi.findAll(),
    }).subscribe({
      next: ({ accreditations, centers, sectors, pilotCenters }) => {
        this.sectorNameById.clear();
        (sectors ?? []).forEach((s: SectorDto) => {
          if (typeof s.id === 'number') this.sectorNameById.set(s.id, s.name);
        });

        this.pilotCenterNameById.clear();
        (pilotCenters ?? []).forEach((pc: PilotCenterDto) => {
          if (typeof pc.id === 'number') this.pilotCenterNameById.set(pc.id, pc.name);
        });

        const centerById = new Map<number, TrainingCenterDto>();
        (centers ?? []).forEach((c: TrainingCenterDto) => {
          if (typeof c.id === 'number') centerById.set(c.id, c);
        });

        this.allItems = (accreditations ?? []).map((a: CenterAccreditationDto) => {
          const tc = a.trainingCenterId ? centerById.get(a.trainingCenterId) : undefined;
          return {
            ...a,
            tcName: tc?.name ?? '-',
            tcCompanyNumber: tc?.companyNumber ?? '-',
            tcSectorIds: tc?.sectorIds ?? [],
            tcPilotCenterIds: tc?.pilotCenterIds ?? [],
            tcHqStreet: tc?.hqStreet ?? null,
            tcHqNumber: tc?.hqNumber ?? null,
            tcHqPostalCode: tc?.hqPostalCode ?? null,
            tcHqCity: tc?.hqCity ?? null,
            tcHqProvince: tc?.hqProvince ?? null,
          } as CenterAccreditationRow;
        });

        this.computeAvailableYears();
        this.computeAvailableEndYears();
        this.computeFilterOptions();
        this.applyLocalFilters();
        this.selected.clear();
        this.action = '';
        this.loading = false;

        if (!this.initialLoadDone) {
          this.initialLoadDone = true;
          this.checkExpiredItems();
        }
      },
      error: (err) => {
        console.error(err);
        this.error = err?.error?.message || 'Impossible de charger les agréments centres.';
        this.loading = false;
      },
    });
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
      if (a.startDate) years.add(parseInt(a.startDate.substring(0, 4), 10));
    }
    this.availableYears = Array.from(years).sort((a, b) => a - b);
  }

  setYear(year: number | null): void {
    this.selectedYear = year;
    this.applyLocalFilters();
    this.selected.clear();
    this.action = '';
  }

  onSearchChange(value: string): void {
    this.search = value;
    this.applyLocalFilters();
    this.selected.clear();
    this.action = '';
  }

  setSort(key: SortKey): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
    this.applyLocalFilters();
  }

  toggleAll(checked: boolean): void {
    this.selected.clear();
    if (checked) {
      for (const x of this.items) {
        if (x.id != null) this.selected.add(x.id);
      }
    }
  }

  toggleOne(id: number, checked: boolean): void {
    if (checked) this.selected.add(id);
    else this.selected.delete(id);
  }

  isSelected(id: number): boolean {
    return this.selected.has(id);
  }

  selectedCount(): number {
    return this.selected.size;
  }

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
      this.router.navigate(['/center-accreditations/new'], { queryParams: { cloneId: id } });
      return;
    }

    if (this.action.includes('_all')) {
      const format = this.extractFormat(this.action);
      const includeArchived = this.action.includes('_archived');
      this.handleExport(format, false, includeArchived);
      return;
    }

    if (this.action.endsWith('_selected')) {
      if (this.selected.size === 0) {
        this.toast.warning('Aucun élément sélectionné.');
        return;
      }
      const format = this.extractFormat(this.action);
      this.handleExport(format, true);
      return;
    }

    if (this.selected.size === 0) {
      this.toast.warning('Aucun élément sélectionné.');
      return;
    }

    const ids = Array.from(this.selected.values());
    this.loading = true;

    if (this.action === 'archive' || this.action === 'unarchive') {
      const archived = this.action === 'archive';
      for (const id of ids) this.archivingIds.add(id);
      this.bulkProcess(ids, (id) => this.api.archive(id, archived));
      return;
    }

    if (this.action === 'delete') {
      const rows = this.allItems.filter(r => ids.includes(r.id!));
      let msg = `Supprimer ${ids.length} agrément(s) centre ?\n\n`;
      for (const r of rows) {
        msg += `• ${r.tcName}`;
        if (r.tcCompanyNumber && r.tcCompanyNumber !== '-') msg += ` (${r.tcCompanyNumber})`;
        msg += '\n';
        const sectors = this.formatSectors(r.tcSectorIds, 999);
        if (sectors !== '-') msg += `  Secteurs : ${sectors}\n`;
        const pcs = this.formatPilotCenters(r.tcPilotCenterIds, 999);
        if (pcs !== '-') msg += `  Centres pilotes : ${pcs}\n`;
        const contacts = this.formatContactPeople(r.contactPeople, 999);
        if (contacts !== '-') msg += `  Contacts : ${contacts}\n`;
        msg += '\n';
      }
      msg += 'Cette action est irréversible.';
      const ok = await this.confirmDialog.confirm(msg, { danger: true });
      if (!ok) {
        this.loading = false;
        return;
      }
      this.bulkProcess(ids, (id) => this.api.delete(id));
      return;
    }
  }

  private extractFormat(action: string): 'csv' | 'xlsx' | 'pdf' {
    if (action.includes('csv')) return 'csv';
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
          ? `center-accreditations-selection.${format}`
          : `center-accreditations.${format}`;
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

  private async checkExpiredItems(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expired = this.allItems.filter((a) => {
      if (a.archived) return false;
      if (!a.endDate) return false;
      return new Date(a.endDate) < today;
    });
    if (expired.length === 0) return;

    const names = expired.map((a) => `• ${a.tcName}`).join('\n');
    const ok = await this.confirmDialog.confirm(
      `${expired.length} agrément(s) ont une date de fin dépassée :\n\n${names}\n\nVoulez-vous les archiver automatiquement ?`
    );
    if (!ok) return;

    this.loading = true;
    const ids = expired.map((a) => a.id!);
    this.bulkProcess(ids, (id) => this.api.archive(id, true));
  }

  private bulkProcess(ids: number[], call: (id: number) => Observable<any>): void {
    let done = 0;
    let failed = 0;
    ids.forEach((id) => {
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

    // Year filter
    if (this.selectedYear !== null) {
      const y = this.selectedYear;
      arr = arr.filter((a) => {
        const rdYear = a.receivedDate ? parseInt(a.receivedDate.substring(0, 4), 10) : null;
        const sdYear = a.startDate ? parseInt(a.startDate.substring(0, 4), 10) : null;
        return rdYear === y || sdYear === y;
      });
    }

    // Status filter
    if (this.filterStatus) {
      arr = arr.filter((a) => (a.requestStatus ?? '') === this.filterStatus);
    }

    // Training center filter
    if (this.filterTcId !== null) {
      arr = arr.filter((a) => a.trainingCenterId === this.filterTcId);
    }

    // End date filter
    if (this.filterEndYear !== null) {
      arr = arr.filter(a => a.endDate ? parseInt(a.endDate.substring(0, 4), 10) === this.filterEndYear : false);
    }
    if (this.filterEndMonth !== null) {
      arr = arr.filter(a => a.endDate ? parseInt(a.endDate.substring(5, 7), 10) === this.filterEndMonth : false);
    }

    // Expiration filter
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

    // Search filter
    if (q) {
      arr = arr.filter((a) => {
        return (
          a.tcName.toLowerCase().includes(q) ||
          a.tcCompanyNumber.toLowerCase().includes(q) ||
          (a.accreditationNumber ?? '').toLowerCase().includes(q) ||
          this.formatRequestStatus(a.requestStatus).toLowerCase().includes(q) ||
          this.formatSectors(a.tcSectorIds, 999).toLowerCase().includes(q) ||
          this.formatPilotCenters(a.tcPilotCenterIds, 999).toLowerCase().includes(q) ||
          this.formatContactPeople(a.contactPeople, 999).toLowerCase().includes(q) ||
          this.formatTcHq(a).toLowerCase().includes(q)
        );
      });
    }

    // Sort
    arr.sort((a, b) => {
      const av = this.sortValue(a);
      const bv = this.sortValue(b);
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * (this.sortDir === 'asc' ? 1 : -1);
      }
      const res = String(av).localeCompare(String(bv));
      return this.sortDir === 'asc' ? res : -res;
    });

    this.items = arr.filter((x) => !x.archived);
    this.archivedItems = arr.filter((x) => x.archived);
    this.updatePaged();
  }

  private sortValue(x: CenterAccreditationRow): string | number {
    switch (this.sortKey) {
      case 'name': return x.tcName.toLowerCase();
      case 'companyNumber': return x.tcCompanyNumber.toLowerCase();
      case 'hqCity': return (x.tcHqCity ?? '').toLowerCase();
      case 'sectors': return this.formatSectors(x.tcSectorIds, 999).toLowerCase();
      case 'pilotCenters': return this.formatPilotCenters(x.tcPilotCenterIds, 999).toLowerCase();
      case 'contactPeople': return this.formatContactPeople(x.contactPeople, 999).toLowerCase();
      case 'trainingSiteAddresses': return this.formatSiteAddresses(x.trainingSiteAddresses, 999).toLowerCase();
      case 'receivedDate': return x.receivedDate ?? '';
      case 'requestStatus': return this.formatRequestStatus(x.requestStatus);
      case 'accreditationNumber': return (x.accreditationNumber ?? '').toLowerCase();
      case 'startDate': return x.startDate ?? '';
      case 'endDate': return x.endDate ?? '';
      case 'initial': return x.initial ? 1 : 0;
      case 'continuous': return x.continuous ? 1 : 0;
      case 'archived': return x.archived ? 1 : 0;
      case 'createdAt': return x.createdAt ? new Date(x.createdAt).getTime() : 0;
      case 'updatedAt': return x.updatedAt ? new Date(x.updatedAt).getTime() : 0;
      case 'updatedBy': return (x.updatedBy ?? '').toLowerCase();
    }
  }

  // ─── Formatters ───────────────────────────────────────────────

  formatRequestStatus(status?: string | null): string {
    if (!status) return '-';
    const map: Record<string, string> = {
      RECEIVED: 'reçu',
      ACCEPTED: 'accepté',
      REFUSED: 'refusé',
      PENDING: 'en attente',
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
    const datePart = new Intl.DateTimeFormat('fr-BE', {
      day: '2-digit', month: 'long', year: 'numeric',
    }).format(d);
    const timePart = new Intl.DateTimeFormat('fr-BE', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(d);
    return `${datePart} ${timePart}`;
  }

  formatSectors(ids: number[], max = 2): string {
    if (!ids || ids.length === 0) return '-';
    const labels = ids.map((id) => this.sectorNameById.get(id) ?? `#${id}`);
    const head = labels.slice(0, max).join(', ');
    const rest = labels.length - max;
    return rest > 0 ? `${head} +${rest}` : head;
  }

  formatPilotCenters(ids: number[], max = 2): string {
    if (!ids || ids.length === 0) return '-';
    const labels = ids.map((id) => this.pilotCenterNameById.get(id) ?? `#${id}`);
    const head = labels.slice(0, max).join(', ');
    const rest = labels.length - max;
    return rest > 0 ? `${head} +${rest}` : head;
  }

  private capitalize(s?: string | null): string {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  formatContactPeople(people?: ContactPersonDto[] | null, max = 2): string {
    if (!people || people.length === 0) return '-';
    const active = people.filter((p) => !p.archived);
    if (active.length === 0) return '-';
    const labels = active.map((p) => {
      const name = [this.capitalize(p.firstName), this.capitalize(p.lastName)].filter(Boolean).join(' ');
      return name || '-';
    });
    const head = labels.slice(0, max).join(', ');
    const rest = labels.length - max;
    return rest > 0 ? `${head} +${rest}` : head;
  }

  formatSiteAddresses(addresses?: TrainingSiteAddressDto[] | null, max = 2): string {
    if (!addresses || addresses.length === 0) return '-';
    const active = addresses.filter((a) => !a.archived);
    if (active.length === 0) return '-';
    const labels = active.map((a) => {
      const pc = (a.postalCode ?? '').trim();
      const city = (a.city ?? '').trim();
      return [pc, city].filter(Boolean).join(' ') || '-';
    });
    const head = labels.slice(0, max).join(', ');
    const rest = labels.length - max;
    return rest > 0 ? `${head} +${rest}` : head;
  }

  formatTcHq(row: CenterAccreditationRow): string {
    const streetNum = [row.tcHqStreet, row.tcHqNumber].filter(Boolean).join(' ');
    const parts: string[] = [];
    if (streetNum) parts.push(streetNum);
    if (row.tcHqPostalCode) parts.push(row.tcHqPostalCode);
    const cityProv = [
      row.tcHqCity,
      row.tcHqProvince ? `(${row.tcHqProvince})` : null,
    ].filter(Boolean).join(' ');
    if (cityProv) parts.push(cityProv);
    return parts.join(' - ') || '-';
  }

  endDateClass(endDate?: string | null): string {
    if (!endDate) return '';
    const now = new Date();
    const end = new Date(endDate);
    const days = Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 60)  return 'date-expired';
    if (days <= 120) return 'date-expiring-soon';
    return 'date-ok';
  }

  // ─── Column prefs ─────────────────────────────────────────────

  toggleColumnsMenu(): void {
    this.columnsOpen = !this.columnsOpen;
  }

  setShowName(v: boolean)               { if (!v && this.optionalColumnsShown <= 1) return; this.showName = v; this.persist(); }
  setShowCompanyNumber(v: boolean)      { if (!v && this.optionalColumnsShown <= 1) return; this.showCompanyNumber = v; this.persist(); }
  setShowHqCity(v: boolean)             { if (!v && this.optionalColumnsShown <= 1) return; this.showHqCity = v; this.persist(); }
  setShowSectors(v: boolean)            { if (!v && this.optionalColumnsShown <= 1) return; this.showSectors = v; this.persist(); }
  setShowPilotCenters(v: boolean)       { if (!v && this.optionalColumnsShown <= 1) return; this.showPilotCenters = v; this.persist(); }
  setShowContactPeople(v: boolean)      { if (!v && this.optionalColumnsShown <= 1) return; this.showContactPeople = v; this.persist(); }
  setShowSiteAddresses(v: boolean)      { if (!v && this.optionalColumnsShown <= 1) return; this.showSiteAddresses = v; this.persist(); }
  setShowReceivedDate(v: boolean)       { if (!v && this.optionalColumnsShown <= 1) return; this.showReceivedDate = v; this.persist(); }
  setShowRequestStatus(v: boolean)      { if (!v && this.optionalColumnsShown <= 1) return; this.showRequestStatus = v; this.persist(); }
  setShowAccreditationNumber(v: boolean){ if (!v && this.optionalColumnsShown <= 1) return; this.showAccreditationNumber = v; this.persist(); }
  setShowStartDate(v: boolean)          { if (!v && this.optionalColumnsShown <= 1) return; this.showStartDate = v; this.persist(); }
  setShowEndDate(v: boolean)            { if (!v && this.optionalColumnsShown <= 1) return; this.showEndDate = v; this.persist(); }
  setShowInitial(v: boolean)            { if (!v && this.optionalColumnsShown <= 1) return; this.showInitial = v; this.persist(); }
  setShowContinuous(v: boolean)         { if (!v && this.optionalColumnsShown <= 1) return; this.showContinuous = v; this.persist(); }
  setShowCreatedAt(v: boolean)          { if (!v && this.optionalColumnsShown <= 1) return; this.showCreatedAt = v; this.persist(); }
  setShowUpdatedAt(v: boolean)          { if (!v && this.optionalColumnsShown <= 1) return; this.showUpdatedAt = v; this.persist(); }
  setShowUpdatedBy(v: boolean)          { if (!v && this.optionalColumnsShown <= 1) return; this.showUpdatedBy = v; this.persist(); }

  private persist(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        showName: this.showName,
        showCompanyNumber: this.showCompanyNumber,
        showHqCity: this.showHqCity,
        showSectors: this.showSectors,
        showPilotCenters: this.showPilotCenters,
        showContactPeople: this.showContactPeople,
        showSiteAddresses: this.showSiteAddresses,
        showReceivedDate: this.showReceivedDate,
        showRequestStatus: this.showRequestStatus,
        showAccreditationNumber: this.showAccreditationNumber,
        showStartDate: this.showStartDate,
        showEndDate: this.showEndDate,
        showInitial: this.showInitial,
        showContinuous: this.showContinuous,
        showCreatedAt: this.showCreatedAt,
        showUpdatedAt: this.showUpdatedAt,
        showUpdatedBy: this.showUpdatedBy,
      }));
    } catch {}
  }

  private restoreColumnPrefs(): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (typeof obj.showName === 'boolean') this.showName = obj.showName;
      if (typeof obj.showCompanyNumber === 'boolean') this.showCompanyNumber = obj.showCompanyNumber;
      if (typeof obj.showHqCity === 'boolean') this.showHqCity = obj.showHqCity;
      if (typeof obj.showSectors === 'boolean') this.showSectors = obj.showSectors;
      if (typeof obj.showPilotCenters === 'boolean') this.showPilotCenters = obj.showPilotCenters;
      if (typeof obj.showContactPeople === 'boolean') this.showContactPeople = obj.showContactPeople;
      if (typeof obj.showSiteAddresses === 'boolean') this.showSiteAddresses = obj.showSiteAddresses;
      if (typeof obj.showReceivedDate === 'boolean') this.showReceivedDate = obj.showReceivedDate;
      if (typeof obj.showRequestStatus === 'boolean') this.showRequestStatus = obj.showRequestStatus;
      if (typeof obj.showAccreditationNumber === 'boolean') this.showAccreditationNumber = obj.showAccreditationNumber;
      if (typeof obj.showStartDate === 'boolean') this.showStartDate = obj.showStartDate;
      if (typeof obj.showEndDate === 'boolean') this.showEndDate = obj.showEndDate;
      if (typeof obj.showInitial === 'boolean') this.showInitial = obj.showInitial;
      if (typeof obj.showContinuous === 'boolean') this.showContinuous = obj.showContinuous;
      if (typeof obj.showCreatedAt === 'boolean') this.showCreatedAt = obj.showCreatedAt;
      if (typeof obj.showUpdatedAt === 'boolean') this.showUpdatedAt = obj.showUpdatedAt;
      if (typeof obj.showUpdatedBy === 'boolean') this.showUpdatedBy = obj.showUpdatedBy;
    } catch {}
  }

  tableColspan(): number {
    let cols = 1; // checkbox
    if (this.showName) cols++;
    if (this.showCompanyNumber) cols++;
    if (this.showHqCity) cols++;
    if (this.showSectors) cols++;
    if (this.showPilotCenters) cols++;
    if (this.showContactPeople) cols++;
    if (this.showSiteAddresses) cols++;
    if (this.showReceivedDate) cols++;
    if (this.showRequestStatus) cols++;
    if (this.showAccreditationNumber) cols++;
    if (this.showStartDate) cols++;
    if (this.showEndDate) cols++;
    if (this.showInitial) cols++;
    if (this.showContinuous) cols++;
    if (this.showCreatedAt) cols++;
    if (this.showUpdatedAt) cols++;
    if (this.showUpdatedBy) cols++;
    return cols;
  }

  get optionalColumnsTotal(): number { return 17; }

  get optionalColumnsShown(): number {
    return [
      this.showName, this.showCompanyNumber, this.showHqCity,
      this.showSectors, this.showPilotCenters, this.showContactPeople,
      this.showSiteAddresses, this.showReceivedDate, this.showRequestStatus,
      this.showAccreditationNumber, this.showStartDate, this.showEndDate,
      this.showInitial, this.showContinuous,
      this.showCreatedAt, this.showUpdatedAt, this.showUpdatedBy,
    ].filter(Boolean).length;
  }

  get columnsButtonLabel(): string {
    return `Afficher / masquer (${this.optionalColumnsShown}/${this.optionalColumnsTotal}) ▾`;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    if (!target.closest('.columns-menu')) this.columnsOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.columnsOpen = false;
  }
}
