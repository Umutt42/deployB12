import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { LicenseTypeApi } from '../../api/license-type.api';
import { LicenseType } from '../../models/license-type.model';
import { ToastService } from '../../../../shared/toast/toast.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

@Component({
  selector: 'app-license-type-detail',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './license-type-detail.html',
  styleUrl: './license-type-detail.css',
})
export class LicenseTypeDetail implements OnInit {
  private api = inject(LicenseTypeApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);

  id!: number;

  loading = false;
  saving = false;
  error: string | null = null;

  lt: LicenseType | null = null;

  code = '';
  label = '';
  description: string | null = null;
  archived = false;

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('id');
    this.id = Number(raw);

    if (!this.id || Number.isNaN(this.id)) {
      this.error = 'ID invalide.';
      return;
    }

    this.load();
  }

  load() {
    this.loading = true;
    this.error = null;

    this.api.get(this.id).subscribe({
      next: (data) => {
        this.lt = data;
        this.code = data.code ?? '';
        this.label = data.label ?? '';
        this.description = data.description ?? null;
        this.archived = !!data.archived;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Impossible de charger le type de phytolicence.';
        this.loading = false;
      },
    });
  }

  save() {
    if (!this.label.trim()) {
      this.toast.warning('Le label est obligatoire.');
      return;
    }

    this.saving = true;
    this.error = null;

    this.api
      .update(this.id, {
        label: this.label.trim(),
        description: this.description?.trim() || null,
        archived: this.archived,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.toast.success('Type de phytolicence mis à jour.');
          this.router.navigateByUrl('/license-types');
        },
        error: (err) => {
          this.error = err?.error?.message || "Impossible d'enregistrer.";
          this.saving = false;
        },
      });
  }

  toggleArchive(): void {
    if (this.loading || this.saving) return;
    const newValue = !this.archived;
    this.archived = newValue;

    this.api.archive(this.id, newValue).subscribe({
      next: (updated) => {
        this.lt = updated;
        this.archived = !!updated.archived;
      },
      error: (err) => {
        this.archived = !newValue;
        this.error = err?.error?.message ?? 'Erreur archive';
      },
    });
  }

  async delete(): Promise<void> {
    if (this.loading || this.saving) return;
    if (!await this.confirmDialog.confirm(`Supprimer le type "${this.code}" ?`, { danger: true })) return;

    this.api.delete(this.id).subscribe({
      next: () => {
        this.toast.success('Type supprimé.');
        this.router.navigateByUrl('/license-types');
      },
      error: (err) => (this.error = err?.error?.message ?? 'Erreur suppression'),
    });
  }

  formatDate(v: any): string {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString('fr-BE');
  }
}
