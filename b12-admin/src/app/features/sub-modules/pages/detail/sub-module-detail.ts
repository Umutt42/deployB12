import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';
import { HasRoleDirective } from '../../../../core/auth/has-role.directive';

import { SubModuleApi, SubModuleDto, AccreditationRequestStatus } from '../../api/sub-module.api';
import { CenterAccreditationApi, CenterAccreditationDto } from '../../../center-accreditations/api/center-accreditation.api';
import { TrainingCenterApi, TrainingCenterDto } from '../../../training-centers/api/training-center.api';
import { LicenseTypeApi } from '../../../license-types/api/license-type.api';
import { LicenseType } from '../../../license-types/models/license-type.model';
import { ThemeApi } from '../../../themes/api/theme.api';
import { Theme } from '../../../themes/models/theme.model';
import { SubTheme } from '../../../themes/models/sub-theme.model';
import { TrainerApi, TrainerDto } from '../../../trainers/api/trainer.api';
import { ToastService } from '../../../../shared/toast/toast.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

interface CenterAccreditationOption {
  id: number;
  label: string;
}

@Component({
  selector: 'app-sub-module-detail',
  standalone: true,
  imports: [...SHARED_IMPORTS, ReactiveFormsModule, HasRoleDirective],
  templateUrl: './sub-module-detail.html',
  styleUrl: './sub-module-detail.css',
})
export class SubModuleDetail implements OnInit {
  private fb     = inject(FormBuilder);
  private api    = inject(SubModuleApi);
  private caApi  = inject(CenterAccreditationApi);
  private tcApi  = inject(TrainingCenterApi);
  private ltApi  = inject(LicenseTypeApi);
  private thApi  = inject(ThemeApi);
  private trApi  = inject(TrainerApi);
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

  // ─── Listes de référence ──────────────────────────────────
  centerAccreditationOptions: CenterAccreditationOption[] = [];
  licenseTypes:  LicenseType[] = [];
  themes:        Theme[]       = [];
  allSubThemes:  SubTheme[]    = [];
  trainers:      TrainerDto[]  = [];

  // ─── Minutes par sous-thème ───────────────────────────────
  subThemeMinutes: Record<number, number> = {};

  // ─── Recherche formateur·trice ────────────────────────────
  trainerSearch = '';
  partnerSearch = '';

  get filteredTrainers(): TrainerDto[] {
    const q = this.trainerSearch.toLowerCase().trim();
    if (!q) return this.trainers;
    return this.trainers.filter(tr =>
      `${tr.firstName} ${tr.lastName} ${tr.email ?? ''}`.toLowerCase().includes(q)
    );
  }

  get filteredPartners(): CenterAccreditationOption[] {
    const q = this.partnerSearch.toLowerCase().trim();
    if (!q) return this.centerAccreditationOptions;
    return this.centerAccreditationOptions.filter(ca => ca.label.toLowerCase().includes(q));
  }

  // ─── Modal ajout formateur·trice rapide ───────────────────
  showTrainerModal = false;
  trainerModalError: string | null = null;
  trainerModalLoading = false;
  newTrainer = { firstName: '', lastName: '', email: '', phone: '', phytolicenceNumber: '', comment: '' };

  // ─── État ─────────────────────────────────────────────────
  loading  = false;
  error:   string | null = null;
  success: string | null = null;

  // ─── Dates affichage JJ/MM/AAAA ───────────────────────────
  receivedDateDisplay = '';
  startDateDisplay    = '';
  endDateDisplay      = '';

  readonly statusOptions: { value: AccreditationRequestStatus; label: string }[] = [
    { value: 'RECEIVED', label: 'Reçu' },
    { value: 'ACCEPTED', label: 'Accepté' },
    { value: 'REFUSED',  label: 'Refusé' },
    { value: 'PENDING',  label: 'En attente' },
  ];

  // ─── Formulaire ───────────────────────────────────────────
  form = this.fb.group({
    centerAccreditationId:   [null as number | null, Validators.required],
    partnerAccreditationIds: [[] as number[]],
    title:                   ['', [Validators.required]],
    durationHours:           [null as number | null],
    price:                   [null as number | null],
    trainingPoints:          [null as number | null],
    receivedDate:            [''],
    requestStatus:           ['' as AccreditationRequestStatus | ''],
    accreditationNumber:     ['', Validators.maxLength(60)],
    startDate:               [''],
    endDate:                 [''],
    trainingType:            ['' as '' | 'initial' | 'continuous'],
    subsidized:              [false],
    comment:                 [''],
    publicCible:             [''],
    licenseTypeIds:          [[] as number[]],
    themeIds:                [[] as number[]],
    subThemeIds:             [[] as number[]],
    trainerIds:              [[] as number[]],
  });

  // ─── Lifecycle ────────────────────────────────────────────

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));

    forkJoin({
      subModule:    this.api.get(this.id),
      accreditations: this.caApi.findAll(),
      centers:        this.tcApi.findAll(),
      licenseTypes:   this.ltApi.findAll(),
      themes:         this.thApi.findAll(),
      trainers:       this.trApi.findAll(),
    }).subscribe({
      next: ({ subModule, accreditations, centers, licenseTypes, themes, trainers }) => {
        const tcById = new Map<number, string>();
        (centers ?? []).forEach((tc: TrainingCenterDto) => {
          if (tc.id) tcById.set(tc.id, tc.name);
        });

        this.centerAccreditationOptions = (accreditations ?? [])
          .filter((a: CenterAccreditationDto) => !a.archived && a.requestStatus === 'ACCEPTED')
          .map((a: CenterAccreditationDto) => {
            const tcName = a.trainingCenterId ? (tcById.get(a.trainingCenterId) ?? '') : '';
            const num    = a.accreditationNumber ?? `#${a.id}`;
            return { id: a.id!, label: tcName || num };
          })
          .sort((a, b) => a.label.localeCompare(b.label));

        this.licenseTypes = (licenseTypes ?? []).filter(lt => !lt.archived);
        this.themes       = (themes ?? []).filter(t => !t.archived);
        this.allSubThemes = this.themes.flatMap(t =>
          (t.subThemes ?? []).filter(st => !st.archived).map(st => ({ ...st, themeId: t.id! }))
        );
        this.trainers = (trainers ?? []).filter(t => !t.archived);

        this.patchForm(subModule);
      },
      error: (err) => {
        this.error = err?.error?.message || 'Impossible de charger le sous-module.';
      },
    });
  }

  private patchForm(sm: SubModuleDto): void {
    this.currentArchived = sm.archived ?? false;
    this.createdAt  = sm.createdAt;
    this.updatedAt  = sm.updatedAt;
    this.createdBy  = sm.createdBy;
    this.updatedBy  = sm.updatedBy;

    this.form.patchValue({
      centerAccreditationId:   sm.centerAccreditationId ?? null,
      partnerAccreditationIds: sm.partnerAccreditationIds ?? [],
      title:                   sm.title ?? '',
      durationHours:           sm.durationHours ?? null,
      price:                   sm.price ?? null,
      trainingPoints:          sm.trainingPoints ?? null,
      receivedDate:            sm.receivedDate ?? '',
      requestStatus:           sm.requestStatus ?? '',
      accreditationNumber:     sm.accreditationNumber ?? '',
      startDate:               sm.startDate ?? '',
      endDate:                 sm.endDate ?? '',
      trainingType:            sm.initial ? 'initial' : sm.continuous ? 'continuous' : '',
      subsidized:              sm.subsidized ?? false,
      comment:                 sm.comment ?? '',
      publicCible:             sm.publicCible ?? '',
      licenseTypeIds:          sm.licenseTypeIds ?? [],
      themeIds:                sm.themeIds ?? [],
      subThemeIds:             sm.subThemeIds ?? [],
      trainerIds:              sm.trainerIds ?? [],
    });

    this.receivedDateDisplay = this.isoToDisplay(sm.receivedDate ?? '');
    this.startDateDisplay    = this.isoToDisplay(sm.startDate ?? '');
    this.endDateDisplay      = this.isoToDisplay(sm.endDate ?? '');
  }

  // ─── Sous-thèmes ──────────────────────────────────────────

  getSubThemesForTheme(themeId: number): SubTheme[] {
    return this.allSubThemes.filter(st => st.themeId === themeId);
  }

  // ─── Multi-sélections ─────────────────────────────────────

  toggleId(field: string, id: number): void {
    const ctrl = this.form.get(field);
    if (!ctrl) return;
    const current: number[] = ctrl.value ?? [];
    const nowSelected = !current.includes(id);
    ctrl.setValue(current.includes(id) ? current.filter(x => x !== id) : [...current, id]);

    if (field === 'themeIds') {
      const subCtrl = this.form.get('subThemeIds');
      if (subCtrl) {
        const selectedThemeIds: number[] = this.form.get('themeIds')?.value ?? [];
        const validSubIds = this.allSubThemes
          .filter(st => selectedThemeIds.includes(st.themeId))
          .map(st => st.id!);
        const removed = (subCtrl.value as number[]).filter(i => !validSubIds.includes(i));
        removed.forEach(sid => delete this.subThemeMinutes[sid]);
        subCtrl.setValue((subCtrl.value as number[]).filter(i => validSubIds.includes(i)));
      }
      this.recomputeDuration();
    }

    if (field === 'subThemeIds' && !nowSelected) {
      delete this.subThemeMinutes[id];
      this.recomputeDuration();
    }
  }

  isIdSelected(field: string, id: number): boolean {
    const val: number[] = this.form.get(field)?.value ?? [];
    return val.includes(id);
  }

  onSubThemeMinutes(subThemeId: number, event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    this.subThemeMinutes[subThemeId] = isNaN(val) || val < 0 ? 0 : val;
    this.recomputeDuration();
  }

  private recomputeDuration(): void {
    const hasAnyMinutes = Object.values(this.subThemeMinutes).some(m => m > 0);
    if (!hasAnyMinutes) return;
    const selectedIds: number[] = this.form.get('subThemeIds')?.value ?? [];
    const totalMinutes = selectedIds.reduce((sum, id) => sum + (this.subThemeMinutes[id] ?? 0), 0);
    this.form.get('durationHours')!.setValue(
      totalMinutes > 0 ? Math.round((totalMinutes / 60) * 100) / 100 : null,
      { emitEvent: false }
    );
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

  onDateInput(field: 'receivedDate' | 'startDate' | 'endDate', value: string): void {
    if (field === 'receivedDate') this.receivedDateDisplay = value;
    else if (field === 'startDate') this.startDateDisplay = value;
    else this.endDateDisplay = value;
    const iso = this.parseFlexibleDate(value);
    this.form.get(field)?.setValue(iso);
    if (field === 'receivedDate' && iso) this.updateAccreditationNumberPrefix(iso);
  }

  onPickerChange(field: 'receivedDate' | 'startDate' | 'endDate', isoValue: string): void {
    this.form.get(field)?.setValue(isoValue);
    const display = this.isoToDisplay(isoValue);
    if (field === 'receivedDate') {
      this.receivedDateDisplay = display;
      this.updateAccreditationNumberPrefix(isoValue);
    } else if (field === 'startDate') this.startDateDisplay = display;
    else this.endDateDisplay = display;
  }

  onDateBlur(field: 'receivedDate' | 'startDate' | 'endDate'): void {
    const iso = this.form.get(field)?.value ?? '';
    if (iso) {
      const display = this.isoToDisplay(iso);
      if (field === 'receivedDate') this.receivedDateDisplay = display;
      else if (field === 'startDate') this.startDateDisplay = display;
      else this.endDateDisplay = display;
    }
  }

  private updateAccreditationNumberPrefix(iso: string): void {
    const m = /^(\d{4})-(\d{2})/.exec(iso);
    if (!m) return;
    const prefix = `SM-${m[1]}${m[2]}`;
    const numCtrl = this.form.get('accreditationNumber');
    if (!numCtrl) return;
    const current: string = numCtrl.value ?? '';
    if (!current) {
      numCtrl.setValue(prefix, { emitEvent: false });
    } else if (/^SM-\d{6}/.test(current)) {
      numCtrl.setValue(prefix + current.slice(9), { emitEvent: false });
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

  // ─── Modal formateur·trice ────────────────────────────────

  openTrainerModal(): void {
    this.newTrainer = { firstName: '', lastName: '', email: '', phone: '', phytolicenceNumber: '', comment: '' };
    this.trainerModalError = null;
    this.showTrainerModal = true;
  }

  closeTrainerModal(): void {
    this.showTrainerModal = false;
  }

  saveNewTrainer(): void {
    if (!this.newTrainer.firstName.trim() || !this.newTrainer.lastName.trim()) {
      this.trainerModalError = 'Le prénom et le nom sont obligatoires.';
      return;
    }
    this.trainerModalLoading = true;
    this.trainerModalError = null;

    const payload: TrainerDto = {
      firstName:          this.newTrainer.firstName.trim(),
      lastName:           this.newTrainer.lastName.trim(),
      email:              this.newTrainer.email.trim() || null,
      phone:              this.newTrainer.phone.trim() || null,
      phytolicenceNumber: this.newTrainer.phytolicenceNumber.trim() || null,
      comment:            this.newTrainer.comment.trim() || null,
    };

    this.trApi.create(payload).subscribe({
      next: (created) => {
        this.trainerModalLoading = false;
        this.trainers = [...this.trainers, created].sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
        );
        const ids: number[] = this.form.get('trainerIds')?.value ?? [];
        this.form.get('trainerIds')!.setValue([...ids, created.id!]);
        this.showTrainerModal = false;
      },
      error: (err) => {
        this.trainerModalLoading = false;
        this.trainerModalError = err?.error?.message || 'Erreur lors de la création.';
      },
    });
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

    const payload: SubModuleDto = {
      centerAccreditationId:   v.centerAccreditationId!,
      partnerAccreditationIds: v.partnerAccreditationIds ?? [],
      title:                   v.title?.trim() ?? '',
      durationHours:           v.durationHours ?? null,
      price:                   v.price ?? null,
      trainingPoints:          v.trainingPoints ?? null,
      receivedDate:            this.trimOrNull(v.receivedDate),
      requestStatus:           (v.requestStatus || null) as AccreditationRequestStatus | null,
      accreditationNumber:     this.trimOrNull(v.accreditationNumber),
      startDate:               this.trimOrNull(v.startDate),
      endDate:                 this.trimOrNull(v.endDate),
      initial:                 v.trainingType === 'initial',
      continuous:              v.trainingType === 'continuous',
      subsidized:              v.subsidized ?? false,
      comment:                 this.trimOrNull(v.comment),
      publicCible:             this.trimOrNull(v.publicCible),
      licenseTypeIds:          v.licenseTypeIds ?? [],
      themeIds:                v.themeIds ?? [],
      subThemeIds:             v.subThemeIds ?? [],
      trainerIds:              v.trainerIds ?? [],
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
    const msg  = next ? 'Archiver ce sous-module ?' : 'Désarchiver ce sous-module ?';
    if (!await this.confirmDialog.confirm(msg)) return;

    this.loading = true;
    this.api.archive(this.id, next).subscribe({
      next: (updated) => {
        this.loading = false;
        this.currentArchived = updated.archived ?? next;
        this.success = next ? 'Sous-module archivé.' : 'Sous-module désarchivé.';
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Erreur lors de l\'archivage.';
      },
    });
  }

  async delete(): Promise<void> {
    if (!await this.confirmDialog.confirm('Supprimer définitivement ce sous-module ? Cette action est irréversible.', { danger: true })) return;
    this.loading = true;
    this.api.delete(this.id).subscribe({
      next: () => { this.toast.success('Sous-module supprimé.'); this.router.navigateByUrl('/sub-modules'); },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Erreur lors de la suppression.';
      },
    });
  }

  private trimOrNull(v: unknown): string | null {
    const s = String(v ?? '').trim();
    return s.length ? s : null;
  }
}
