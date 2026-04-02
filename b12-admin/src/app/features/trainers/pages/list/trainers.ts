import { Component, HostListener, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';
import { HasRoleDirective } from '../../../../core/auth/has-role.directive';
import { ScrollMirrorDirective } from '../../../../shared/directives/scroll-mirror.directive';
import { ToastService } from '../../../../shared/toast/toast.service';
import { SidebarCountsService } from '../../../../shared/layout/sidebar/sidebar-counts.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

import { TrainerApi, TrainerDto } from '../../api/trainer.api';

type SortKey =
  | 'firstName' | 'lastName' | 'email' | 'phone'
  | 'phytolicenceNumber' | 'trainingAccreditation'
  | 'trainingCenters' | 'comment'
  | 'createdAt' | 'updatedAt' | 'updatedBy';

type ActionKey =
  | '' | 'archive' | 'unarchive' | 'duplicate' | 'delete'
  | 'export_csv_all' | 'export_xlsx_all' | 'export_pdf_all'
  | 'export_csv_selected' | 'export_xlsx_selected' | 'export_pdf_selected'
  | 'export_csv_all_archived' | 'export_xlsx_all_archived' | 'export_pdf_all_archived';

@Component({
  selector: 'app-trainers',
  standalone: true,
  imports: [...SHARED_IMPORTS, HasRoleDirective, ScrollMirrorDirective],
  templateUrl: './trainers.html',
  styleUrl: './trainers.css',
})
export class Trainers implements OnInit {
  items: TrainerDto[] = [];
  archivedItems: TrainerDto[] = [];
  private allItems: TrainerDto[] = [];

  loading = false;
  error: string | null = null;

  search = '';
  filterAccreditationId:   number | null = null;
  filterTrainingCenterId:  number | null = null;
  sortKey: SortKey = 'lastName';
  sortDir: 'asc' | 'desc' = 'asc';

  availableAccreditations: { id: number; label: string }[] = [];
  availableTrainingCenters: { id: number; label: string }[] = [];

  private computeFilterOptions(): void {
    const accreditations = new Map<number, string>();
    const trainingCenters = new Map<number, string>();
    for (const x of this.allItems) {
      if (x.trainingAccreditationId != null && !accreditations.has(x.trainingAccreditationId)) {
        accreditations.set(x.trainingAccreditationId, x.trainingAccreditationLabel ?? `#${x.trainingAccreditationId}`);
      }
      (x.trainingAccreditationIds ?? []).forEach((id, idx) => {
        if (!accreditations.has(id)) accreditations.set(id, (x.trainingAccreditationLabels ?? [])[idx] ?? `#${id}`);
      });
      (x.trainingCenterIds ?? []).forEach((id, idx) => {
        if (!trainingCenters.has(id)) trainingCenters.set(id, (x.trainingCenterLabels ?? [])[idx] ?? `#${id}`);
      });
    }
    this.availableAccreditations = Array.from(accreditations.entries()).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
    this.availableTrainingCenters = Array.from(trainingCenters.entries()).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }

  setFilterAccreditationId(value: number | null): void {
    this.filterAccreditationId = value;
    this.applyLocalFilters();
    this.selected.clear();
  }

  setFilterTrainingCenterId(value: number | null): void {
    this.filterTrainingCenterId = value;
    this.applyLocalFilters();
    this.selected.clear();
  }

  pageSize = 50;
  currentPage = 1;

  pagedItems: TrainerDto[] = [];
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

  showFirstName             = true;
  showLastName              = true;
  showEmail                 = true;
  showPhone                 = true;
  showPhytolicenceNumber    = true;
  showTrainingAccreditation = true;
  showTrainingCenters       = true;
  showComment               = false;
  showCreatedAt             = false;
  showUpdatedAt             = false;
  showUpdatedBy             = false;

  private readonly STORAGE_KEY = 'b12.trainers.columns.v2';

  private toast = inject(ToastService);
  private sidebarCounts = inject(SidebarCountsService);
  private confirmDialog = inject(ConfirmDialogService);

  get hasActiveFilter(): boolean {
    return this.search.trim() !== '' || this.filterAccreditationId !== null || this.filterTrainingCenterId !== null;
  }

  constructor(private api: TrainerApi, private router: Router) {}

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
        this.computeFilterOptions();
        this.applyLocalFilters();
        this.selected.clear();
        this.action = '';
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Impossible de charger les formateurs.';
        this.loading = false;
      },
    });
  }

  onSearchChange(value: string): void {
    this.search = value;
    this.applyLocalFilters();
    this.selected.clear();
  }

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
        this.toast.warning('Veuillez sélectionner exactement 1 formateur·trice à dupliquer.');
        return;
      }
      const id = Array.from(this.selected.values())[0];
      this.router.navigate(['/trainers/new'], { queryParams: { cloneId: id } });
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
      const ok = await this.confirmDialog.confirm(`Supprimer ${ids.length} formateur(s) ? Cette action est irréversible.`, { danger: true });
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
          ? `trainers-selection.${format}`
          : `trainers.${format}`;
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

  private applyLocalFilters(): void {
    this.currentPage = 1;
    const q = this.search.trim().toLowerCase();
    let arr = [...this.allItems];

    if (this.filterAccreditationId !== null) {
      arr = arr.filter(x =>
        x.trainingAccreditationId === this.filterAccreditationId ||
        (x.trainingAccreditationIds ?? []).includes(this.filterAccreditationId!)
      );
    }

    if (this.filterTrainingCenterId !== null) {
      arr = arr.filter(x => (x.trainingCenterIds ?? []).includes(this.filterTrainingCenterId!));
    }

    if (q) {
      arr = arr.filter(x =>
        (x.firstName ?? '').toLowerCase().includes(q) ||
        (x.lastName  ?? '').toLowerCase().includes(q) ||
        (x.email     ?? '').toLowerCase().includes(q) ||
        (x.phone     ?? '').toLowerCase().includes(q) ||
        (x.phytolicenceNumber ?? '').toLowerCase().includes(q) ||
        (x.trainingAccreditationLabel ?? '').toLowerCase().includes(q) ||
        (x.trainingAccreditationLabels ?? []).join(' ').toLowerCase().includes(q) ||
        (x.comment   ?? '').toLowerCase().includes(q) ||
        (x.trainingCenterLabels ?? []).join(' ').toLowerCase().includes(q)
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

  private sortValue(x: TrainerDto): string | number {
    switch (this.sortKey) {
      case 'firstName':             return (x.firstName ?? '').toLowerCase();
      case 'lastName':              return (x.lastName  ?? '').toLowerCase();
      case 'email':                 return (x.email     ?? '').toLowerCase();
      case 'phone':                 return (x.phone     ?? '').toLowerCase();
      case 'phytolicenceNumber':    return (x.phytolicenceNumber ?? '').toLowerCase();
      case 'trainingAccreditation': return (x.trainingAccreditationLabels ?? []).sort().join(', ').toLowerCase() || (x.trainingAccreditationLabel ?? '').toLowerCase();
      case 'trainingCenters':       return (x.trainingCenterLabels ?? []).join(', ').toLowerCase();
      case 'comment':               return (x.comment   ?? '').toLowerCase();
      case 'createdAt':             return x.createdAt ? new Date(x.createdAt).getTime() : 0;
      case 'updatedAt':             return x.updatedAt ? new Date(x.updatedAt).getTime() : 0;
      case 'updatedBy':             return (x.updatedBy ?? '').toLowerCase();
      default:                      return '';
    }
  }

  // ─── Colonnes ──────────────────────────────────────────────

  readonly optionalColumnsTotal = 11;

  get optionalColumnsShown(): number {
    return [
      this.showFirstName, this.showLastName, this.showEmail, this.showPhone,
      this.showPhytolicenceNumber, this.showTrainingAccreditation,
      this.showTrainingCenters, this.showComment,
      this.showCreatedAt, this.showUpdatedAt, this.showUpdatedBy,
    ].filter(Boolean).length;
  }

  get columnsButtonLabel(): string {
    return `Afficher / masquer (${this.optionalColumnsShown}/${this.optionalColumnsTotal}) ▾`;
  }

  tableColspan(): number {
    return 1 + this.optionalColumnsShown;
  }

  toggleColumnsMenu(): void { this.columnsOpen = !this.columnsOpen; }

  setShow(field: keyof Trainers, v: boolean): void {
    if (!v && this.optionalColumnsShown <= 1) return;
    (this as any)[field] = v;
    this.persist();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.columns-toggle-wrap')) this.columnsOpen = false;
  }

  private persist(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        showFirstName: this.showFirstName,
        showLastName: this.showLastName,
        showEmail: this.showEmail,
        showPhone: this.showPhone,
        showPhytolicenceNumber: this.showPhytolicenceNumber,
        showTrainingAccreditation: this.showTrainingAccreditation,
        showTrainingCenters: this.showTrainingCenters,
        showComment: this.showComment,
        showCreatedAt: this.showCreatedAt,
        showUpdatedAt: this.showUpdatedAt,
        showUpdatedBy: this.showUpdatedBy,
      }));
    } catch { /* ignore */ }
  }

  private restoreColumnPrefs(): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const o = JSON.parse(raw);
      if (typeof o.showFirstName             === 'boolean') this.showFirstName             = o.showFirstName;
      if (typeof o.showLastName              === 'boolean') this.showLastName              = o.showLastName;
      if (typeof o.showEmail                 === 'boolean') this.showEmail                 = o.showEmail;
      if (typeof o.showPhone                 === 'boolean') this.showPhone                 = o.showPhone;
      if (typeof o.showPhytolicenceNumber    === 'boolean') this.showPhytolicenceNumber    = o.showPhytolicenceNumber;
      if (typeof o.showTrainingAccreditation === 'boolean') this.showTrainingAccreditation = o.showTrainingAccreditation;
      if (typeof o.showTrainingCenters        === 'boolean') this.showTrainingCenters        = o.showTrainingCenters;
      if (typeof o.showComment               === 'boolean') this.showComment               = o.showComment;
      if (typeof o.showCreatedAt             === 'boolean') this.showCreatedAt             = o.showCreatedAt;
      if (typeof o.showUpdatedAt             === 'boolean') this.showUpdatedAt             = o.showUpdatedAt;
      if (typeof o.showUpdatedBy             === 'boolean') this.showUpdatedBy             = o.showUpdatedBy;
    } catch { /* ignore */ }
  }

  // ─── Formatters ────────────────────────────────────────────

  formatDate(iso?: string): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    const datePart = new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
    const timePart = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    return `${datePart} ${timePart}`;
  }

  formatLabels(labels?: string[]): string {
    if (!labels || labels.length === 0) return '-';
    return [...labels].sort().join(', ');
  }

  /** Cellule : titres seuls (partie après " — "), séparés par ", " */
  formatAccreditationTitles(labels?: string[]): string {
    if (!labels || labels.length === 0) return '-';
    return [...labels]
      .map(l => l.includes(' — ') ? l.split(' — ').slice(1).join(' — ') : l)
      .sort()
      .join(', ');
  }

  /** Tooltip : labels complets (numéro — titre), un par ligne */
  formatAccreditationTooltip(labels?: string[]): string {
    if (!labels || labels.length === 0) return '-';
    return [...labels].sort().join('\n');
  }
}
