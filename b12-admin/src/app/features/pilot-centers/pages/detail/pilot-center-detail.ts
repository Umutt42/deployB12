import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { PilotCenterApi, PilotCenterDto } from '../../api/pilot-center.api';
import { SectorApi, SectorDto } from '../../../sectors/api/sector.api';
import { OrganismApi, OrganismDto } from '../../../organisms/api/organism.api';
import { ToastService } from '../../../../shared/toast/toast.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

@Component({
  standalone: true,
  selector: 'app-pilot-center-detail',
  imports: [...SHARED_IMPORTS, ReactiveFormsModule],
  templateUrl: './pilot-center-detail.html',
  styleUrls: ['./pilot-center-detail.css'],
})
export class PilotCenterDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  private api = inject(PilotCenterApi);
  private sectorApi = inject(SectorApi);
  private organismApi = inject(OrganismApi);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);

  id!: number;

  loading = true;
  saving = false;
  error: string | null = null;

  item!: PilotCenterDto;

  sectors: SectorDto[] = [];
  organisms: OrganismDto[] = [];

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(180)]],
    cpGroup: ['', [Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(500)]],
    archived: [false],
    sectorIds: [[] as number[]],
    organismIds: [[] as number[]],
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
      organisms: this.organismApi.findAll(),
      item: this.api.get(this.id),
    }).subscribe({
      next: ({ sectors, organisms, item }) => {
        this.sectors = sectors ?? [];
        this.organisms = organisms ?? [];
        this.item = item;

        this.form.patchValue({
          name: item.name ?? '',
          cpGroup: item.cpGroup ?? '',
          description: item.description ?? '',
          archived: !!item.archived,
          sectorIds: (item.sectorIds ?? []) as any,
          organismIds: (item.organismIds ?? []) as any,
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

    const dto: Partial<PilotCenterDto> = {
      id: this.id,
      name: (this.form.value.name ?? '').trim(),
      cpGroup: this.cleanOptional(this.form.value.cpGroup),
      description: this.cleanOptional(this.form.value.description),
      archived: !!this.form.value.archived,
      sectorIds: this.form.value.sectorIds ?? [],
      organismIds: this.form.value.organismIds ?? [],
    };

    this.api.update(this.id, dto as any).subscribe({
      next: (updated) => {
        this.item = updated;
        this.form.patchValue({
          archived: !!updated.archived,
          sectorIds: (updated.sectorIds ?? []) as any,
          organismIds: (updated.organismIds ?? []) as any,
        });
        this.saving = false;
        this.toast.success('Centre pilote mis à jour.');
        this.router.navigateByUrl('/pilot-centers')
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

    // Optimistic UI
    this.form.patchValue({ archived: !!newValue });

    this.api.archive(this.id, !!newValue).subscribe({
      next: (updated) => {
        this.item = updated;
        this.form.patchValue({ archived: !!updated.archived });
      },
      error: (err) => {
        // rollback
        this.form.patchValue({ archived: !newValue });
        this.error = err?.error?.message ?? 'Erreur archive';
      },
    });
  }

  async delete(): Promise<void> {
    if (this.loading || this.saving) return;

    const name = this.form.value.name ?? '';
    if (!await this.confirmDialog.confirm(`Supprimer le centre pilote "${name}" ?`, { danger: true })) return;

    this.api.delete(this.id).subscribe({
      next: () => { this.toast.success('Centre pilote supprimé.'); this.router.navigateByUrl('/pilot-centers'); },
      error: (err) => (this.error = err?.error?.message ?? 'Erreur suppression'),
    });
  }

  toggleItem(id: number, key: 'sectorIds' | 'organismIds'): void {
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
