import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { ThemeApi } from '../../api/theme.api';
import { Theme } from '../../models/theme.model';
import { ToastService } from '../../../../shared/toast/toast.service';

@Component({
  selector: 'app-theme-edit',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './theme-edit.html',
  styleUrl: './theme-edit.css',
})
export class ThemeEdit implements OnInit {
  private api = inject(ThemeApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);

  id!: number;

  loading = false;
  saving = false;
  error: string | null = null;

  theme: Theme | null = null;

  // form fields
  name = '';
  description: string | null = null;
  archived = false;

  // ✅ pour détecter un changement d'état d'archivage
  private initialArchived = false;

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('id');
    this.id = Number(raw);
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.api.get(this.id).subscribe({
      next: (data) => {
        this.theme = data;

        this.name = data.name ?? '';
        this.description = data.description ?? null;
        this.archived = !!data.archived;

        // ✅ mémorise l’état initial
        this.initialArchived = this.archived;

        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = err?.error?.message || 'Impossible de charger la thématique.';
        this.loading = false;
      },
    });
  }

  save(): void {
    if (!this.name.trim()) {
      this.toast.warning('Le nom est obligatoire.');
      return;
    }

    this.saving = true;
    this.error = null;

    const payload = {
      name: this.name.trim(),
      description: this.description?.trim() || null,
    };

    const archivedChanged = this.archived !== this.initialArchived;

    // ✅ 1) update (name/description)
    this.api.update(this.id, { ...payload, archived: this.archived }).subscribe({
      next: () => {
        // ✅ 2) si l’état archived a changé et que ton backend le gère via /archive
        if (archivedChanged) {
          this.api.archive(this.id, this.archived).subscribe({
            next: () => {
              this.saving = false;
              this.toast.success('Thématique mise à jour.');
              this.router.navigateByUrl(`/thematics/${this.id}`);
            },
            error: (err) => {
              console.error(err);
              this.error = err?.error?.message || "Impossible d'archiver/désarchiver.";
              this.saving = false;
            },
          });
          return;
        }

        this.saving = false;
        this.toast.success('Thématique mise à jour.');
        this.router.navigateByUrl(`/thematics/${this.id}`);
      },
      error: (err) => {
        console.error(err);
        this.error = err?.error?.message || "Impossible d'enregistrer.";
        this.saving = false;
      },
    });
  }

  cancel(): void {
    this.router.navigateByUrl(`/thematics/${this.id}`);
  }
}
