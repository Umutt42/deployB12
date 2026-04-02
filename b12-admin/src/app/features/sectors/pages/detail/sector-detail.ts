import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { SectorApi, SectorDto } from '../../api/sector.api';
import { OrganismApi, OrganismDto } from '../../../organisms/api/organism.api';
import { PilotCenterApi, PilotCenterDto } from '../../../pilot-centers/api/pilot-center.api';
import { ToastService } from '../../../../shared/toast/toast.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

@Component({
  standalone: true,
  selector: 'app-sector-detail',
  imports: [...SHARED_IMPORTS, ReactiveFormsModule],
  templateUrl: './sector-detail.html',
  styleUrls: ['./sector-detail.css'],
})
export class SectorDetail {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  private api = inject(SectorApi);
  private organismApi = inject(OrganismApi);
  private pilotCenterApi = inject(PilotCenterApi);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);

  id!: number;
  loading = true;
  saving = false;
  error: string | null = null;

  item!: SectorDto;

  organisms: OrganismDto[] = [];
  pilotCenters: PilotCenterDto[] = [];

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]],
    archived: [false],
    organismIds: [[] as number[]],
    pilotCenterIds: [[] as number[]],
  });

  ngOnInit() {
    this.id = Number(this.route.snapshot.paramMap.get('id'));

    forkJoin({
      organisms:    this.organismApi.findAll(),
      pilotCenters: this.pilotCenterApi.findAll(),
      sector:       this.api.get(this.id),
    }).subscribe({
      next: ({ organisms, pilotCenters, sector }) => {
        this.organisms    = organisms    ?? [];
        this.pilotCenters = pilotCenters ?? [];
        this.item = sector;

        this.form.patchValue({
          name:           sector.name,
          description:    sector.description ?? '',
          archived:       !!sector.archived,
          organismIds:    (sector.organismIds    ?? []) as any,
          pilotCenterIds: (sector.pilotCenterIds ?? []) as any,
        });

        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Erreur chargement';
        this.loading = false;
      },
    });
  }

  save() {
    this.error = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error = 'Veuillez corriger les champs obligatoires.';
      return;
    }

    this.saving = true;

    const dto = {
      id: this.id,
      name: this.form.value.name!,
      description: this.form.value.description || null,
      archived: !!this.form.value.archived,
      organismIds: this.form.value.organismIds ?? [],
      pilotCenterIds: this.form.value.pilotCenterIds ?? [],
    };

    this.api.update(this.id, dto as any).subscribe({
      next: () => {
        this.saving = false;
        this.toast.success('Secteur mis à jour.');
        this.router.navigateByUrl('/sectors');
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Erreur sauvegarde';
        this.saving = false;
      },
    });
  }

  toggleArchive() {
    const newValue = !this.form.value.archived;

    this.api.archive(this.id, !!newValue).subscribe({
      next: (updated) => {
        this.item = updated;
        this.form.patchValue({ archived: !!updated.archived });
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Erreur archive';
      },
    });
  }

  async delete(): Promise<void> {
    if (!await this.confirmDialog.confirm(`Supprimer le secteur "${this.form.value.name}" ?`, { danger: true })) return;

    this.api.delete(this.id).subscribe({
      next: () => { this.toast.success('Secteur supprimé.'); this.router.navigateByUrl('/sectors'); },
      error: (err) => {
        this.error = err?.error?.message ?? 'Erreur suppression';
      },
    });
  }

  toggleItem(id: number, key: 'organismIds' | 'pilotCenterIds'): void {
    const ctrl = this.form.get(key);
    const current: number[] = ctrl?.value ?? [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    ctrl?.setValue(next);
  }
}
