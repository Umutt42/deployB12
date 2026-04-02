import { Component, HostListener, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { PilotCenterApi } from '../../api/pilot-center.api';
import { PilotCenter } from '../../models/pilot-center.model';

import { SectorApi, SectorDto } from '../../../sectors/api/sector.api';
import { OrganismApi, OrganismDto } from '../../../organisms/api/organism.api';

import { HasRoleDirective } from '../../../../core/auth/has-role.directive';
import { ScrollMirrorDirective } from '../../../../shared/directives/scroll-mirror.directive';
import { ToastService } from '../../../../shared/toast/toast.service';
import { SidebarCountsService } from '../../../../shared/layout/sidebar/sidebar-counts.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

type SortKey =
  | 'name'
  | 'cpGroup'
  | 'sectors'
  | 'organisms'
  | 'orgAbbreviations'
  | 'description'
  | 'centerAccreditations'
  | 'archived'
  | 'createdAt'
  | 'updatedAt'
  | 'updatedBy';

type ActionKey =
  | ''
  | 'archive'
  | 'unarchive'
  | 'duplicate'
  | 'delete'
  | 'export_csv_all'
  | 'export_xlsx_all'
  | 'export_pdf_all'
  | 'export_csv_selected'
  | 'export_xlsx_selected'
  | 'export_pdf_selected'
  | 'export_csv_all_archived'
  | 'export_xlsx_all_archived'
  | 'export_pdf_all_archived';

type PilotCenterRow = PilotCenter & {
  sectorIds: number[];
  organismIds: number[];
  centerAccreditationIds: number[];
};

@Component({
  selector: 'app-pilot-centers',
  standalone: true,
  imports: [...SHARED_IMPORTS, HasRoleDirective, ScrollMirrorDirective],
  templateUrl: './pilot-centers.html',
  styleUrl: './pilot-centers.css',
})
export class PilotCenters implements OnInit {
  items: PilotCenterRow[] = [];
  archivedItems: PilotCenterRow[] = [];
  private allItems: PilotCenterRow[] = [];

  private sectorNameById = new Map<number, string>();
  private organismById = new Map<number, { name: string; abbreviation?: string | null }>();

  loading = false;
  error: string | null = null;

  search = '';
  filterSectorId: number | null = null;
  filterOrganismId: number | null = null;
  filterCpGroup = '';

  availableSectors: { id: number; name: string }[] = [];
  availableOrganisms: { id: number; name: string }[] = [];
  availableCpGroups: string[] = [];

  private computeFilterOptions(): void {
    const sectors = new Map<number, string>();
    const organisms = new Map<number, string>();
    const cpGroups = new Set<string>();
    for (const x of this.allItems) {
      for (const id of x.sectorIds) {
        if (!sectors.has(id)) {
          const name = this.sectorNameById.get(id);
          if (name) sectors.set(id, name);
        }
      }
      for (const id of x.organismIds) {
        if (!organisms.has(id)) {
          const o = this.organismById.get(id);
          if (o) organisms.set(id, o.name);
        }
      }
      if (x.cpGroup) cpGroups.add(x.cpGroup);
    }
    this.availableSectors = Array.from(sectors.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    this.availableOrganisms = Array.from(organisms.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    this.availableCpGroups = Array.from(cpGroups).sort();
  }

  setFilterSectorId(value: number | null): void {
    this.filterSectorId = value;
    this.applyLocalFilters();
    this.selected.clear();
    this.action = '';
  }

  setFilterOrganismId(value: number | null): void {
    this.filterOrganismId = value;
    this.applyLocalFilters();
    this.selected.clear();
    this.action = '';
  }

  setFilterCpGroup(value: string): void {
    this.filterCpGroup = value;
    this.applyLocalFilters();
    this.selected.clear();
    this.action = '';
  }

  sortKey: SortKey = 'name';
  sortDir: 'asc' | 'desc' = 'asc';

  pageSize = 50;
  currentPage = 1;

  pagedItems: PilotCenterRow[] = [];
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
  showName = true;
  showCpGroup = true;
  showSectors = true;
  showOrganisms = true;
  showOrgAbbreviations = true;
  showDescription = true;
  showCenterAccreditations = true;
  showCreatedAt = false;
  showUpdatedAt = false;
  showUpdatedBy = false;

  private readonly STORAGE_KEY = 'b12.pilot-centers.columns.v2';

  private toast = inject(ToastService);
  private sidebarCounts = inject(SidebarCountsService);
  private confirmDialog = inject(ConfirmDialogService);

  get hasActiveFilter(): boolean {
    return this.search.trim() !== '' || this.filterSectorId !== null ||
      this.filterOrganismId !== null || this.filterCpGroup !== '';
  }

  constructor(
    private api: PilotCenterApi,
    private sectorApi: SectorApi,
    private organismApi: OrganismApi,
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
      organisms: this.organismApi.findAll(),
    }).subscribe({
      next: ({ centers, sectors, organisms }) => {
        this.sectorNameById.clear();
        (sectors ?? []).forEach((s: SectorDto) => {
          if (typeof s.id === 'number') this.sectorNameById.set(s.id, s.name);
        });

        this.organismById.clear();
        (organisms ?? []).forEach((o: OrganismDto) => {
          if (typeof o.id === 'number') this.organismById.set(o.id, { name: o.name, abbreviation: o.abbreviation });
        });

        this.allItems = (centers ?? []).map((d: any) => ({
          id: d.id,
          name: d.name,
          cpGroup: d.cpGroup ?? null,
          description: d.description ?? null,
          archived: !!d.archived,

          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
          updatedBy: d.updatedBy ?? null,
          createdBy: d.createdBy ?? null,

          sectorIds: Array.isArray(d.sectorIds) ? d.sectorIds : [],
          organismIds: Array.isArray(d.organismIds) ? d.organismIds : [],
          centerAccreditationIds:
            (Array.isArray(d.centerAccreditationIds) && d.centerAccreditationIds) ||
            (Array.isArray(d.centerAccreditationsIds) && d.centerAccreditationsIds) ||
            [],
        }));

        this.computeFilterOptions();
        this.applyLocalFilters();
        this.selected.clear();
        this.action = '';
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = err?.error?.message || 'Impossible de charger les centres pilotes.';
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
      (key === 'cpGroup' && !this.showCpGroup) ||
      (key === 'sectors' && !this.showSectors) ||
      (key === 'organisms' && !this.showOrganisms) ||
      (key === 'orgAbbreviations' && !this.showOrgAbbreviations) ||
      (key === 'description' && !this.showDescription) ||
      (key === 'centerAccreditations' && !this.showCenterAccreditations) ||
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

    // ✅ Dupliquer : exactement 1 sélection
    if (this.action === 'duplicate') return this.selected.size !== 1;

    return this.selected.size === 0;
  }

  async runAction(): Promise<void> {
    if (!this.action) return;

    // ✅ DUPLICATE
    if (this.action === 'duplicate') {
      if (this.selected.size !== 1) {
        this.toast.warning('Veuillez sélectionner exactement 1 centre pilote à dupliquer.');
        return;
      }
      const id = Array.from(this.selected.values())[0];
      this.router.navigate(['/pilot-centers/new'], { queryParams: { cloneId: id } });
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
      let msg = `Supprimer ${ids.length} centre(s) pilote(s) ?\n\n`;
      for (const r of rows) {
        msg += `• ${r.name}`;
        if (r.cpGroup) msg += ` [${r.cpGroup}]`;
        msg += '\n';
        const sectors = this.formatSectors(r.sectorIds, 999);
        if (sectors !== '-') msg += `  Secteurs : ${sectors}\n`;
        const orgs = this.formatOrganisms(r.organismIds, 999);
        if (orgs !== '-') msg += `  Organismes : ${orgs}\n`;
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
        const filename = selected ? `pilot-centers-selection.${format}` : `pilot-centers.${format}`;
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
    const q = this.search.trim().toLowerCase();
    let arr = [...this.allItems];

    if (this.filterSectorId !== null) {
      arr = arr.filter((x) => x.sectorIds.includes(this.filterSectorId!));
    }

    if (this.filterOrganismId !== null) {
      arr = arr.filter((x) => x.organismIds.includes(this.filterOrganismId!));
    }

    if (this.filterCpGroup) {
      arr = arr.filter((x) => (x.cpGroup ?? '') === this.filterCpGroup);
    }

    if (q) {
      arr = arr.filter((x) => {
        const sectorsText = this.formatSectors(x.sectorIds, 999).toLowerCase();
        const organismsText = (this.formatOrganisms(x.organismIds, 999) + ' ' + this.formatOrgAbbreviations(x.organismIds, 999)).toLowerCase();
        const accText = this.formatAccreditations(x.centerAccreditationIds, 999).toLowerCase();

        return (
          (x.name ?? '').toLowerCase().includes(q) ||
          (x.cpGroup ?? '').toLowerCase().includes(q) ||
          (x.description ?? '').toLowerCase().includes(q) ||
          sectorsText.includes(q) ||
          organismsText.includes(q) ||
          accText.includes(q)
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
  }

  private sortValue(x: PilotCenterRow): string | number {
    switch (this.sortKey) {
      case 'name':
        return (x.name ?? '').toLowerCase();
      case 'cpGroup':
        return (x.cpGroup ?? '').toLowerCase();
      case 'sectors':
        return this.formatSectors(x.sectorIds, 999).toLowerCase();
      case 'organisms':
        return x.organismIds?.length ?? 0;
      case 'orgAbbreviations':
        return this.formatOrgAbbreviations(x.organismIds, 999).toLowerCase();
      case 'description':
        return (x.description ?? '').toLowerCase();
      case 'centerAccreditations':
        return (x.centerAccreditationIds?.length ?? 0);
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

  formatSectors(ids?: number[], max = 3): string {
    const arr = (ids ?? []).filter((x) => typeof x === 'number');
    if (arr.length === 0) return '-';

    const labels = arr
      .map((id) => this.sectorNameById.get(id) ?? `#${id}`)
      .filter(Boolean);

    const head = labels.slice(0, max).join(', ');
    const rest = labels.length - max;
    return rest > 0 ? `${head} +${rest}` : head;
  }

  formatOrganisms(ids?: number[], max = 3): string {
    const arr = (ids ?? []).filter((x) => typeof x === 'number');
    if (arr.length === 0) return '-';
    const head = arr.slice(0, max).map((id) => {
      const o = this.organismById.get(id);
      return o ? o.name : `#${id}`;
    });
    const rest = arr.length - max;
    return rest > 0 ? `${head.join(', ')} +${rest}` : head.join(', ');
  }

  formatOrgAbbreviations(ids?: number[], max = 3): string {
    const arr = (ids ?? []).filter((x) => typeof x === 'number');
    if (arr.length === 0) return '-';
    const head = arr.slice(0, max).map((id) => {
      const o = this.organismById.get(id);
      return o?.abbreviation ?? '-';
    });
    const rest = arr.length - max;
    return rest > 0 ? `${head.join(', ')} +${rest}` : head.join(', ');
  }

  formatAccreditations(ids?: number[], max = 3): string {
    const arr = (ids ?? []).filter((x) => typeof x === 'number');
    if (arr.length === 0) return '-';
    const head = arr.slice(0, max).map((x) => `#${x}`).join(', ');
    const rest = arr.length - max;
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

  setShowCpGroup(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showCpGroup = v;
    this.persistColumnPrefs();
    this.ensureValidSort();
  }

  setShowSectors(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showSectors = v;
    this.persistColumnPrefs();
    this.ensureValidSort();
  }

  setShowOrganisms(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showOrganisms = v;
    this.persistColumnPrefs();
    this.ensureValidSort();
  }

  setShowOrgAbbreviations(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showOrgAbbreviations = v;
    this.persistColumnPrefs();
    this.ensureValidSort();
  }

  setShowDescription(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showDescription = v;
    this.persistColumnPrefs();
    this.ensureValidSort();
  }

  setShowCenterAccreditations(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showCenterAccreditations = v;
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
      (this.sortKey === 'cpGroup' && !this.showCpGroup) ||
      (this.sortKey === 'sectors' && !this.showSectors) ||
      (this.sortKey === 'organisms' && !this.showOrganisms) ||
      (this.sortKey === 'orgAbbreviations' && !this.showOrgAbbreviations) ||
      (this.sortKey === 'description' && !this.showDescription) ||
      (this.sortKey === 'centerAccreditations' && !this.showCenterAccreditations) ||
      (this.sortKey === 'createdAt' && !this.showCreatedAt) ||
      (this.sortKey === 'updatedAt' && !this.showUpdatedAt) ||
      (this.sortKey === 'updatedBy' && !this.showUpdatedBy);

    if (hidden) {
      this.sortKey = this.showName ? 'name'
        : this.showCpGroup ? 'cpGroup'
        : this.showSectors ? 'sectors'
        : this.showOrganisms ? 'organisms'
        : this.showOrgAbbreviations ? 'orgAbbreviations'
        : this.showDescription ? 'description'
        : this.showCenterAccreditations ? 'centerAccreditations'
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
          showCpGroup: this.showCpGroup,
          showSectors: this.showSectors,
          showOrganisms: this.showOrganisms,
          showOrgAbbreviations: this.showOrgAbbreviations,
          showDescription: this.showDescription,
          showCenterAccreditations: this.showCenterAccreditations,
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
      if (typeof obj.showCpGroup === 'boolean') this.showCpGroup = obj.showCpGroup;
      if (typeof obj.showSectors === 'boolean') this.showSectors = obj.showSectors;
      if (typeof obj.showOrganisms === 'boolean') this.showOrganisms = obj.showOrganisms;
      if (typeof obj.showOrgAbbreviations === 'boolean') this.showOrgAbbreviations = obj.showOrgAbbreviations;
      if (typeof obj.showDescription === 'boolean') this.showDescription = obj.showDescription;
      if (typeof obj.showCenterAccreditations === 'boolean') this.showCenterAccreditations = obj.showCenterAccreditations;
      if (typeof obj.showCreatedAt === 'boolean') this.showCreatedAt = obj.showCreatedAt;
      if (typeof obj.showUpdatedAt === 'boolean') this.showUpdatedAt = obj.showUpdatedAt;
      if (typeof obj.showUpdatedBy === 'boolean') this.showUpdatedBy = obj.showUpdatedBy;
    } catch {}
  }

  tableColspan(): number {
    let cols = 1; // checkbox
    if (this.showName) cols++;
    if (this.showCpGroup) cols++;
    if (this.showSectors) cols++;
    if (this.showOrganisms) cols++;
    if (this.showOrgAbbreviations) cols++;
    if (this.showDescription) cols++;
    if (this.showCenterAccreditations) cols++;
    if (this.showCreatedAt) cols++;
    if (this.showUpdatedAt) cols++;
    if (this.showUpdatedBy) cols++;
    return cols;
  }

  get optionalColumnsTotal(): number {
    return 10;
  }

  get optionalColumnsShown(): number {
    return (
      (this.showName ? 1 : 0) +
      (this.showCpGroup ? 1 : 0) +
      (this.showSectors ? 1 : 0) +
      (this.showOrganisms ? 1 : 0) +
      (this.showOrgAbbreviations ? 1 : 0) +
      (this.showDescription ? 1 : 0) +
      (this.showCenterAccreditations ? 1 : 0) +
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
