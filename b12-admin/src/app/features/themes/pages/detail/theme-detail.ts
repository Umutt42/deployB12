import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ThemeApi } from '../../api/theme.api';
import { SubThemeApi } from '../../api/sub-theme.api';
import { Theme } from '../../models/theme.model';
import { ToastService } from '../../../../shared/toast/toast.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';
import { HasRoleDirective } from '../../../../core/auth/has-role.directive';

type SubSortKey = 'name' | 'description' | 'hours' | 'archived';

@Component({
  selector: 'app-theme-detail',
  standalone: true,
  imports: [...SHARED_IMPORTS, HasRoleDirective],
  templateUrl: './theme-detail.html',
  styleUrls: ['./theme-detail.css'],
})
export class ThemeDetail implements OnInit {
  private themeApi = inject(ThemeApi);
  private subThemeApi = inject(SubThemeApi);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);

  loading = false;
  error: string | null = null;

  id!: number;
  theme: Theme | null = null;

  // ================= TRI SOUS-THEMES =================
  subSortKey: SubSortKey = 'name';
  subSortDir: 'asc' | 'desc' = 'asc';

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.id = Number(idParam);

    if (!this.id || Number.isNaN(this.id)) {
      this.error = 'ID de thématique invalide.';
      return;
    }

    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.themeApi.get(this.id).subscribe({
      next: (data) => {
        this.theme = data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error =
          err?.error?.message ||
          'Erreur lors du chargement de la thématique.';
      },
    });
  }

  // ================= TRI =================

  setSubSort(key: SubSortKey) {
    if (this.subSortKey === key) {
      this.subSortDir = this.subSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.subSortKey = key;
      this.subSortDir = 'asc';
    }
  }

  sortedSubThemes() {
    const list = [...(this.theme?.subThemes ?? [])];

    list.sort((a: any, b: any) => {
      const dir = this.subSortDir === 'asc' ? 1 : -1;

      const av = this.subSortValue(a);
      const bv = this.subSortValue(b);

      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }

      return String(av).localeCompare(String(bv)) * dir;
    });

    return list;
  }

  private subSortValue(st: any): string | number {
    switch (this.subSortKey) {
      case 'name':
        return (st.name ?? '').toLowerCase();
      case 'description':
        return (st.description ?? '').toLowerCase();
      case 'hours':
        return Number(st.hours ?? 0);
      case 'archived':
        return st.archived ? 1 : 0;
    }
  }

  // ================= SOUS-THEMES =================

  async deleteSubTheme(subThemeId: number): Promise<void> {
    if (!await this.confirmDialog.confirm('Supprimer ce sous-thème ?', { danger: true })) return;

    this.loading = true;
    this.error = null;

    this.subThemeApi.delete(subThemeId).subscribe({
      next: () => {
        this.toast.success('Sous-thème supprimé.');
        this.load(); // refresh liste
      },
      error: (err) => {
        this.loading = false;
        this.error =
          err?.error?.message ||
          'Suppression impossible (sous-thème peut-être utilisé ailleurs).';
      },
    });
  }

  subThemesCount(): number {
    return this.theme?.subThemes?.length ?? 0;
  }

  yesNo(v: boolean) {
    return v ? '✔' : '✖';
  }
}
