import { Component, HostListener, OnInit, inject } from '@angular/core';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { UserAdminApi } from '../../api/user-admin.api';
import { User, Role } from '../../models/user.models';
import { ToastService } from '../../../../shared/toast/toast.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

type Action =
  | ''
  | 'activate'
  | 'deactivate'
  | 'setRoleAdmin'
  | 'setRoleUser'
  | 'setRoleVisitor';

type SortBy = 'email' | 'role' | 'active';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './users.html',
  styleUrls: ['./users.css'],
})
export class Users implements OnInit {
  private api = inject(UserAdminApi);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);

  loading = false;
  error: string | null = null;

  items: User[] = [];

  // selection + actions
  selected = new Set<number>();
  action: Action = '';

  // filters
  search = '';
  roleFilter: 'all' | Role = 'all';
  activeFilter: 'all' | 'true' | 'false' = 'all';

  // ✅ sorting
  sortBy: SortBy = 'email';
  sortDir: SortDir = 'asc';

  pageSize = 50;
  currentPage = 1;

  // colonnes
  columnsOpen = false;
  showEmail = true;
  showRole = true;
  showActive = true;
  showForcePasswordChange = true;

  private readonly STORAGE_KEY = 'b12.users.columns';

  get hasActiveFilter(): boolean {
    return this.search.trim() !== '' || this.roleFilter !== 'all' || this.activeFilter !== 'all';
  }

  filteredUsers: User[] = [];
  pagedUsers: User[] = [];
  pageNumbers: number[] = [];

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize));
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePaged();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  private applyFilters(): void {
    this.filteredUsers = this.filteredItems();
    this.updatePaged();
  }

  private updatePaged(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedUsers = this.filteredUsers.slice(start, start + this.pageSize);
    const total = this.totalPages;
    if (total <= 7) { this.pageNumbers = Array.from({ length: total }, (_, i) => i + 1); return; }
    const pages: number[] = [1];
    if (this.currentPage > 3) pages.push(-1);
    for (let i = Math.max(2, this.currentPage - 1); i <= Math.min(total - 1, this.currentPage + 1); i++) pages.push(i);
    if (this.currentPage < total - 2) pages.push(-1);
    pages.push(total);
    this.pageNumbers = pages;
  }

  ngOnInit(): void {
    this.restoreColumnPrefs();
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.api.list().subscribe({
      next: (data) => {
        this.items = data ?? [];
        this.loading = false;
        this.selected.clear();
        this.action = '';
        this.applyFilters();
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        this.error =
          err?.error?.message || 'Erreur lors du chargement des utilisateurs.';
      },
    });
  }

  // =========================
  // Selection helpers
  // =========================
  toggleAll(checked: boolean) {
    this.selected.clear();
    if (checked) {
      for (const u of this.filteredUsers) {
        if (u.id != null) this.selected.add(u.id);
      }
    }
  }

  toggleOne(id: number, checked: boolean) {
    if (checked) this.selected.add(id);
    else this.selected.delete(id);
  }

  isSelected(id: number) {
    return this.selected.has(id);
  }

  selectedCount() {
    return this.selected.size;
  }

  // =========================
  // Bulk actions
  // =========================
  async runAction(): Promise<void> {
    if (this.selected.size === 0) return;
    if (!this.action) return;

    const ids = Array.from(this.selected.values());

    // active actions
    if (this.action === 'activate' || this.action === 'deactivate') {
      const active = this.action === 'activate';
      const ok = await this.confirmDialog.confirm(
        `${active ? 'Activer' : 'Désactiver'} ${ids.length} utilisateur(s) ?`
      );
      if (!ok) return;

      this.loading = true;
      this.error = null;

      let done = 0;
      let failed = 0;

      ids.forEach((id) => {
        this.api.setActive(id, active).subscribe({
          next: () => {
            done++;
            this.afterBulk(done, failed, ids.length);
          },
          error: (err) => {
            console.error(err);
            failed++;
            this.afterBulk(done, failed, ids.length);
          },
        });
      });

      return;
    }

    // role actions
    const role = this.roleFromAction(this.action);
    if (!role) return;

    const ok = await this.confirmDialog.confirm(`Changer le rôle en ${role} pour ${ids.length} utilisateur(s) ?`);
    if (!ok) return;

    this.loading = true;
    this.error = null;

    let done = 0;
    let failed = 0;

    ids.forEach((id) => {
      this.api.setRole(id, role).subscribe({
        next: () => {
          done++;
          this.afterBulk(done, failed, ids.length);
        },
        error: (err) => {
          console.error(err);
          failed++;
          this.afterBulk(done, failed, ids.length);
        },
      });
    });
  }

  private roleFromAction(a: Action): Role | null {
    if (a === 'setRoleAdmin') return 'ADMIN';
    if (a === 'setRoleUser') return 'USER';
    if (a === 'setRoleVisitor') return 'VISITOR';
    return null;
  }

  private afterBulk(done: number, failed: number, total: number) {
    if (done + failed < total) return;

    this.loading = false;
    this.selected.clear();
    this.action = '';

    if (failed > 0) {
      this.toast.warning(`${done} OK, ${failed} erreur(s).`);
    } else {
      this.toast.success('Opération effectuée avec succès.');
    }

    this.load();
  }

  // =========================
  // Reset password (prompt simple)
  // =========================
  resetPassword(u: User) {
    const pwd = prompt(`Nouveau mot de passe pour ${u.email} :`);
    if (!pwd) return;

    const confirmPwd = prompt(`Confirmer le nouveau mot de passe :`);
    if (!confirmPwd) return;

    if (pwd !== confirmPwd) {
      this.toast.warning('Les mots de passe ne correspondent pas.');
      return;
    }

    this.loading = true;
    this.error = null;

    this.api
      .resetPassword(u.id, { newPassword: pwd, confirmPassword: confirmPwd })
      .subscribe({
        next: () => {
          this.loading = false;
          this.toast.success(
            "Mot de passe réinitialisé. L’utilisateur devra le modifier à la prochaine connexion."
          );
          this.load();
        },
        error: (err) => {
          console.error(err);
          this.loading = false;
          this.error = err?.error?.message || 'Reset mot de passe impossible.';
        },
      });
  }

  // =========================
  // Delete user
  // =========================
  async deleteUser(u: User): Promise<void> {
    const ok = await this.confirmDialog.confirm(`Supprimer définitivement l’utilisateur ${u.email} ?`, { danger: true });
    if (!ok) return;

    this.loading = true;
    this.error = null;

    this.api.delete(u.id).subscribe({
      next: () => {
        this.loading = false;
        this.load();
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        this.error = err?.error?.message || 'Suppression impossible.';
      },
    });
  }

  // =========================
  // Filters + Sort
  // =========================
  filteredItems(): User[] {
    const q = this.search.trim().toLowerCase();

    let list = [...this.items];

    if (this.activeFilter !== 'all') {
      const wantActive = this.activeFilter === 'true';
      list = list.filter((u) => !!u.active === wantActive);
    }

    if (this.roleFilter !== 'all') {
      list = list.filter((u) => u.role === this.roleFilter);
    }

    if (q) {
      list = list.filter((u) => (u.email || '').toLowerCase().includes(q));
    }

    // ✅ sort
    const dir = this.sortDir === 'asc' ? 1 : -1;

    const roleRank = (r?: Role) => {
      if (r === 'ADMIN') return 1;
      if (r === 'USER') return 2;
      if (r === 'VISITOR') return 3;
      return 99;
    };

    list.sort((a, b) => {
      if (this.sortBy === 'email') {
        return dir * (a.email || '').localeCompare(b.email || '');
      }
      if (this.sortBy === 'role') {
        return dir * (roleRank(a.role) - roleRank(b.role));
      }
      // active
      const av = a.active ? 1 : 0;
      const bv = b.active ? 1 : 0;
      return dir * (bv - av); // true before false when asc
    });

    return list;
  }

  // =========================
  // Columns toggle
  // =========================
  toggleColumnsMenu() {
    this.columnsOpen = !this.columnsOpen;
  }

  setShowEmail(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showEmail = v;
    this.persistColumnPrefs();
  }

  setShowRole(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showRole = v;
    this.persistColumnPrefs();
  }

  setShowActive(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showActive = v;
    this.persistColumnPrefs();
  }

  setShowForcePasswordChange(v: boolean) {
    if (!v && this.optionalColumnsShown <= 1) return;
    this.showForcePasswordChange = v;
    this.persistColumnPrefs();
  }

  private persistColumnPrefs() {
    try {
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({
          showEmail: this.showEmail,
          showRole: this.showRole,
          showActive: this.showActive,
          showForcePasswordChange: this.showForcePasswordChange,
        })
      );
    } catch {}
  }

  private restoreColumnPrefs() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (typeof obj.showEmail === 'boolean') this.showEmail = obj.showEmail;
      if (typeof obj.showRole === 'boolean') this.showRole = obj.showRole;
      if (typeof obj.showActive === 'boolean') this.showActive = obj.showActive;
      if (typeof obj.showForcePasswordChange === 'boolean') this.showForcePasswordChange = obj.showForcePasswordChange;
    } catch {}
  }

  tableColspan(): number {
    let cols = 2; // checkbox + Actions (toujours visible)
    if (this.showEmail) cols++;
    if (this.showRole) cols++;
    if (this.showActive) cols++;
    if (this.showForcePasswordChange) cols++;
    return cols;
  }

  get optionalColumnsTotal(): number {
    return 4;
  }

  get optionalColumnsShown(): number {
    return (
      (this.showEmail ? 1 : 0) +
      (this.showRole ? 1 : 0) +
      (this.showActive ? 1 : 0) +
      (this.showForcePasswordChange ? 1 : 0)
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
