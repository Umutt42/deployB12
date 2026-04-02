import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';
import { HasRoleDirective } from '../../../../core/auth/has-role.directive';

import { TrainingCenterApi, TrainingCenterDto } from '../../api/training-center.api';
import { getProvinceFromPostalCode } from '../../../../shared/utils/belgian-postal-code';
import { SectorApi, SectorDto } from '../../../sectors/api/sector.api';
import { PilotCenterApi, PilotCenterDto } from '../../../pilot-centers/api/pilot-center.api';
import { ToastService } from '../../../../shared/toast/toast.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

@Component({
  selector: 'app-training-center-detail',
  standalone: true,
  imports: [...SHARED_IMPORTS, ReactiveFormsModule, HasRoleDirective],
  templateUrl: './training-center-detail.html',
  styleUrl: './training-center-detail.css',
})
export class TrainingCenterDetail implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(TrainingCenterApi);
  private sectorApi = inject(SectorApi);
  private pilotCenterApi = inject(PilotCenterApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);

  id!: number;

  sectors: SectorDto[] = [];
  pilotCenters: PilotCenterDto[] = [];

  loading = false;
  error: string | null = null;
  success: string | null = null;

  currentArchived = false;

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(180)]],
    companyNumber: ['', [Validators.required, Validators.maxLength(30)]],

    // ✅ A1 HQ
    hqStreet: ['', [Validators.maxLength(180)]],
    hqNumber: ['', [Validators.maxLength(30)]],
    hqPostalCode: ['', [Validators.maxLength(20)]],
    hqCity: ['', [Validators.maxLength(120)]],
    hqProvince: ['', [Validators.maxLength(120)]],

    sectorIds: [[] as number[]],
    pilotCenterIds: [[] as number[]],
  });

  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('id');
    this.id = Number(rawId);
    if (!this.id || Number.isNaN(this.id)) {
      this.router.navigateByUrl('/training-centers');
      return;
    }

    this.loading = true;
    this.error = null;

    forkJoin({
      sectors:        this.sectorApi.findAll(),
      pilotCenters:   this.pilotCenterApi.findAll(),
      trainingCenter: this.api.get(this.id),
    }).subscribe({
      next: ({ sectors, pilotCenters, trainingCenter }) => {
        this.sectors      = sectors      ?? [];
        this.pilotCenters = pilotCenters ?? [];
        this.currentArchived = !!trainingCenter.archived;

        this.form.patchValue({
          name:          trainingCenter.name          ?? '',
          companyNumber: trainingCenter.companyNumber ?? '',
          hqStreet:      trainingCenter.hqStreet      ?? '',
          hqNumber:      trainingCenter.hqNumber      ?? '',
          hqPostalCode:  trainingCenter.hqPostalCode  ?? '',
          hqCity:        trainingCenter.hqCity        ?? '',
          hqProvince:    trainingCenter.hqProvince    ?? '',
          sectorIds:     Array.isArray(trainingCenter.sectorIds)     ? trainingCenter.sectorIds     : [],
          pilotCenterIds: Array.isArray(trainingCenter.pilotCenterIds) ? trainingCenter.pilotCenterIds : [],
        });

        this.syncNativeMultiSelects();
      },
      error: (err) => {
        this.error = err?.error?.message || err?.error?.error || 'Impossible de charger le centre de formation.';
      },
      complete: () => (this.loading = false),
    });
  }

  save(): void {
    this.error = null;
    this.success = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error = 'Veuillez corriger les champs obligatoires.';
      return;
    }

    this.loading = true;

    const v = this.form.value;

    const payload = {
      name: (v.name ?? '').trim(),
      companyNumber: (v.companyNumber ?? '').trim(),

      // ✅ A1 HQ -> trim + null si vide
      hqStreet: this.trimOrNull(v.hqStreet),
      hqNumber: this.trimOrNull(v.hqNumber),
      hqPostalCode: this.trimOrNull(v.hqPostalCode),
      hqCity: this.trimOrNull(v.hqCity),
      hqProvince: this.trimOrNull(v.hqProvince),

      sectorIds: v.sectorIds ?? [],
      pilotCenterIds: v.pilotCenterIds ?? [],
      archived: this.currentArchived,
    };

    this.api.update(this.id, payload as any).subscribe({
      next: (updated) => {
        this.currentArchived = !!updated.archived;
        this.success = 'Modifications enregistrées.';
        this.syncNativeMultiSelects();
      },
      error: (err) => {
        this.error = err?.error?.message || err?.error?.error || 'Erreur lors de la sauvegarde.';
      },
      complete: () => (this.loading = false),
    });
  }

  toggleArchive(): void {
    this.error = null;
    this.success = null;

    const nextArchived = !this.currentArchived;

    this.loading = true;
    this.api.archive(this.id, nextArchived).subscribe({
      next: (updated) => {
        this.currentArchived = !!updated.archived;
        this.success = this.currentArchived ? 'Centre archivé.' : 'Centre désarchivé.';
      },
      error: (err) => {
        this.error = err?.error?.message || err?.error?.error || 'Erreur lors du changement de statut.';
      },
      complete: () => (this.loading = false),
    });
  }

  async delete(): Promise<void> {
    this.error = null;
    this.success = null;

    const ok = await this.confirmDialog.confirm('Supprimer ce centre de formation ?', { danger: true });
    if (!ok) return;

    this.loading = true;
    this.api.delete(this.id).subscribe({
      next: () => { this.toast.success('Centre de formation supprimé.'); this.router.navigateByUrl('/training-centers'); },
      error: (err) => {
        this.error = err?.error?.message || err?.error?.error || 'Erreur lors de la suppression.';
        this.loading = false;
      },
    });
  }

  onMultiChange(event: Event, key: 'sectorIds' | 'pilotCenterIds') {
    const select = event.target as HTMLSelectElement;
    const values = Array.from(select.selectedOptions).map((o) => Number(o.value));
    this.form.patchValue({ [key]: values } as any);
  }

  isSectorSelected(id?: number): boolean {
    if (typeof id !== 'number') return false;
    const arr = this.form.value.sectorIds ?? [];
    return arr.includes(id);
  }

  isPilotCenterSelected(id?: number): boolean {
    if (typeof id !== 'number') return false;
    const arr = this.form.value.pilotCenterIds ?? [];
    return arr.includes(id);
  }

  // ─── Auto-fill province depuis code postal ───────────────

  onPostalCodeInput(): void {
    const cp       = this.form.get('hqPostalCode')?.value ?? '';
    const province = getProvinceFromPostalCode(cp);
    if (province) {
      this.form.get('hqProvince')?.setValue(province, { emitEvent: false });
    }
  }

  private trimOrNull(v: unknown): string | null {
    const s = String(v ?? '').trim();
    return s.length ? s : null;
  }

  private syncNativeMultiSelects() {
    const sectorSelect = document.querySelector('select[data-role="sectors"]') as HTMLSelectElement | null;
    if (sectorSelect) {
      const selected = new Set(this.form.value.sectorIds ?? []);
      Array.from(sectorSelect.options).forEach((opt) => (opt.selected = selected.has(Number(opt.value))));
    }

    const pcSelect = document.querySelector('select[data-role="pilotCenters"]') as HTMLSelectElement | null;
    if (pcSelect) {
      const selected = new Set(this.form.value.pilotCenterIds ?? []);
      Array.from(pcSelect.options).forEach((opt) => (opt.selected = selected.has(Number(opt.value))));
    }
  }
}
