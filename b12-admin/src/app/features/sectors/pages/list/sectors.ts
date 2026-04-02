import { Component, HostListener, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, Observable } from 'rxjs';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { SectorApi } from '../../api/sector.api';
import { Sector } from '../../models/sector.model';
import { PilotCenterApi } from '../../../pilot-centers/api/pilot-center.api';
import { OrganismApi } from '../../../organisms/api/organism.api';
import { CenterAccreditationApi } from '../../../center-accreditations/api/center-accreditation.api';
import { TrainingCenterApi } from '../../../training-centers/api/training-center.api';

import { HasRoleDirective } from '../../../../core/auth/has-role.directive';
import { ScrollMirrorDirective } from '../../../../shared/directives/scroll-mirror.directive';
import { ToastService } from '../../../../shared/toast/toast.service';
import { SidebarCountsService } from '../../../../shared/layout/sidebar/sidebar-counts.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

type SortKey =
  | 'name'
  | 'description'
  | 'pilotCenters'
  | 'organisms'
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

type SectorRow = Sector & {
  pilotCenterIds: number[];
  organismIds: number[];
  centerAccreditationIds: number[];
};

@Component({
  selector: 'app-sectors',
  standalone: true,
  imports: [...SHARED_IMPORTS, HasRoleDirective, ScrollMirrorDirective],
  templateUrl: './sectors.html',
  styleUrl: './sectors.css',
})
export class Sectors implements OnInit {
  items: SectorRow[] = [];
  archivedItems: SectorRow[] = [];
  private allItems: SectorRow[] = [];

  loading = false;
  error: string | null = null;

  search = '';
  filterPilotCenterId: number | null = null;
  filterOrganismId: number | null = null;
  filterAccreditationId: number | null = null;

  availablePilotCenters: { id: number; name: string }[] = [];
  availableOrganisms: { id: number; name: string }[] = [];
  availableAccreditations: { id: number; label: string }[] = [];

  computeFilterOptions(): void {
    const pilotCenters = new Map<number, string>();
    const organisms = new Map<number, string>();
    const accreditations = new Map<number, string>();
    for (const x of this.allItems) {
      for (const id of x.pilotCenterIds) {
        if (!pilotCenters.has(id)) { const name = this.pilotCenterNames.get(id); if (name) pilotCenters.set(id, name); }
      }
      for (const id of x.organismIds) {
        if (!organisms.has(id)) { const name = this.organismNames.get(id); if (name) organisms.set(id, name); }
      }
      for (const id of this.accrIdsBySector.get(x.id!) ?? []) {
        if (!accreditations.has(id)) { accreditations.set(id, this.accreditationLabelById.get(id) ?? `#${id}`); }
      }
    }
    this.availablePilotCenters = Array.from(pilotCenters.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    this.availableOrganisms = Array.from(organisms.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    this.availableAccreditations = Array.from(accreditations.entries()).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }

  setFilterPilotCenterId(value: number | null): void {
    this.filterPilotCenterId = value;
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

  setFilterAccreditationId(value: number | null): void {
    this.filterAccreditationId = value;
    this.applyLocalFilters();
    this.selected.clear();
    this.action = '';
  }

  sortKey: SortKey = 'name';
  sortDir: 'asc' | 'desc' = 'asc';

  pageSize = 50;
  currentPage = 1;

  pagedItems: SectorRow[] = [];
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
  showDescription = true;
  showPilotCenters = true;
  showOrganisms = true;
  showCenterAccreditations = true;
  showCreatedAt = false;
  showUpdatedAt = false;
  showUpdatedBy = false;

  private readonly STORAGE_KEY = 'b12.sectors.columns.v2';

  private pilotCenterNames = new Map<number, string>();
  private organismNames = new Map<number, string>();
  private accrBySector = new Map<number, string[]>();
  private accrIdsBySector = new Map<number, number[]>();
  private accreditationLabelById = new Map<number, string>();

  private toast = inject(ToastService);
  private sidebarCounts = inject(SidebarCountsService);
  private confirmDialog = inject(ConfirmDialogService);

  get hasActiveFilter(): boolean {
    return this.search.trim() !== '' || this.filterPilotCenterId !== null ||
      this.filterOrganismId !== null || this.filterAccreditationId !== null;
  }

  constructor(
    private api: SectorApi,
    private router: Router,
    private pilotCenterApi: PilotCenterApi,
    private organismApi: OrganismApi,
    private caApi: CenterAccreditationApi,
    private tcApi: TrainingCenterApi,
  ) {}

  ngOnInit(): void {
    this.restoreColumnPrefs();
    this.loadLookups();
    this.load();
  }

  private loadLookups(): void {
    this.pilotCenterApi.findAll().subscribe({
      next: (data) => {
        this.pilotCenterNames.clear();
        for (const pc of data) {
          if (pc.id != null) this.pilotCenterNames.set(pc.id, pc.name);
        }
      },
      error: () => {},
    });

    this.organismApi.findAll().subscribe({
      next: (data) => {
        this.organismNames.clear();
        for (const o of data) {
          if (o.id != null) this.organismNames.set(o.id, o.name);
        }
      },
      error: () => {},
    });

    forkJoin({
      accreditations: this.caApi.findAll(),
      trainingCenters: this.tcApi.findAll(),
    }).subscribe({
      next: ({ accreditations, trainingCenters }) => {
        const tcMap = new Map<number, { name: string; sectorIds: number[] }>();
        for (const tc of trainingCenters) {
          if (tc.id != null) {
            tcMap.set(tc.id, { name: tc.name ?? `#${tc.id}`, sectorIds: tc.sectorIds ?? [] });
          }
        }
        this.accrBySector.clear();
        this.accrIdsBySector.clear();
        this.accreditationLabelById.clear();
        for (const acc of accreditations) {
          if (acc.trainingCenterId == null) continue;
          const tc = tcMap.get(acc.trainingCenterId);
          if (!tc) continue;
          for (const sectorId of tc.sectorIds) {
            if (!this.accrBySector.has(sectorId)) this.accrBySector.set(sectorId, []);
            this.accrBySector.get(sectorId)!.push(tc.name);
            if (acc.id != null) {
              if (!this.accrIdsBySector.has(sectorId)) this.accrIdsBySector.set(sectorId, []);
              if (!this.accrIdsBySector.get(sectorId)!.includes(acc.id)) {
                this.accrIdsBySector.get(sectorId)!.push(acc.id);
              }
            }
          }
          if (acc.id != null) {
            const num = acc.accreditationNumber;
            const label = num ? `${tc.name} – N°${num}` : tc.name;
            this.accreditationLabelById.set(acc.id, label);
          }
        }
        this.computeFilterOptions();
        this.applyLocalFilters();
      },
      error: () => {},
    });
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.api.findAll().subscribe({
      next: (data: any[]) => {
        this.allItems = (data ?? []).map((d: any) => ({
          id: d.id,
          name: d.name,
          description: d.description ?? null,
          archived: !!d.archived,

          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
          updatedBy: d.updatedBy ?? null,
          createdBy: d.createdBy ?? null,

          organismIds: Array.isArray(d.organismIds) ? d.organismIds : [],
          pilotCenterIds: Array.isArray(d.pilotCenterIds) ? d.pilotCenterIds : [],

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
        this.error = err?.error?.message || 'Impossible de charger les secteurs.';
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
      (key === 'description' && !this.showDescription) ||
      (key === 'pilotCenters' && !this.showPilotCenters) ||
      (key === 'organisms' && !this.showOrganisms) ||
      (key === 'centerAccreditations' && !this.showCenterAccreditations) ||
      (key === 'createdAt' && !this.showCreatedAt) ||
      (key === 'updatedAt' && !this.showUpdatedAt) ||
      (key === 'updatedBy' && !this.showUpdatedBy)
    ) {
      return;
    }

    if (this.sortKey === key) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else {
      this.sortKey = key;
      this.sortDir = 'asc';
    }
    this.applyLocalFilters();
  }

  toggleAll(checked: boolean) {
    this.selected.clear();
    if (checked) for (const x of this.items) if (x.id != null) this.selected.add(x.id);
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

    // ✅ Dupliquer = 1 seul élément
    if (this.action === 'duplicate') return this.selected.size !== 1;

    return this.selected.size === 0;
  }

  async runAction(): Promise<void> {
    if (!this.action) return;
  
    // ✅ DUPLICATE
    if (this.action === 'duplicate') {
      if (this.selected.size !== 1) {
        this.toast.warning('Veuillez sélectionner exactement 1 secteur à dupliquer.');
        return;
      }
      const id = Array.from(this.selected.values())[0];
      this.router.navigate(['/sectors/new'], { queryParams: { cloneId: id } });
      return;
    }
  
    // exports
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
  
    // bulk actions
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
      let msg = `Supprimer ${ids.length} secteur(s) ?\n\n`;
      for (const r of rows) {
        msg += `• ${r.name}\n`;
        const pcs = this.formatPilotCenters(r.pilotCenterIds, 999);
        if (pcs !== '-') msg += `  Centres pilotes : ${pcs}\n`;
        const orgs = this.formatOrganisms(r.organismIds, 999);
        if (orgs !== '-') msg += `  Organismes : ${orgs}\n`;
        const accrs = this.formatAccreditations(r.id, 999);
        if (accrs !== '-') msg += `  Agréments : ${accrs}\n`;
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

    // sécurité : action inconnue
    this.loading = false;
    this.action = '';
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
        const filename = selected ? `sectors-selection.${format}` : `sectors.${format}`;
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

    if (this.filterPilotCenterId !== null) {
      arr = arr.filter((x) => x.pilotCenterIds.includes(this.filterPilotCenterId!));
    }

    if (this.filterOrganismId !== null) {
      arr = arr.filter((x) => x.organismIds.includes(this.filterOrganismId!));
    }

    if (this.filterAccreditationId !== null) {
      arr = arr.filter((x) => (this.accrIdsBySector.get(x.id!) ?? []).includes(this.filterAccreditationId!));
    }

    if (q) {
      arr = arr.filter((x) => {
        const pilotText = this.formatPilotCenters(x.pilotCenterIds, 999).toLowerCase();
        const orgText = this.formatOrganisms(x.organismIds, 999).toLowerCase();
        const accText = this.formatAccreditations(x.id, 999).toLowerCase();

        return (
          (x.name ?? '').toLowerCase().includes(q) ||
          (x.description ?? '').toLowerCase().includes(q) ||
          pilotText.includes(q) ||
          orgText.includes(q) ||
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

  private sortValue(x: SectorRow): string | number {
    switch (this.sortKey) {
      case 'name':
        return (x.name ?? '').toLowerCase();
      case 'description':
        return (x.description ?? '').toLowerCase();
      case 'pilotCenters':
        return x.pilotCenterIds?.length ?? 0;
      case 'organisms':
        return x.organismIds?.length ?? 0;
      case 'centerAccreditations':
        return x.centerAccreditationIds?.length ?? 0;
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

  formatRelation(ids?: number[], max = 3): string {
    const arr = (ids ?? []).filter((x) => typeof x === 'number');
    if (arr.length === 0) return '-';
    const head = arr.slice(0, max).join(', ');
    const rest = arr.length - max;
    return rest > 0 ? `${head} +${rest}` : head;
  }

  formatPilotCenters(ids?: number[], max = 3): string {
    const arr = (ids ?? []).filter((x) => typeof x === 'number');
    if (arr.length === 0) return '-';
    const head = arr.slice(0, max).map((id) => this.pilotCenterNames.get(id) ?? `#${id}`);
    const rest = arr.length - max;
    return rest > 0 ? `${head.join(', ')} +${rest}` : head.join(', ');
  }

  formatOrganisms(ids?: number[], max = 3): string {
    const arr = (ids ?? []).filter((x) => typeof x === 'number');
    if (arr.length === 0) return '-';
    const head = arr.slice(0, max).map((id) => this.organismNames.get(id) ?? `#${id}`);
    const rest = arr.length - max;
    return rest > 0 ? `${head.join(', ')} +${rest}` : head.join(', ');
  }

  formatAccreditations(sectorId?: number, max = 3): string {
    if (sectorId == null) return '-';
    const names = this.accrBySector.get(sectorId) ?? [];
    if (names.length === 0) return '-';
    const head = names.slice(0, max);
    const rest = names.length - max;
    return rest > 0 ? `${head.join(', ')} +${rest}` : head.join(', ');
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

  setShowDescription(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showDescription = v;
    this.persistColumnPrefs();
    this.ensureValidSort();
  }

  setShowPilotCenters(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showPilotCenters = v;
    this.persistColumnPrefs();
    this.ensureValidSort();
  }

  setShowOrganisms(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showOrganisms = v;
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
      (this.sortKey === 'description' && !this.showDescription) ||
      (this.sortKey === 'pilotCenters' && !this.showPilotCenters) ||
      (this.sortKey === 'organisms' && !this.showOrganisms) ||
      (this.sortKey === 'centerAccreditations' && !this.showCenterAccreditations) ||
      (this.sortKey === 'createdAt' && !this.showCreatedAt) ||
      (this.sortKey === 'updatedAt' && !this.showUpdatedAt) ||
      (this.sortKey === 'updatedBy' && !this.showUpdatedBy);

    if (hidden) {
      this.sortKey = this.showName ? 'name'
        : this.showDescription ? 'description'
        : this.showPilotCenters ? 'pilotCenters'
        : this.showOrganisms ? 'organisms'
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
          showDescription: this.showDescription,
          showPilotCenters: this.showPilotCenters,
          showOrganisms: this.showOrganisms,
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
      if (typeof obj.showDescription === 'boolean') this.showDescription = obj.showDescription;
      if (typeof obj.showPilotCenters === 'boolean') this.showPilotCenters = obj.showPilotCenters;
      if (typeof obj.showOrganisms === 'boolean') this.showOrganisms = obj.showOrganisms;
      if (typeof obj.showCenterAccreditations === 'boolean') this.showCenterAccreditations = obj.showCenterAccreditations;
      if (typeof obj.showCreatedAt === 'boolean') this.showCreatedAt = obj.showCreatedAt;
      if (typeof obj.showUpdatedAt === 'boolean') this.showUpdatedAt = obj.showUpdatedAt;
      if (typeof obj.showUpdatedBy === 'boolean') this.showUpdatedBy = obj.showUpdatedBy;
    } catch {}
  }

  tableColspan(): number {
    let cols = 1; // checkbox
    if (this.showName) cols++;
    if (this.showDescription) cols++;
    if (this.showPilotCenters) cols++;
    if (this.showOrganisms) cols++;
    if (this.showCenterAccreditations) cols++;
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
      (this.showDescription ? 1 : 0) +
      (this.showPilotCenters ? 1 : 0) +
      (this.showOrganisms ? 1 : 0) +
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
