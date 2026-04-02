import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { OrganismApi, OrganismDto } from '../../api/organism.api';
import { SectorApi, SectorDto } from '../../../sectors/api/sector.api';
import { PilotCenterApi, PilotCenterDto } from '../../../pilot-centers/api/pilot-center.api';
import { ToastService } from '../../../../shared/toast/toast.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

@Component({
  standalone: true,
  selector: 'app-organism-detail',
  imports: [...SHARED_IMPORTS, ReactiveFormsModule],
  templateUrl: './organism-detail.html',
  styleUrls: ['./organism-detail.css'],
})
export class OrganismDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  private api = inject(OrganismApi);
  private sectorApi = inject(SectorApi);
  private pilotCenterApi = inject(PilotCenterApi);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);

  id!: number;
  loading = true;
  saving = false;
  error: string | null = null;

  item!: OrganismDto;

  sectors: SectorDto[] = [];
  pilotCenters: PilotCenterDto[] = [];

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(180)]],
    abbreviation: ['', [Validators.maxLength(50)]],
    archived: [false],
    sectorIds: [[] as number[]],
    pilotCenterIds: [[] as number[]],
  });

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    if (!this.id) {
      this.error = 'Identifiant invalide.';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = null;

    forkJoin({
      sectors: this.sectorApi.findAll(),
      pilotCenters: this.pilotCenterApi.findAll(),
      item: this.api.get(this.id),
    }).subscribe({
      next: ({ sectors, pilotCenters, item }) => {
        this.sectors = sectors ?? [];
        this.pilotCenters = pilotCenters ?? [];
        this.item = item;

        this.form.patchValue({
          name: item.name ?? '',
          abbreviation: item.abbreviation ?? '',
          archived: !!item.archived,
          sectorIds: (item.sectorIds ?? []) as any,
          pilotCenterIds: (item.pilotCenterIds ?? []) as any,
        });

        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Erreur chargement';
        this.loading = false;
      },
    });
  }

  save(): void {
    this.error = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error = 'Veuillez corriger les champs obligatoires.';
      return;
    }

    this.saving = true;

    const dto = {
      id: this.id,
      name: (this.form.value.name ?? '').trim(),
      abbreviation: this.cleanOptional(this.form.value.abbreviation),
      archived: !!this.form.value.archived,
      sectorIds: this.form.value.sectorIds ?? [],
      pilotCenterIds: this.form.value.pilotCenterIds ?? [],
    };

    this.api.update(this.id, dto as any).subscribe({
      next: () => {
        this.saving = false;
        this.toast.success('Organisme mis à jour.');
        this.router.navigateByUrl('/organisms');
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Erreur sauvegarde';
        this.saving = false;
      },
    });
  }

  toggleArchive(): void {
    if (this.loading || this.saving) return;

    const newValue = !this.form.value.archived;
    this.form.patchValue({ archived: !!newValue });

    this.api.archive(this.id, !!newValue).subscribe({
      next: (updated) => {
        this.item = updated;
        this.form.patchValue({ archived: !!updated.archived });
      },
      error: (err) => {
        this.form.patchValue({ archived: !newValue });
        this.error = err?.error?.message ?? 'Erreur archive';
      },
    });
  }

  async delete(): Promise<void> {
    if (this.loading || this.saving) return;

    const name = this.form.value.name ?? '';
    if (!await this.confirmDialog.confirm(`Supprimer l'organisme "${name}" ?`, { danger: true })) return;

    this.api.delete(this.id).subscribe({
      next: () => { this.toast.success('Organisme supprimé.'); this.router.navigateByUrl('/organisms'); },
      error: (err) => (this.error = err?.error?.message ?? 'Erreur suppression'),
    });
  }

  toggleItem(id: number, key: 'sectorIds' | 'pilotCenterIds'): void {
    const ctrl = this.form.get(key);
    const current: number[] = ctrl?.value ?? [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    ctrl?.setValue(next);
  }

  formatDate(v: any): string {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString('fr-BE');
  }

  private cleanOptional(v: any): string | null {
    const s = (v ?? '').toString().trim();
    return s ? s : null;
  }
}
