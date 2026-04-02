import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { SubThemeApi } from '../../api/sub-theme.api';
import { SubTheme } from '../../models/sub-theme.model';
import { ToastService } from '../../../../shared/toast/toast.service';

@Component({
  selector: 'app-sub-theme-detail',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './sub-theme-detail.html',
  styleUrl: './sub-theme-detail.css',
})
export class SubThemeDetail implements OnInit {
  private api = inject(SubThemeApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);

  themeId!: number;
  subId!: number;

  loading = false;
  saving = false;
  error: string | null = null;

  st: SubTheme | null = null;

  // form fields
  name = '';
  description: string | null = null;
  hours: number | null = null;
  archived = false;

  ngOnInit(): void {
    const pm = this.route.snapshot.paramMap;

    // ✅ robust: selon ton app.routes.ts ça peut être "id" ou "themeId"
    const themeRaw = pm.get('themeId') ?? pm.get('id');
    const subRaw = pm.get('subId') ?? pm.get('subThemeId') ?? pm.get('sub') ?? pm.get('sid') ?? pm.get('id');

    this.themeId = Number(themeRaw);
    this.subId = Number(subRaw);

    if (!this.subId || Number.isNaN(this.subId)) {
      this.error = 'ID de sous-thème invalide.';
      return;
    }

    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.api.get(this.subId).subscribe({
      next: (data) => {
        this.st = data;

        // ✅ si la route a foiré, on récupère le themeId depuis l’objet
        if (!this.themeId || Number.isNaN(this.themeId)) {
          this.themeId = Number((data as any).themeId);
        }

        this.name = data.name ?? '';
        this.description = data.description ?? null;
        this.hours = (data.hours ?? null) as number | null;
        this.archived = !!data.archived;

        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = err?.error?.message || 'Impossible de charger le sous-thème.';
        this.loading = false;
      },
    });
  }

  save(): void {
    if (!this.name.trim()) {
      this.toast.warning('Le nom est obligatoire.');
      return;
    }

    const hoursValue =
      this.hours === null || (this.hours as any) === ''
        ? null
        : Number(this.hours);

    if (hoursValue !== null && (Number.isNaN(hoursValue) || hoursValue < 0)) {
      this.toast.warning('Les heures doivent être un nombre positif (ou vide).');
      return;
    }

    this.saving = true;
    this.error = null;

    // ✅ IMPORTANT : NE PAS envoyer themeId dans update (inutile + cause ton bug si themeId=0)
    this.api.update(this.subId, {
      name: this.name.trim(),
      description: this.description?.trim() || null,
      hours: hoursValue,
      archived: this.archived,
    }).subscribe({
      next: () => {
        this.saving = false;
        this.toast.success('Sous-thème mis à jour.');
        this.router.navigateByUrl(`/thematics/${this.themeId}`);
      },
      error: (err) => {
        console.error(err);
        this.error = err?.error?.message || "Impossible d'enregistrer.";
        this.saving = false;
      },
    });
  }

  cancel(): void {
    // ✅ retour logique vers le détail du thème
    this.router.navigateByUrl(`/thematics/${this.themeId}`);
  }
}
