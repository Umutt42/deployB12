import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';
import { HasRoleDirective } from '../../../../core/auth/has-role.directive';

import {
  TrainingAccreditationApi,
  TrainingAccreditationDto,
  AccreditationRequestStatus,
} from '../../api/training-accreditation.api';
import {
  CenterAccreditationApi,
  CenterAccreditationDto,
} from '../../../center-accreditations/api/center-accreditation.api';
import { TrainingCenterApi, TrainingCenterDto } from '../../../training-centers/api/training-center.api';
import { LicenseTypeApi } from '../../../license-types/api/license-type.api';
import { LicenseType } from '../../../license-types/models/license-type.model';
import { ThemeApi } from '../../../themes/api/theme.api';
import { Theme } from '../../../themes/models/theme.model';
import { SubTheme } from '../../../themes/models/sub-theme.model';
import { TrainerApi, TrainerDto } from '../../../trainers/api/trainer.api';
import { ToastService } from '../../../../shared/toast/toast.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';
import { SubModuleApi, SubModuleDto } from '../../../sub-modules/api/sub-module.api';

interface CenterAccreditationOption {
  id: number;
  label: string;
}

@Component({
  selector: 'app-training-accreditation-detail',
  standalone: true,
  imports: [...SHARED_IMPORTS, ReactiveFormsModule, HasRoleDirective],
  templateUrl: './training-accreditation-detail.html',
  styleUrl: './training-accreditation-detail.css',
})
export class TrainingAccreditationDetail implements OnInit {
  private fb     = inject(FormBuilder);
  private api    = inject(TrainingAccreditationApi);
  private caApi  = inject(CenterAccreditationApi);
  private tcApi  = inject(TrainingCenterApi);
  private ltApi  = inject(LicenseTypeApi);
  private thApi  = inject(ThemeApi);
  private trApi  = inject(TrainerApi);
  private smApi  = inject(SubModuleApi);
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
  licenseTypes:  LicenseType[]  = [];
  themes:        Theme[]        = [];
  allSubThemes:  SubTheme[]     = [];
  trainers:      TrainerDto[]   = [];
  allSubModules: SubModuleDto[] = [];

  // ─── Recherche sous-modules ───────────────────────────────
  subModuleSearch = '';

  get filteredSubModules(): SubModuleDto[] {
    const q = this.subModuleSearch.toLowerCase().trim();
    if (!q) return this.allSubModules;
    return this.allSubModules.filter(sm =>
      `${sm.title ?? ''} ${sm.accreditationNumber ?? ''} ${sm.centerAccreditationLabel ?? ''}`.toLowerCase().includes(q)
    );
  }

  // ─── Minutes par sous-thème ───────────────────────────────
  subThemeMinutes: Record<number, number> = {};

  // ─── Type d'agrément ──────────────────────────────────────
  get currentType(): 'COMPLETE' | 'SUB_MODULES' {
    return this.form.get('type')?.value ?? 'COMPLETE';
  }

  setType(type: 'COMPLETE' | 'SUB_MODULES'): void {
    this.form.get('type')?.setValue(type);
    const caCtrl = this.form.get('centerAccreditationId');
    if (type === 'COMPLETE') {
      caCtrl?.setValidators([Validators.required]);
      this.form.get('subModuleIds')?.setValue([]);
    } else {
      caCtrl?.clearValidators();
      caCtrl?.setValue(null);
    }
    caCtrl?.updateValueAndValidity();
  }

  get selectedSubModuleCenters(): string[] {
    const selectedIds: number[] = this.form.get('subModuleIds')?.value ?? [];
    const names = new Set<string>();
    this.allSubModules
      .filter(sm => selectedIds.includes(sm.id!))
      .forEach(sm => { if (sm.trainingCenterLabel) names.add(sm.trainingCenterLabel); });
    return [...names].sort();
  }

  isSubModuleSelected(id: number): boolean {
    const val: number[] = this.form.get('subModuleIds')?.value ?? [];
    return val.includes(id);
  }

  toggleSubModule(id: number): void {
    const ctrl = this.form.get('subModuleIds');
    if (!ctrl) return;
    const current: number[] = ctrl.value ?? [];
    ctrl.setValue(current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
    this.prefillFromSubModules();
  }

  private prefillFromSubModules(): void {
    const selectedIds: number[] = this.form.get('subModuleIds')?.value ?? [];
    const selected = this.allSubModules.filter(sm => selectedIds.includes(sm.id!));
    if (selected.length === 0) return;

    const totalDuration = selected.reduce((s, sm) => s + (sm.durationHours ?? 0), 0);
    const totalPrice    = selected.reduce((s, sm) => s + (sm.price ?? 0), 0);
    const totalPoints   = selected.reduce((s, sm) => s + (sm.trainingPoints ?? 0), 0);
    const licenseTypeIds = [...new Set(selected.flatMap(sm => sm.licenseTypeIds ?? []))];
    const themeIds       = [...new Set(selected.flatMap(sm => sm.themeIds ?? []))];
    const subThemeIds    = [...new Set(selected.flatMap(sm => sm.subThemeIds ?? []))];
    const trainerIds     = [...new Set(selected.flatMap(sm => sm.trainerIds ?? []))];

    this.form.patchValue({
      durationHours:  totalDuration || null,
      price:          totalPrice    || null,
      trainingPoints: totalPoints   || null,
      licenseTypeIds,
      themeIds,
      subThemeIds,
      trainerIds,
    }, { emitEvent: false });
  }

  // ─── Recherche formateur·trice ────────────────────────────
  trainerSearch = '';

  get filteredTrainers(): TrainerDto[] {
    const q = this.trainerSearch.toLowerCase().trim();
    if (!q) return this.trainers;
    return this.trainers.filter(tr =>
      `${tr.firstName} ${tr.lastName} ${tr.email ?? ''}`.toLowerCase().includes(q)
    );
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
    type:                    ['COMPLETE' as 'COMPLETE' | 'SUB_MODULES'],
    centerAccreditationId:   [null as number | null, Validators.required],
    partnerAccreditationIds: [[] as number[]],
    subModuleIds:            [[] as number[]],
    title:                  ['', [Validators.required]],
    durationHours:          [null as number | null],
    price:                  [null as number | null],
    trainingPoints:         [null as number | null],
    receivedDate:           [''],
    requestStatus:          ['' as AccreditationRequestStatus | ''],
    accreditationNumber:    ['', Validators.maxLength(60)],
    startDate:              [''],
    endDate:                [''],
    trainingType:           ['' as '' | 'initial' | 'continuous'],
    subsidized:             [false],
    comment:                [''],
    publicCible:            [''],
    licenseTypeIds:         [[] as number[]],
    themeIds:               [[] as number[]],
    subThemeIds:            [[] as number[]],
    trainerIds:             [[] as number[]],
  });

  // ─── Lifecycle ────────────────────────────────────────────

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));

    forkJoin({
      accreditation:  this.api.get(this.id),
      accreditations: this.caApi.findAll(),
      centers:        this.tcApi.findAll(),
      licenseTypes:   this.ltApi.findAll(),
      themes:         this.thApi.findAll(),
      trainers:       this.trApi.findAll(),
      subModules:     this.smApi.findAll(),
    }).subscribe({
      next: ({ accreditation, accreditations, centers, licenseTypes, themes, trainers, subModules }) => {
        // Construire map TC
        const tcById = new Map<number, string>();
        (centers ?? []).forEach((tc: TrainingCenterDto) => {
          if (tc.id) tcById.set(tc.id, tc.name);
        });

        // Options agréments centre actifs
        this.centerAccreditationOptions = (accreditations ?? [])
          .filter((a: CenterAccreditationDto) => !a.archived && a.requestStatus === 'ACCEPTED')
          .map((a: CenterAccreditationDto) => {
            const tcName = a.trainingCenterId ? (tcById.get(a.trainingCenterId) ?? '') : '';
            const num    = a.accreditationNumber ?? `#${a.id}`;
            return { id: a.id!, label: tcName || num };
          })
          .sort((a, b) => a.label.localeCompare(b.label));

        this.licenseTypes  = (licenseTypes ?? []).filter(lt => !lt.archived);
        this.themes        = (themes ?? []).filter(t => !t.archived);
        this.allSubThemes  = this.themes.flatMap(t =>
          (t.subThemes ?? []).filter(st => !st.archived).map(st => ({ ...st, themeId: t.id! }))
        );
        this.trainers      = (trainers ?? []).filter(t => !t.archived);
        this.allSubModules = (subModules ?? []).filter(sm => !sm.archived);

        // Patcher le formulaire
        this.patchForm(accreditation);
      },
      error: (err) => {
        this.error = err?.error?.message || 'Impossible de charger l\'agrément.';
      },
    });
  }

  private patchForm(a: TrainingAccreditationDto): void {
    this.currentArchived = a.archived ?? false;
    this.createdAt  = a.createdAt;
    this.updatedAt  = a.updatedAt;
    this.createdBy  = a.createdBy;
    this.updatedBy  = a.updatedBy;

    // Ajuster le validator centerAccreditationId selon le type
    const caCtrl = this.form.get('centerAccreditationId');
    if (a.type === 'SUB_MODULES') {
      caCtrl?.clearValidators();
      caCtrl?.updateValueAndValidity();
    } else {
      caCtrl?.setValidators([Validators.required]);
      caCtrl?.updateValueAndValidity();
    }

    this.form.patchValue({
      type:                    a.type ?? 'COMPLETE',
      centerAccreditationId:   a.centerAccreditationId ?? null,
      partnerAccreditationIds: a.partnerAccreditationIds ?? [],
      subModuleIds:            a.subModuleIds ?? [],
      title:                   a.title ?? '',
      durationHours:          a.durationHours ?? null,
      price:                  a.price ?? null,
      trainingPoints:         a.trainingPoints ?? null,
      receivedDate:           a.receivedDate ?? '',
      requestStatus:          a.requestStatus ?? '',
      accreditationNumber:    a.accreditationNumber ?? '',
      startDate:              a.startDate ?? '',
      endDate:                a.endDate ?? '',
      trainingType:           a.initial ? 'initial' : a.continuous ? 'continuous' : '',
      subsidized:             a.subsidized ?? false,
      comment:                a.comment ?? '',
      publicCible:            a.publicCible ?? '',
      licenseTypeIds:         a.licenseTypeIds ?? [],
      themeIds:               a.themeIds ?? [],
      subThemeIds:            a.subThemeIds ?? [],
      trainerIds:             a.trainerIds ?? [],
    });

    this.receivedDateDisplay = this.isoToDisplay(a.receivedDate ?? '');
    this.startDateDisplay    = this.isoToDisplay(a.startDate ?? '');
    this.endDateDisplay      = this.isoToDisplay(a.endDate ?? '');
  }

  // ─── Sous-thèmes filtrés ──────────────────────────────────

  get filteredSubThemes(): SubTheme[] {
    const ids = this.form.get('themeIds')?.value as number[] ?? [];
    if (ids.length === 0) return this.allSubThemes;
    return this.allSubThemes.filter(st => ids.includes(st.themeId));
  }

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
        const validIds = this.filteredSubThemes.map(st => st.id!);
        const removed = (subCtrl.value as number[]).filter(i => !validIds.includes(i));
        removed.forEach(sid => delete this.subThemeMinutes[sid]);
        subCtrl.setValue((subCtrl.value as number[]).filter(i => validIds.includes(i)));
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
    const prefix = m[1] + m[2];
    const numCtrl = this.form.get('accreditationNumber');
    if (!numCtrl) return;
    const current: string = numCtrl.value ?? '';
    if (!current) {
      numCtrl.setValue(prefix, { emitEvent: false });
    } else if (/^\d{6}/.test(current)) {
      numCtrl.setValue(prefix + current.slice(6), { emitEvent: false });
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

    // Validation sous-modules
    if (this.currentType === 'SUB_MODULES') {
      const smIds: number[] = this.form.get('subModuleIds')?.value ?? [];
      if (smIds.length < 2) {
        this.error = 'Un agrément de type Sous-modules doit comporter au moins 2 sous-modules.';
        return;
      }
    }

    this.loading = true;
    const v = this.form.value;
    const isSub = v.type === 'SUB_MODULES';

    const payload: TrainingAccreditationDto = {
      type:                    v.type || 'COMPLETE',
      centerAccreditationId:   isSub ? undefined : v.centerAccreditationId!,
      partnerAccreditationIds: isSub ? [] : (v.partnerAccreditationIds ?? []),
      subModuleIds:            isSub ? (v.subModuleIds ?? []) : [],
      title:                   v.title?.trim() ?? '',
      durationHours:          v.durationHours ?? null,
      price:                  v.price ?? null,
      trainingPoints:         v.trainingPoints ?? null,
      receivedDate:           this.trimOrNull(v.receivedDate),
      requestStatus:          (v.requestStatus || null) as AccreditationRequestStatus | null,
      accreditationNumber:    this.trimOrNull(v.accreditationNumber),
      startDate:              this.trimOrNull(v.startDate),
      endDate:                this.trimOrNull(v.endDate),
      initial:                v.trainingType === 'initial',
      continuous:             v.trainingType === 'continuous',
      subsidized:             v.subsidized ?? false,
      comment:                this.trimOrNull(v.comment),
      publicCible:            this.trimOrNull(v.publicCible),
      licenseTypeIds:         v.licenseTypeIds ?? [],
      themeIds:               v.themeIds ?? [],
      subThemeIds:            v.subThemeIds ?? [],
      trainerIds:             v.trainerIds ?? [],
      archived:               this.currentArchived,
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
    const msg  = next ? 'Archiver cet agrément formation ?' : 'Désarchiver cet agrément formation ?';
    if (!await this.confirmDialog.confirm(msg)) return;

    this.loading = true;
    this.api.archive(this.id, next).subscribe({
      next: (updated) => {
        this.loading = false;
        this.currentArchived = updated.archived ?? next;
        this.success = next ? 'Agrément archivé.' : 'Agrément désarchivé.';
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Erreur lors de l\'archivage.';
      },
    });
  }

  async delete(): Promise<void> {
    if (!await this.confirmDialog.confirm('Supprimer définitivement cet agrément formation ? Cette action est irréversible.', { danger: true })) return;
    this.loading = true;
    this.api.delete(this.id).subscribe({
      next: () => { this.toast.success('Agrément formation supprimé.'); this.router.navigateByUrl('/training-accreditations'); },
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
