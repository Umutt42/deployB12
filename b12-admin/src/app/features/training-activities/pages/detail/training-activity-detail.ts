import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';
import { HasRoleDirective } from '../../../../core/auth/has-role.directive';

import { TrainingActivityApi, TrainingActivityDto } from '../../api/training-activity.api';
import { getProvinceFromPostalCode } from '../../../../shared/utils/belgian-postal-code';
import { ToastService } from '../../../../shared/toast/toast.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

interface EligibleOption {
  id: number;
  label: string;
}

@Component({
  selector: 'app-training-activity-detail',
  standalone: true,
  imports: [...SHARED_IMPORTS, ReactiveFormsModule, HasRoleDirective],
  templateUrl: './training-activity-detail.html',
  styleUrl: './training-activity-detail.css',
})
export class TrainingActivityDetail implements OnInit {
  private fb     = inject(FormBuilder);
  private api    = inject(TrainingActivityApi);
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private toast  = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);

  id!: number;
  currentArchived = false;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;

  // ─── Options TA éligibles ─────────────────────────────────
  eligibleOptions: EligibleOption[] = [];
  eligibleLoading = false;

  // ─── État ─────────────────────────────────────────────────
  loading  = false;
  error:   string | null = null;
  success: string | null = null;

  // ─── Dates affichage JJ/MM/AAAA ───────────────────────────
  startDateDisplay = '';
  endDateDisplay   = '';

  // ─── Formulaire ───────────────────────────────────────────
  form = this.fb.group({
    trainingAccreditationId: [null as number | null, Validators.required],
    startDate:               ['', Validators.required],
    endDate:                 [''],
    numberOfParticipants:    [null as number | null],
    online:                  [false],
    memberPrice:             [0],
    nonMemberPrice:          [0],
    phytodama:               [false],
    street:                  [''],
    number:                  [''],
    postalCode:              [''],
    ville:                   [''],
    province:                [''],
  });

  // ─── Lifecycle ────────────────────────────────────────────

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));

    this.api.get(this.id).subscribe({
      next: (activity) => this.patchForm(activity),
      error: (err) => {
        this.error = err?.error?.message || 'Impossible de charger l\'activité.';
      },
    });

    // Écouter les changements de startDate pour recharger les TA éligibles
    this.form.get('startDate')?.valueChanges.subscribe((iso: any) => {
      if (!iso) { this.eligibleOptions = []; return; }
      this.loadEligible(String(iso));
    });
  }

  private patchForm(a: TrainingActivityDto): void {
    this.currentArchived = a.archived ?? false;
    this.createdAt  = a.createdAt;
    this.updatedAt  = a.updatedAt;
    this.createdBy  = a.createdBy;
    this.updatedBy  = a.updatedBy;

    // Charger les éligibles pour la startDate actuelle avant de patcher
    if (a.startDate) {
      this.loadEligible(a.startDate, a.trainingAccreditationId);
    }

    this.form.patchValue({
      trainingAccreditationId: a.trainingAccreditationId ?? null,
      startDate:               a.startDate ?? '',
      endDate:                 a.endDate ?? '',
      numberOfParticipants:    a.numberOfParticipants ?? null,
      online:                  a.online ?? false,
      memberPrice:             a.memberPrice ?? 0,
      nonMemberPrice:          a.nonMemberPrice ?? 0,
      phytodama:               a.phytodama ?? false,
      street:                  a.street ?? '',
      number:                  a.number ?? '',
      postalCode:              a.postalCode ?? '',
      ville:                   a.ville ?? '',
      province:                a.province ?? '',
    }, { emitEvent: false });

    this.startDateDisplay = this.isoToDisplay(a.startDate ?? '');
    this.endDateDisplay   = this.isoToDisplay(a.endDate ?? '');
  }

  // ─── Chargement des TA éligibles ──────────────────────────

  private loadEligible(date: string, currentTaId?: number | null): void {
    this.eligibleLoading = true;
    this.api.findEligible(date).subscribe({
      next: (dtos) => {
        const buildLabel = (d: TrainingActivityDto) => {
          const centerPart = d.centerAccreditationLabel ?? '';
          const taPart = d.trainingAccreditationLabel ?? `#${d.trainingAccreditationId}`;
          return centerPart ? `${centerPart} — ${taPart}` : taPart;
        };

        const options = dtos
          .filter(d => d.trainingAccreditationId != null)
          .map(d => ({ id: d.trainingAccreditationId!, label: buildLabel(d) }))
          .sort((a, b) => a.label.localeCompare(b.label));

        // S'assurer que le TA actuel est dans la liste même s'il n'est plus éligible
        if (currentTaId && !options.find(o => o.id === currentTaId)) {
          const existing = dtos.find(d => d.trainingAccreditationId === currentTaId);
          options.unshift({
            id: currentTaId,
            label: existing ? buildLabel(existing) : `#${currentTaId} (non éligible à cette date)`,
          });
        }

        this.eligibleOptions = options;
        this.eligibleLoading = false;
      },
      error: () => {
        this.eligibleOptions = [];
        this.eligibleLoading = false;
      },
    });
  }

  // ─── Dates ────────────────────────────────────────────────

  private isoToDisplay(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  }

  private parseFlexibleDate(display: string): string {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(display.trim());
    if (!m) return '';
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  onDateInput(field: 'startDate' | 'endDate', value: string): void {
    if (field === 'startDate') this.startDateDisplay = value;
    else this.endDateDisplay = value;
    const iso = this.parseFlexibleDate(value);
    this.form.get(field)?.setValue(iso);
  }

  onPickerChange(field: 'startDate' | 'endDate', isoValue: string): void {
    this.form.get(field)?.setValue(isoValue);
    const display = this.isoToDisplay(isoValue);
    if (field === 'startDate') this.startDateDisplay = display;
    else this.endDateDisplay = display;
  }

  onDateBlur(field: 'startDate' | 'endDate'): void {
    const iso = this.form.get(field)?.value ?? '';
    if (iso) {
      const display = this.isoToDisplay(iso);
      if (field === 'startDate') this.startDateDisplay = display;
      else this.endDateDisplay = display;
    }
  }

  // ─── Formatters ───────────────────────────────────────────

  formatDate(iso?: string): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    const datePart = new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
    const timePart = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    return `${datePart} ${timePart}`;
  }

  // ─── Actions ──────────────────────────────────────────────

  submit(): void {
    this.error   = null;
    this.success = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error = 'Veuillez corriger les champs obligatoires.';
      return;
    }

    this.loading = true;
    const v = this.form.value;

    const payload: TrainingActivityDto = {
      trainingAccreditationId: v.trainingAccreditationId!,
      startDate:               this.trimOrNull(v.startDate),
      endDate:                 this.trimOrNull(v.endDate),
      numberOfParticipants:    v.numberOfParticipants ?? null,
      online:                  v.online ?? false,
      memberPrice:             v.memberPrice ?? 0,
      nonMemberPrice:          v.nonMemberPrice ?? 0,
      phytodama:               v.phytodama ?? false,
      street:                  this.trimOrNull(v.street),
      number:                  this.trimOrNull(v.number),
      postalCode:              this.trimOrNull(v.postalCode),
      ville:                   this.trimOrNull(v.ville),
      province:                this.trimOrNull(v.province),
      archived:                this.currentArchived,
    };

    this.api.update(this.id, payload).subscribe({
      next: (updated) => {
        this.loading = false;
        this.success = 'Modifications enregistrées.';
        this.patchForm(updated);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || err?.error?.error || 'Erreur lors de la mise à jour.';
      },
    });
  }

  async toggleArchive(): Promise<void> {
    const next = !this.currentArchived;
    const msg  = next ? 'Archiver cette activité ?' : 'Désarchiver cette activité ?';
    if (!await this.confirmDialog.confirm(msg)) return;

    this.loading = true;
    this.api.archive(this.id, next).subscribe({
      next: (updated) => {
        this.loading = false;
        this.currentArchived = updated.archived ?? next;
        this.success = next ? 'Activité archivée.' : 'Activité désarchivée.';
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Erreur lors de l\'archivage.';
      },
    });
  }

  async delete(): Promise<void> {
    if (!await this.confirmDialog.confirm('Supprimer définitivement cette activité de formation ? Cette action est irréversible.', { danger: true })) return;
    this.loading = true;
    this.api.delete(this.id).subscribe({
      next: () => { this.toast.success('Activité supprimée.'); this.router.navigateByUrl('/training-activities'); },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Erreur lors de la suppression.';
      },
    });
  }

  // ─── Auto-fill province depuis code postal ───────────────

  onPostalCodeInput(): void {
    const cp       = this.form.get('postalCode')?.value ?? '';
    const province = getProvinceFromPostalCode(cp);
    if (province) {
      this.form.get('province')?.setValue(province, { emitEvent: false });
    }
  }

  private trimOrNull(v: unknown): string | null {
    const s = String(v ?? '').trim();
    return s.length ? s : null;
  }
}
