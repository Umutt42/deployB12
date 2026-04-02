import { Component, OnInit, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { LicenseTypeApi } from '../../api/license-type.api';
import { LicenseType } from '../../models/license-type.model';

import { HasRoleDirective } from '../../../../core/auth/has-role.directive';
import { ToastService } from '../../../../shared/toast/toast.service';
import { SidebarCountsService } from '../../../../shared/layout/sidebar/sidebar-counts.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

type SortKey = 'code' | 'description' | 'archived' | 'createdAt' | 'updatedAt';

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

@Component({
  selector: 'app-license-types',
  standalone: true,
  imports: [...SHARED_IMPORTS, HasRoleDirective],
  templateUrl: './license-types.html',
  styleUrl: './license-types.css',
})
export class LicenseTypes implements OnInit {
  items: LicenseType[] = [];
  archivedItems: LicenseType[] = [];
  private allItems: LicenseType[] = [];

  loading = false;
  error: string | null = null;

  search = '';
  archivedFilter: 'all' | 'true' | 'false' = 'all';

  sortKey: SortKey = 'code';
  sortDir: 'asc' | 'desc' = 'asc';

  selected = new Set<number>();
  archivingIds = new Set<number>();
  action: ActionKey = '';

  pageSize = 50;
  currentPage = 1;
  currentArchivedPage = 1;

  columnsOpen = false;
  showCode = true;
  showDescription = true;
  showCreatedAt = false;
  showUpdatedAt = false;
  showUpdatedBy = false;

  private readonly STORAGE_KEY = 'b12.licenseTypes.columns.v2';

  private toast = inject(ToastService);
  private sidebarCounts = inject(SidebarCountsService);
  private confirmDialog = inject(ConfirmDialogService);

  pagedActiveItems: LicenseType[] = [];
  pageNumbers: number[] = [];
  pagedArchivedItems: LicenseType[] = [];
  archivedPageNumbers: number[] = [];

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.activeItems.length / this.pageSize));
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
    this.pagedActiveItems = this.activeItems.slice(start, start + this.pageSize);
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

  constructor(private api: LicenseTypeApi, private router: Router) {}

  ngOnInit(): void {
    this.restoreColumnPrefs();
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.api.findAll().subscribe({
      next: (data) => {
        this.allItems = data ?? [];
        this.applyLocalFilters();
        this.selected.clear();
        this.action = '';
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = err?.error?.message || 'Impossible de charger les types de phytolicences.';
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

  onArchivedChange(value: string): void {
    this.archivedFilter = value as 'all' | 'true' | 'false';
    this.applyLocalFilters();
    this.selected.clear();
    this.action = '';
  }

  setSort(key: SortKey) {
    if (
      (key === 'code' && !this.showCode) ||
      (key === 'description' && !this.showDescription) ||
      (key === 'createdAt' && !this.showCreatedAt) ||
      (key === 'updatedAt' && !this.showUpdatedAt)
    ) return;

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
    // ✅ Dupliquer : exactement 1 sélection
    if (this.action === 'duplicate') return this.selected.size !== 1;

    return this.selected.size === 0;
  }

  async runAction(): Promise<void> {
    if (!this.action) return;

    // ✅ DUPLICATE : 1 seule ligne, navigation vers le formulaire d'ajout pré-rempli
    if (this.action === 'duplicate') {
      if (this.selected.size !== 1) { this.toast.warning('Veuillez sélectionner exactement 1 élément à dupliquer.'); return; }
      const id = Array.from(this.selected.values())[0];
      this.router.navigate(['/license-types/new'], { queryParams: { cloneId: id } });
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

    if (this.selected.size === 0) { this.toast.warning('Aucun élément sélectionné.'); return; }

    const ids = Array.from(this.selected.values());
    this.loading = true;

    if (this.action === 'archive' || this.action === 'unarchive') {
      const archived = this.action === 'archive';
      for (const id of ids) this.archivingIds.add(id);
      this.bulkProcess(ids, (id) => this.api.archive(id, archived));
      return;
    }

    if (this.action === 'delete') {
      const rows = this.allItems.filter(lt => ids.includes(lt.id!));
      let msg = `Supprimer ${ids.length} type(s) de phytolicence ?\n\n`;
      for (const lt of rows) {
        msg += `• ${lt.code.toUpperCase()}`;
        if (lt.description) msg += ` — ${lt.description}`;
        msg += '\n';
      }
      msg += '\nCette action est irréversible.';
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
        const filename = selected ? `license-types-selection.${format}` : `license-types.${format}`;
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

  private bulkProcess(ids: number[], call: (id: number) => any) {
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
      arr = arr.filter(
        (x) =>
          (x.code ?? '').toLowerCase().includes(q) ||
          (x.description ?? '').toLowerCase().includes(q)
      );
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

    if (this.archivedFilter === 'true') {
      this.items = arr.filter((x) => x.archived);
    } else if (this.archivedFilter === 'false') {
      this.items = arr.filter((x) => !x.archived);
    } else {
      this.items = arr;
    }
    this.archivedItems = arr.filter((x) => x.archived);
    this.activeItems = arr.filter((x) => !x.archived);
    this.updatePaged();
    this.updateArchivedPaged();
  }

  private sortValue(x: LicenseType): string | number {
    switch (this.sortKey) {
      case 'code':
        return (x.code ?? '').toLowerCase();
      case 'description':
        return (x.description ?? '').toLowerCase();
      case 'archived':
        return x.archived ? 1 : 0;
      case 'createdAt':
        return x.createdAt ? new Date(x.createdAt).getTime() : 0;
      case 'updatedAt':
        return x.updatedAt ? new Date(x.updatedAt).getTime() : 0;
    }
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

  setShowCode(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showCode = v;
    this.persistColumnPrefs();
    this.ensureValidSort();
  }

  setShowDescription(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showDescription = v;
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
  }

  private ensureValidSort() {
    const hidden =
      (this.sortKey === 'code' && !this.showCode) ||
      (this.sortKey === 'description' && !this.showDescription) ||
      (this.sortKey === 'createdAt' && !this.showCreatedAt) ||
      (this.sortKey === 'updatedAt' && !this.showUpdatedAt);

    if (hidden) {
      this.sortKey = this.showCode ? 'code'
        : this.showDescription ? 'description'
        : this.showCreatedAt ? 'createdAt'
        : 'updatedAt';
      this.sortDir = 'asc';
      this.applyLocalFilters();
    }
  }

  private persistColumnPrefs() {
    try {
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({
          showCode: this.showCode,
          showDescription: this.showDescription,
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
      if (typeof obj.showCode === 'boolean') this.showCode = obj.showCode;
      if (typeof obj.showDescription === 'boolean') this.showDescription = obj.showDescription;
      if (typeof obj.showCreatedAt === 'boolean') this.showCreatedAt = obj.showCreatedAt;
      if (typeof obj.showUpdatedAt === 'boolean') this.showUpdatedAt = obj.showUpdatedAt;
      if (typeof obj.showUpdatedBy === 'boolean') this.showUpdatedBy = obj.showUpdatedBy;
      this.ensureValidSort();
    } catch {}
  }

  tableColspan(): number {
    let cols = 1; // checkbox
    if (this.showCode) cols++;
    if (this.showDescription) cols++;
    if (this.showCreatedAt) cols++;
    if (this.showUpdatedAt) cols++;
    if (this.showUpdatedBy) cols++;
    return cols;
  }

  activeItems: LicenseType[] = [];

  get optionalColumnsTotal(): number {
    return 5;
  }

  get optionalColumnsShown(): number {
    return (
      (this.showCode ? 1 : 0) +
      (this.showDescription ? 1 : 0) +
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
