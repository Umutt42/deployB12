import { Component, HostListener, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';
import { HasRoleDirective } from '../../../../core/auth/has-role.directive';
import { ScrollMirrorDirective } from '../../../../shared/directives/scroll-mirror.directive';
import { ToastService } from '../../../../shared/toast/toast.service';
import { SidebarCountsService } from '../../../../shared/layout/sidebar/sidebar-counts.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

import { TrainingCenterApi, TrainingCenterDto } from '../../api/training-center.api';
import { SectorApi, SectorDto } from '../../../sectors/api/sector.api';
import { PilotCenterApi, PilotCenterDto } from '../../../pilot-centers/api/pilot-center.api';

type SortKey =
  | 'name'
  | 'companyNumber'
  | 'hqCity'
  | 'sectors'
  | 'pilotCenters'
  | 'archived'
  | 'createdAt'
  | 'updatedAt'
  | 'updatedBy';

type ActionKey =
  | ''
  | 'archive'
  | 'unarchive'
  | 'delete'
  | 'duplicate'
  | 'export_csv_all'
  | 'export_xlsx_all'
  | 'export_pdf_all'
  | 'export_csv_selected'
  | 'export_xlsx_selected'
  | 'export_pdf_selected'
  | 'export_csv_all_archived'
  | 'export_xlsx_all_archived'
  | 'export_pdf_all_archived';

type TrainingCenterRow = TrainingCenterDto & {
  sectorIds: number[];
  pilotCenterIds: number[];
};

@Component({
  selector: 'app-training-centers',
  standalone: true,
  imports: [...SHARED_IMPORTS, HasRoleDirective, ScrollMirrorDirective],
  templateUrl: './training-centers.html',
  styleUrl: './training-centers.css',
})
export class TrainingCenters implements OnInit {
  items: TrainingCenterRow[] = [];
  archivedItems: TrainingCenterRow[] = [];
  private allItems: TrainingCenterRow[] = [];

  private sectorNameById = new Map<number, string>();
  private pilotCenterNameById = new Map<number, string>();

  loading = false;
  error: string | null = null;

  search = '';

  sortKey: SortKey = 'name';
  sortDir: 'asc' | 'desc' = 'asc';

  selected = new Set<number>();
  archivingIds = new Set<number>();
  action: ActionKey = '';

  pageSize = 50;
  currentPage = 1;
  currentArchivedPage = 1;

  columnsOpen = false;
  showName = true;
  showCompanyNumber = true;
  showHqCity = true;
  showSectors = true;
  showPilotCenters = true;
  showCreatedAt = false;
  showUpdatedAt = false;
  showUpdatedBy = false;

  private readonly STORAGE_KEY = 'b12.training-centers.columns.v2';

  private toast = inject(ToastService);
  private sidebarCounts = inject(SidebarCountsService);
  private confirmDialog = inject(ConfirmDialogService);

  pagedItems: TrainingCenterRow[] = [];
  pageNumbers: number[] = [];
  pagedArchivedItems: TrainingCenterRow[] = [];
  archivedPageNumbers: number[] = [];

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.items.length / this.pageSize));
  }

  get totalArchivedPages(): number {
    return Math.max(1, Math.ceil(this.archivedItems.length / this.pageSize));
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePaged();
  }

  goToArchivedPage(page: number): void {
    if (page < 1 || page > this.totalArchivedPages) return;
    this.currentArchivedPage = page;
    this.updateArchivedPaged();
  }

  private updatePaged(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedItems = this.items.slice(start, start + this.pageSize);
    this.pageNumbers = this.buildPageNumbers(this.totalPages, this.currentPage);
  }

  private updateArchivedPaged(): void {
    const start = (this.currentArchivedPage - 1) * this.pageSize;
    this.pagedArchivedItems = this.archivedItems.slice(start, start + this.pageSize);
    this.archivedPageNumbers = this.buildPageNumbers(this.totalArchivedPages, this.currentArchivedPage);
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

  get hasActiveFilter(): boolean {
    return this.search.trim() !== '';
  }

  constructor(
    private api: TrainingCenterApi,
    private sectorApi: SectorApi,
    private pilotCenterApi: PilotCenterApi,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.restoreColumnPrefs();
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      centers: this.api.findAll(),
      sectors: this.sectorApi.findAll(),
      pilotCenters: this.pilotCenterApi.findAll(),
    }).subscribe({
      next: ({ centers, sectors, pilotCenters }) => {
        this.sectorNameById.clear();
        (sectors ?? []).forEach((s: SectorDto) => {
          if (typeof s.id === 'number') this.sectorNameById.set(s.id, s.name);
        });

        this.pilotCenterNameById.clear();
        (pilotCenters ?? []).forEach((pc: PilotCenterDto) => {
          if (typeof pc.id === 'number') this.pilotCenterNameById.set(pc.id, pc.name);
        });

        this.allItems = (centers ?? []).map((d: any) => ({
          id: d.id,
          name: d.name,
          companyNumber: d.companyNumber,
          archived: !!d.archived,

          // ✅ HQ
          hqStreet: d.hqStreet ?? null,
          hqNumber: d.hqNumber ?? null,
          hqPostalCode: d.hqPostalCode ?? null,
          hqCity: d.hqCity ?? null,
          hqProvince: d.hqProvince ?? null,

          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
          updatedBy: d.updatedBy ?? null,
          createdBy: d.createdBy ?? null,

          sectorIds: Array.isArray(d.sectorIds) ? d.sectorIds : [],
          pilotCenterIds: Array.isArray(d.pilotCenterIds) ? d.pilotCenterIds : [],
        }));

        this.applyLocalFilters();
        this.selected.clear();
        this.action = '';
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = err?.error?.message || 'Impossible de charger les centres de formation.';
        this.loading = false;
      },
    });
  }

  onSearchChange(value: string) {
    this.search = value;
    this.applyLocalFilters();
    this.selected.clear();
    this.action = '';
  }

  setSort(key: SortKey) {
    if (
      (key === 'name' && !this.showName) ||
      (key === 'companyNumber' && !this.showCompanyNumber) ||
      (key === 'hqCity' && !this.showHqCity) ||
      (key === 'sectors' && !this.showSectors) ||
      (key === 'pilotCenters' && !this.showPilotCenters) ||
      (key === 'createdAt' && !this.showCreatedAt) ||
      (key === 'updatedAt' && !this.showUpdatedAt) ||
      (key === 'updatedBy' && !this.showUpdatedBy)
    ) {
      return;
    }

    if (this.sortKey === key) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
    this.applyLocalFilters();
  }

  toggleAll(checked: boolean) {
    this.selected.clear();
    if (checked) {
      for (const x of this.items) {
        if (x.id != null) this.selected.add(x.id);
      }
    }
  }

  toggleOne(id: number, checked: boolean) {
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

    if (this.action === 'duplicate') {
      const id = ids[0];
      this.router.navigate(['/training-centers/new'], { queryParams: { cloneId: id } });
      return;
    }

    if (this.action === 'archive' || this.action === 'unarchive') {
      const archived = this.action === 'archive';
      for (const id of ids) this.archivingIds.add(id);
      this.bulkProcess(ids, (id) => this.api.archive(id, archived));
      return;
    }

    if (this.action === 'delete') {
      const rows = this.allItems.filter(r => ids.includes(r.id!));
      let msg = `Supprimer ${ids.length} centre(s) de formation ?\n\n`;
      for (const r of rows) {
        msg += `• ${r.name}`;
        if (r.companyNumber) msg += ` (${r.companyNumber})`;
        msg += '\n';
        const sectors = this.formatSectors(r.sectorIds, 999);
        if (sectors !== '-') msg += `  Secteurs : ${sectors}\n`;
        const pcs = this.formatPilotCenters(r.pilotCenterIds, 999);
        if (pcs !== '-') msg += `  Centres pilotes : ${pcs}\n`;
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

  private handleExport(format: 'csv' | 'xlsx' | 'pdf', selected: boolean, includeArchived = false) {
    this.loading = true;

    const request = selected
      ? this.api.exportSelected(format, Array.from(this.selected))
      : this.api.exportAll(format, includeArchived);

    request.subscribe({
      next: (blob) => {
        const filename = selected ? `training-centers-selection.${format}` : `training-centers.${format}`;

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

  private bulkProcess(ids: number[], call: (id: number) => Observable<any>) {
    let done = 0;
    let failed = 0;

    ids.forEach((id) => {
      call(id).subscribe({
        next: () => {
          done++;
          this.afterBulk(done, failed, ids.length);
        },
        error: () => {
          failed++;
          this.afterBulk(done, failed, ids.length);
        },
      });
    });
  }

  private afterBulk(done: number, failed: number, total: number) {
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

  private applyLocalFilters() {
    this.currentPage = 1;
    this.currentArchivedPage = 1;
    const q = this.search.trim().toLowerCase();
    let arr = [...this.allItems];

    if (q) {
      arr = arr.filter((x) => {
        const sectorsText = this.formatSectors(x.sectorIds, 999).toLowerCase();
        const pcsText = this.formatPilotCenters(x.pilotCenterIds, 999).toLowerCase();
        const hqText = this.formatHq(x).toLowerCase();

        return (
          (x.name ?? '').toLowerCase().includes(q) ||
          (x.companyNumber ?? '').toLowerCase().includes(q) ||
          sectorsText.includes(q) ||
          pcsText.includes(q) ||
          hqText.includes(q)
        );
      });
    }

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
    this.updateArchivedPaged();
  }

  private sortValue(x: TrainingCenterRow): string | number {
    switch (this.sortKey) {
      case 'name':
        return (x.name ?? '').toLowerCase();
      case 'companyNumber':
        return (x.companyNumber ?? '').toLowerCase();
      case 'hqCity':
        return (x.hqCity ?? '').toLowerCase();
      case 'sectors':
        return this.formatSectors(x.sectorIds, 999).toLowerCase();
      case 'pilotCenters':
        return this.formatPilotCenters(x.pilotCenterIds, 999).toLowerCase();
      case 'archived':
        return x.archived ? 1 : 0;
      case 'createdAt':
        return x.createdAt ? new Date(x.createdAt).getTime() : 0;
      case 'updatedAt':
        return x.updatedAt ? new Date(x.updatedAt).getTime() : 0;
      case 'updatedBy':
        return (x.updatedBy ?? '').toLowerCase();
    }
  }

  formatHq(x: TrainingCenterRow): string {
    const parts = [
      x.hqStreet,
      x.hqNumber,
      x.hqPostalCode,
      x.hqCity,
      x.hqProvince,
    ]
      .map((s) => (s ?? '').trim())
      .filter(Boolean);

    return parts.length ? parts.join(' ') : '-';
  }

  formatHqCity(x: TrainingCenterRow): string {
    const city = (x.hqCity ?? '').trim();
    const pc = (x.hqPostalCode ?? '').trim();
    if (!city && !pc) return '-';
    return pc ? `${pc} ${city}`.trim() : city;
  }

  formatSectors(ids?: number[], max = 3): string {
    const arr = (ids ?? []).filter((x) => typeof x === 'number');
    if (arr.length === 0) return '-';

    const labels = arr.map((id) => this.sectorNameById.get(id) ?? `#${id}`).filter(Boolean);

    const head = labels.slice(0, max).join(', ');
    const rest = labels.length - max;
    return rest > 0 ? `${head} +${rest}` : head;
  }

  formatPilotCenters(ids?: number[], max = 3): string {
    const arr = (ids ?? []).filter((x) => typeof x === 'number');
    if (arr.length === 0) return '-';

    const labels = arr.map((id) => this.pilotCenterNameById.get(id) ?? `#${id}`).filter(Boolean);

    const head = labels.slice(0, max).join(', ');
    const rest = labels.length - max;
    return rest > 0 ? `${head} +${rest}` : head;
  }

  formatDate(iso?: string): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';

    const datePart = new Intl.DateTimeFormat('fr-BE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(d);

    const timePart = new Intl.DateTimeFormat('fr-BE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);

    return `${datePart} ${timePart}`;
  }

  toggleColumnsMenu() {
    this.columnsOpen = !this.columnsOpen;
  }

  setShowName(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showName = v;
    this.persistColumnPrefs();
    this.ensureValidSort();
  }

  setShowCompanyNumber(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showCompanyNumber = v;
    this.persistColumnPrefs();
    this.ensureValidSort();
  }

  setShowHqCity(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showHqCity = v;
    this.persistColumnPrefs();
    this.ensureValidSort();
  }

  setShowSectors(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showSectors = v;
    this.persistColumnPrefs();
    this.ensureValidSort();
  }

  setShowPilotCenters(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showPilotCenters = v;
    this.persistColumnPrefs();
    this.ensureValidSort();
  }

  setShowCreatedAt(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showCreatedAt = v;
    this.persistColumnPrefs();
    this.ensureValidSort();
  }

  setShowUpdatedAt(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showUpdatedAt = v;
    this.persistColumnPrefs();
    this.ensureValidSort();
  }

  setShowUpdatedBy(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showUpdatedBy = v;
    this.persistColumnPrefs();
    this.ensureValidSort();
  }

  private ensureValidSort() {
    const hidden =
      (this.sortKey === 'name' && !this.showName) ||
      (this.sortKey === 'companyNumber' && !this.showCompanyNumber) ||
      (this.sortKey === 'hqCity' && !this.showHqCity) ||
      (this.sortKey === 'sectors' && !this.showSectors) ||
      (this.sortKey === 'pilotCenters' && !this.showPilotCenters) ||
      (this.sortKey === 'createdAt' && !this.showCreatedAt) ||
      (this.sortKey === 'updatedAt' && !this.showUpdatedAt) ||
      (this.sortKey === 'updatedBy' && !this.showUpdatedBy);

    if (hidden) {
      this.sortKey = this.showName ? 'name'
        : this.showCompanyNumber ? 'companyNumber'
        : this.showHqCity ? 'hqCity'
        : this.showSectors ? 'sectors'
        : this.showPilotCenters ? 'pilotCenters'
        : this.showCreatedAt ? 'createdAt'
        : this.showUpdatedAt ? 'updatedAt'
        : 'updatedBy';
      this.sortDir = 'asc';
    }
    this.applyLocalFilters();
  }

  private persistColumnPrefs() {
    try {
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({
          showName: this.showName,
          showCompanyNumber: this.showCompanyNumber,
          showHqCity: this.showHqCity,
          showSectors: this.showSectors,
          showPilotCenters: this.showPilotCenters,
          showCreatedAt: this.showCreatedAt,
          showUpdatedAt: this.showUpdatedAt,
          showUpdatedBy: this.showUpdatedBy,
        })
      );
    } catch {}
  }

  private restoreColumnPrefs() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (typeof obj.showName === 'boolean') this.showName = obj.showName;
      if (typeof obj.showCompanyNumber === 'boolean') this.showCompanyNumber = obj.showCompanyNumber;
      if (typeof obj.showHqCity === 'boolean') this.showHqCity = obj.showHqCity;
      if (typeof obj.showSectors === 'boolean') this.showSectors = obj.showSectors;
      if (typeof obj.showPilotCenters === 'boolean') this.showPilotCenters = obj.showPilotCenters;
      if (typeof obj.showCreatedAt === 'boolean') this.showCreatedAt = obj.showCreatedAt;
      if (typeof obj.showUpdatedAt === 'boolean') this.showUpdatedAt = obj.showUpdatedAt;
      if (typeof obj.showUpdatedBy === 'boolean') this.showUpdatedBy = obj.showUpdatedBy;
    } catch {}
  }

  tableColspan(): number {
    let cols = 1; // checkbox (toujours visible)
    if (this.showName) cols++;
    if (this.showCompanyNumber) cols++;
    if (this.showHqCity) cols++;
    if (this.showSectors) cols++;
    if (this.showPilotCenters) cols++;
    if (this.showCreatedAt) cols++;
    if (this.showUpdatedAt) cols++;
    if (this.showUpdatedBy) cols++;
    return cols;
  }

  get optionalColumnsTotal(): number {
    return 8;
  }

  get optionalColumnsShown(): number {
    return (
      (this.showName ? 1 : 0) +
      (this.showCompanyNumber ? 1 : 0) +
      (this.showHqCity ? 1 : 0) +
      (this.showSectors ? 1 : 0) +
      (this.showPilotCenters ? 1 : 0) +
      (this.showCreatedAt ? 1 : 0) +
      (this.showUpdatedAt ? 1 : 0) +
      (this.showUpdatedBy ? 1 : 0)
    );
  }

  get columnsButtonLabel(): string {
    return `Afficher / masquer (${this.optionalColumnsShown}/${this.optionalColumnsTotal}) ▾`;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    if (!target.closest('.columns-menu')) this.columnsOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    this.columnsOpen = false;
  }
}
