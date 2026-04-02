import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

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
import { SubModuleApi, SubModuleDto } from '../../../sub-modules/api/sub-module.api';

interface CenterAccreditationOption {
  id: number;
  label: string;
  endDate: string | null;
}

type RowState = {
  status: 'idle' | 'saving' | 'success' | 'error';
  error?: string | null;
};

@Component({
  selector: 'app-training-accreditation-create',
  standalone: true,
  imports: [...SHARED_IMPORTS, ReactiveFormsModule],
  templateUrl: './training-accreditation-create.html',
  styleUrl: './training-accreditation-create.css',
})
export class TrainingAccreditationCreate implements OnInit {
  private fb     = inject(FormBuilder);
  private api    = inject(TrainingAccreditationApi);
  private caApi  = inject(CenterAccreditationApi);
  private tcApi  = inject(TrainingCenterApi);
  private ltApi  = inject(LicenseTypeApi);
  private thApi  = inject(ThemeApi);
  private trApi  = inject(TrainerApi);
  private smApi  = inject(SubModuleApi);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private toast  = inject(ToastService);

  // ─── Listes de référence ──────────────────────────────────
  private tcById = new Map<number, string>();
  /** Options d'agréments centre filtrées par date de début, une entrée par ligne du batch */
  centerAccreditationOptionsList: CenterAccreditationOption[][] = [[]];
  centerAccreditationLoadingList: boolean[] = [false];
  licenseTypes:  LicenseType[]   = [];
  themes:        Theme[]         = [];
  allSubThemes:  SubTheme[]      = [];
  trainers:      TrainerDto[]    = [];
  allSubModules: SubModuleDto[]  = [];

  // ─── État batch ───────────────────────────────────────────
  loading = false;
  error:   string | null = null;

  rowStates: RowState[] = [{ status: 'idle' }];

  /** Minutes par sous-thème, indexé par item */
  subThemeMinutesList: Record<number, number>[] = [{}];

  /** Empêche la boucle endDate par item */
  private autoPatchFlags: boolean[] = [false];

  /** ID d'agrément centre à pré-sélectionner après chargement (depuis query param) */
  private pendingCaId: number | null = null;

  // ─── Recherche formateur·trice par item ──────────────────
  trainerSearchList:   string[] = [''];

  // ─── Recherche sous-modules par item ─────────────────────
  subModuleSearchList: string[] = [''];

  // ─── Sous-modules valides à la date de début (par item) ───
  validSubModulesList: SubModuleDto[][] = [[]];

  // ─── Filtre formateur·trice par agrément centre ───────────
  trainerFilterByCenterList: boolean[]     = [false];
  trainersByCenterList:      TrainerDto[][] = [[]];

  // ─── Recherche organismes partenaires par item ────────────
  partnerSearchList: string[] = [''];

  filteredPartnersFor(i: number): CenterAccreditationOption[] {
    const q = (this.partnerSearchList[i] ?? '').toLowerCase().trim();
    if (!q) return this.centerAccreditationOptionsList[i] ?? [];
    return (this.centerAccreditationOptionsList[i] ?? []).filter(ca =>
      ca.label.toLowerCase().includes(q)
    );
  }

  filteredSubModulesFor(i: number): SubModuleDto[] {
    const q = (this.subModuleSearchList[i] ?? '').toLowerCase().trim();
    const startDate = this.items.at(i)?.get('startDate')?.value;
    const pool = startDate ? (this.validSubModulesList[i] ?? []) : this.allSubModules.filter(sm => !sm.archived);
    if (!q) return pool;
    return pool.filter(sm =>
      `${sm.title ?? ''} ${sm.accreditationNumber ?? ''} ${sm.centerAccreditationLabel ?? ''}`.toLowerCase().includes(q)
    );
  }

  private filterSubModulesByDate(i: number, date: string): void {
    if (!date) {
      this.validSubModulesList[i] = [];
      return;
    }
    this.validSubModulesList[i] = this.allSubModules.filter(sm => {
      if (sm.archived) return false;
      if (sm.startDate && sm.startDate > date) return false;
      if (sm.endDate   && sm.endDate   < date) return false;
      return true;
    });

    // Retirer les sous-modules sélectionnés qui ne sont plus valides
    const group = this.items.at(i) as FormGroup;
    const ctrl = group.get('subModuleIds');
    const selectedIds: number[] = ctrl?.value ?? [];
    const validIds = this.validSubModulesList[i].map(sm => sm.id!);
    const filtered = selectedIds.filter(id => validIds.includes(id));
    if (filtered.length !== selectedIds.length) {
      ctrl?.setValue(filtered);
      ctrl?.markAsTouched();
    }
  }

  filteredTrainersFor(i: number): TrainerDto[] {
    const source = this.trainerFilterByCenterList[i]
      ? (this.trainersByCenterList[i] ?? [])
      : this.trainers;
    const q = (this.trainerSearchList[i] ?? '').toLowerCase().trim();
    if (!q) return source;
    return source.filter(tr =>
      `${tr.firstName} ${tr.lastName} ${tr.email ?? ''}`.toLowerCase().includes(q)
    );
  }

  toggleTrainerFilter(i: number): void {
    this.trainerFilterByCenterList[i] = !this.trainerFilterByCenterList[i];
    if (this.trainerFilterByCenterList[i]) {
      const caId = this.items.at(i).get('centerAccreditationId')?.value as number | null;
      this.loadTrainersByCenterAccreditation(i, caId);
    }
  }

  private loadTrainersByCenterAccreditation(i: number, caId: number | null): void {
    if (!caId) {
      this.trainersByCenterList[i] = [];
      return;
    }
    this.trApi.byCenterAccreditation(caId).subscribe({
      next:  (trainers) => { this.trainersByCenterList[i] = trainers.filter(t => !t.archived); },
      error: ()         => { this.trainersByCenterList[i] = []; },
    });
  }

  // ─── Modal ajout formateur·trice rapide ───────────────────
  showTrainerModal     = false;
  trainerModalError:   string | null = null;
  trainerModalLoading  = false;
  activeItemForModal   = 0;
  newTrainer = { firstName: '', lastName: '', email: '', phone: '', phytolicenceNumber: '', comment: '' };

  readonly statusOptions: { value: AccreditationRequestStatus; label: string }[] = [
    { value: 'RECEIVED', label: 'Reçu' },
    { value: 'ACCEPTED', label: 'Accepté' },
    { value: 'REFUSED',  label: 'Refusé' },
    { value: 'PENDING',  label: 'En attente' },
  ];

  form = this.fb.group({
    items: this.fb.array([this.newItemGroup()]),
  });

  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  get successCount(): number {
    return this.rowStates.filter((s) => s.status === 'success').length;
  }

  get pendingCount(): number {
    return this.rowStates.filter((s) => s.status !== 'success').length;
  }

  private newItemGroup(): FormGroup {
    return this.fb.group({
      type:                    ['COMPLETE' as 'COMPLETE' | 'SUB_MODULES'],
      centerAccreditationId:   [null as number | null, Validators.required],
      partnerAccreditationIds: [[] as number[]],
      subModuleIds:            [[] as number[]],
      title:                   ['', [Validators.required]],
      durationHours:           [null as number | null],
      price:                   [null as number | null],
      trainingPoints:          [1 as number | null],
      receivedDate:            [this.todayIso()],
      requestStatus:           ['RECEIVED' as AccreditationRequestStatus | ''],
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
  }

  // ─── Lifecycle ────────────────────────────────────────────

  ngOnInit(): void {
    this.bindItemListeners(0);

    forkJoin({
      centers:      this.tcApi.findAll(),
      licenseTypes: this.ltApi.findAll(),
      themes:       this.thApi.findAll(),
      trainers:     this.trApi.findAll(),
      subModules:   this.smApi.findAll(),
    }).subscribe({
      next: ({ centers, licenseTypes, themes, trainers, subModules }) => {
        (centers ?? []).forEach((tc: TrainingCenterDto) => {
          if (tc.id) this.tcById.set(tc.id, tc.name);
        });

        this.licenseTypes = (licenseTypes ?? []).filter(lt => !lt.archived);

        this.themes = (themes ?? []).filter(t => !t.archived);
        this.allSubThemes = this.themes.flatMap(t =>
          (t.subThemes ?? [])
            .filter(st => !st.archived)
            .map(st => ({ ...st, themeId: t.id! }))
        );

        this.trainers     = (trainers ?? []).filter(t => !t.archived);
        this.allSubModules = (subModules ?? []).filter(sm => !sm.archived);

        // Pré-sélectionner un agrément centre depuis query param
        const caId = this.route.snapshot.queryParamMap.get('centerAccreditationId');
        if (caId) {
          this.pendingCaId = parseInt(caId, 10);
        }

        // Dupliquer un agrément existant
        const cloneId = this.route.snapshot.queryParamMap.get('cloneId');
        if (cloneId) {
          this.api.get(parseInt(cloneId, 10)).subscribe({
            next: (src) => {
              const cloneType = src.type ?? 'COMPLETE';
              this.items.at(0).patchValue({
                type:                    cloneType,
                centerAccreditationId:   src.centerAccreditationId   ?? null,
                partnerAccreditationIds: src.partnerAccreditationIds ?? [],
                subModuleIds:            src.subModuleIds            ?? [],
                title:                   src.title                   ?? '',
                durationHours:           src.durationHours           ?? null,
                price:                   src.price                   ?? null,
                trainingPoints:          src.trainingPoints          ?? null,
                receivedDate:            src.receivedDate            ?? '',
                requestStatus:           src.requestStatus           ?? '',
                accreditationNumber:     '',
                startDate:               src.startDate               ?? '',
                endDate:                 src.endDate                 ?? '',
                trainingType:            src.initial ? 'initial' : src.continuous ? 'continuous' : '',
                subsidized:              src.subsidized              ?? false,
                comment:                 src.comment                 ?? '',
                publicCible:             src.publicCible             ?? '',
                licenseTypeIds:          src.licenseTypeIds          ?? [],
                themeIds:                src.themeIds                ?? [],
                subThemeIds:             src.subThemeIds             ?? [],
                trainerIds:              src.trainerIds              ?? [],
              });
              if (cloneType === 'SUB_MODULES') {
                // Ajuster les validateurs (centerAccreditationId non requis)
                this.setType(0, 'SUB_MODULES');
              } else if (src.startDate) {
                // Charger les agréments centre pour la date de début clonée
                this.loadCenterAccreditations(0, src.startDate);
              }
            },
          });
        }
      },
      error: (err) => {
        this.error = err?.error?.message || 'Impossible de charger les données de référence.';
      },
    });
  }

  // ─── Chargement agréments centre par date de début ────────

  private loadCenterAccreditations(i: number, date: string): void {
    if (!date) {
      this.centerAccreditationOptionsList[i] = [];
      return;
    }
    this.centerAccreditationLoadingList[i] = true;
    this.caApi.findActiveAt(date).subscribe({
      next: (accreditations) => {
        const newOptions = (accreditations ?? [])
          .map((a: CenterAccreditationDto) => {
            const tcName = a.trainingCenterId ? (this.tcById.get(a.trainingCenterId) ?? '') : '';
            const num    = a.accreditationNumber ?? `#${a.id}`;
            return { id: a.id!, label: tcName || num, endDate: a.endDate ?? null };
          })
          .sort((a, b) => a.label.localeCompare(b.label));

        this.centerAccreditationOptionsList[i] = newOptions;
        this.centerAccreditationLoadingList[i] = false;

        // Pré-sélectionner depuis query param si disponible
        if (i === 0 && this.pendingCaId && newOptions.some(o => o.id === this.pendingCaId)) {
          this.items.at(0).get('centerAccreditationId')?.setValue(this.pendingCaId);
          this.pendingCaId = null;
        }

        // Si l'agrément centre sélectionné n'est plus valide à cette date, on efface la sélection
        const group = this.items.at(i) as FormGroup;
        const selectedId = group.get('centerAccreditationId')?.value as number | null;
        if (selectedId && !newOptions.some(o => o.id === selectedId)) {
          group.get('centerAccreditationId')?.setValue(null);
        }

        // Même chose pour les organismes partenaires
        const partnerIds: number[] = group.get('partnerAccreditationIds')?.value ?? [];
        const validIds = newOptions.map(o => o.id);
        const filteredPartnerIds = partnerIds.filter(id => validIds.includes(id));
        if (filteredPartnerIds.length !== partnerIds.length) {
          group.get('partnerAccreditationIds')?.setValue(filteredPartnerIds);
        }
      },
      error: () => {
        this.centerAccreditationOptionsList[i] = [];
        this.centerAccreditationLoadingList[i] = false;
      },
    });
  }

  // ─── Ajout / Suppression d'agréments ─────────────────────

  addItem(): void {
    this.items.push(this.newItemGroup());
    this.rowStates.push({ status: 'idle' });
    this.subThemeMinutesList.push({});
    this.autoPatchFlags.push(false);
    this.trainerSearchList.push('');
    this.partnerSearchList.push('');
    this.subModuleSearchList.push('');
    this.validSubModulesList.push([]);
    this.centerAccreditationOptionsList.push([]);
    this.centerAccreditationLoadingList.push(false);
    this.trainerFilterByCenterList.push(false);
    this.trainersByCenterList.push([]);
    const i = this.items.length - 1;
    this.bindItemListeners(i);
  }

  removeItem(index: number): void {
    if (this.items.length <= 1) return;
    this.items.removeAt(index);
    this.rowStates.splice(index, 1);
    this.subThemeMinutesList.splice(index, 1);
    this.autoPatchFlags.splice(index, 1);
    this.trainerSearchList.splice(index, 1);
    this.partnerSearchList.splice(index, 1);
    this.subModuleSearchList.splice(index, 1);
    this.validSubModulesList.splice(index, 1);
    this.centerAccreditationOptionsList.splice(index, 1);
    this.centerAccreditationLoadingList.splice(index, 1);
    this.trainerFilterByCenterList.splice(index, 1);
    this.trainersByCenterList.splice(index, 1);
  }

  // ─── Listeners par item ───────────────────────────────────

  private bindItemListeners(i: number): void {
    const group        = this.items.at(i) as FormGroup;
    const startCtrl    = group.get('startDate');
    const endCtrl      = group.get('endDate');
    const receivedCtrl = group.get('receivedDate');
    const numCtrl      = group.get('accreditationNumber');
    const caCtrl       = group.get('centerAccreditationId');

    if (caCtrl) {
      caCtrl.valueChanges.subscribe((caId: number | null) => {
        if (this.trainerFilterByCenterList[i]) {
          this.loadTrainersByCenterAccreditation(i, caId);
        }
      });
    }

    if (startCtrl) {
      startCtrl.valueChanges.subscribe((iso: any) => {
        const isoStr = iso ? String(iso) : '';

        // 1. Charger les agréments centre actifs à cette date
        this.loadCenterAccreditations(i, isoStr);

        // 1b. Filtrer les sous-modules valides à cette date (type SUB_MODULES)
        this.filterSubModulesByDate(i, isoStr);

        // 2. Auto-calcul de la date de fin (3 ans - 1 jour)
        if (endCtrl && !this.autoPatchFlags[i] && isoStr) {
          const computed = this.addThreeYearsMinusOneDay(isoStr);
          if (computed) {
            this.autoPatchFlags[i] = true;
            endCtrl.setValue(computed, { emitEvent: false });
            this.autoPatchFlags[i] = false;
          }
        }
      });
    }

    if (receivedCtrl && numCtrl) {
      receivedCtrl.valueChanges.subscribe((iso: any) => {
        const prefix = this.receivedDateToPrefix(String(iso ?? ''));
        if (!prefix) return;
        const current: string = numCtrl.value ?? '';
        if (!current) {
          numCtrl.setValue(prefix, { emitEvent: false });
        } else if (/^\d{6}/.test(current)) {
          numCtrl.setValue(prefix + current.slice(6), { emitEvent: false });
        }
      });

      // Appliquer le préfixe dès l'initialisation
      const initialPrefix = this.receivedDateToPrefix(String(receivedCtrl.value ?? ''));
      if (initialPrefix && !numCtrl.value) {
        numCtrl.setValue(initialPrefix, { emitEvent: false });
      }
    }
  }

  private receivedDateToPrefix(iso: string): string {
    const m = /^(\d{4})-(\d{2})/.exec(iso);
    return m ? m[1] + m[2] : '';
  }

  // ─── Type d'agrément ──────────────────────────────────────

  setType(i: number, type: 'COMPLETE' | 'SUB_MODULES'): void {
    const group = this.items.at(i) as FormGroup;
    group.get('type')?.setValue(type);
    const caCtrl = group.get('centerAccreditationId');
    const smCtrl = group.get('subModuleIds');
    if (type === 'COMPLETE') {
      caCtrl?.setValidators([Validators.required]);
      smCtrl?.clearValidators();
      smCtrl?.setValue([]);
    } else {
      caCtrl?.clearValidators();
      caCtrl?.setValue(null);
      smCtrl?.setValidators([(ctrl) => (ctrl.value?.length ?? 0) >= 2 ? null : { minSubModules: true }]);
    }
    caCtrl?.updateValueAndValidity();
    smCtrl?.updateValueAndValidity();
  }

  // ─── Sous-modules ─────────────────────────────────────────

  selectedSubModuleCentersFor(i: number): string[] {
    const selectedIds: number[] = this.items.at(i).get('subModuleIds')?.value ?? [];
    const names = new Set<string>();
    this.allSubModules
      .filter(sm => selectedIds.includes(sm.id!))
      .forEach(sm => { if (sm.trainingCenterLabel) names.add(sm.trainingCenterLabel); });
    return [...names].sort();
  }

  isSubModuleSelected(i: number, id: number): boolean {
    const val: number[] = this.items.at(i).get('subModuleIds')?.value ?? [];
    return val.includes(id);
  }

  toggleSubModule(i: number, id: number): void {
    const ctrl = this.items.at(i).get('subModuleIds');
    if (!ctrl) return;
    const current: number[] = ctrl.value ?? [];
    ctrl.setValue(current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
    ctrl.markAsTouched();
    this.prefillFromSubModules(i);
  }

  private prefillFromSubModules(i: number): void {
    const selectedIds: number[] = this.items.at(i).get('subModuleIds')?.value ?? [];
    const selected = this.allSubModules.filter(sm => selectedIds.includes(sm.id!));
    if (selected.length === 0) return;

    const totalDuration = selected.reduce((s, sm) => s + (sm.durationHours ?? 0), 0);
    const totalPrice    = selected.reduce((s, sm) => s + (sm.price ?? 0), 0);
    const totalPoints   = selected.reduce((s, sm) => s + (sm.trainingPoints ?? 0), 0);
    const licenseTypeIds = [...new Set(selected.flatMap(sm => sm.licenseTypeIds ?? []))];
    const themeIds       = [...new Set(selected.flatMap(sm => sm.themeIds ?? []))];
    const subThemeIds    = [...new Set(selected.flatMap(sm => sm.subThemeIds ?? []))];
    const trainerIds     = [...new Set(selected.flatMap(sm => sm.trainerIds ?? []))];

    const group = this.items.at(i) as FormGroup;
    group.patchValue({
      durationHours:  totalDuration || null,
      price:          totalPrice    || null,
      trainingPoints: totalPoints   || null,
      licenseTypeIds,
      themeIds,
      subThemeIds,
      trainerIds,
    }, { emitEvent: false });
  }

  // ─── Sous-thèmes filtrés par item ─────────────────────────

  getSubThemesForTheme(themeId: number): SubTheme[] {
    return this.allSubThemes.filter(st => st.themeId === themeId);
  }

  filteredSubThemesFor(i: number): SubTheme[] {
    const selectedThemeIds: number[] = this.items.at(i).get('themeIds')?.value ?? [];
    if (selectedThemeIds.length === 0) return this.allSubThemes;
    return this.allSubThemes.filter(st => selectedThemeIds.includes(st.themeId));
  }

  // ─── Toggle helpers pour les multi-sélections ─────────────

  toggleId(i: number, field: string, id: number): void {
    const ctrl = this.items.at(i).get(field);
    if (!ctrl) return;
    const current: number[] = ctrl.value ?? [];
    const next = current.includes(id)
      ? current.filter(x => x !== id)
      : [...current, id];
    ctrl.setValue(next);

    if (field === 'themeIds') {
      const subCtrl = this.items.at(i).get('subThemeIds');
      if (subCtrl) {
        const validSubIds = this.filteredSubThemesFor(i).map(st => st.id!);
        const kept = (subCtrl.value as number[]).filter(sid => validSubIds.includes(sid));
        (subCtrl.value as number[])
          .filter(sid => !validSubIds.includes(sid))
          .forEach(sid => delete this.subThemeMinutesList[i][sid]);
        subCtrl.setValue(kept);
      }
      this.recomputeDuration(i);
    }

    if (field === 'subThemeIds' && !next.includes(id)) {
      delete this.subThemeMinutesList[i][id];
      this.recomputeDuration(i);
    }
  }

  isIdSelected(i: number, field: string, id: number): boolean {
    const val: number[] = this.items.at(i).get(field)?.value ?? [];
    return val.includes(id);
  }

  onSubThemeMinutes(i: number, subThemeId: number, event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    this.subThemeMinutesList[i][subThemeId] = isNaN(val) || val < 0 ? 0 : val;
    this.recomputeDuration(i);
  }

  private recomputeDuration(i: number): void {
    const minutes = this.subThemeMinutesList[i];
    const hasAny  = Object.values(minutes).some(m => m > 0);
    if (!hasAny) return;
    const selectedIds: number[] = this.items.at(i).get('subThemeIds')?.value ?? [];
    const total = selectedIds.reduce((sum, id) => sum + (minutes[id] ?? 0), 0);
    this.items.at(i).get('durationHours')!.setValue(
      total > 0 ? Math.round((total / 60) * 100) / 100 : null,
      { emitEvent: false }
    );
  }

  // ─── Modal formateur·trice ────────────────────────────────

  openTrainerModal(i: number): void {
    this.activeItemForModal = i;
    this.newTrainer = { firstName: '', lastName: '', email: '', phone: '', phytolicenceNumber: '', comment: '' };
    this.trainerModalError   = null;
    this.showTrainerModal    = true;
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
    this.trainerModalError   = null;

    const payload: TrainerDto = {
      firstName:          this.newTrainer.firstName.trim(),
      lastName:           this.newTrainer.lastName.trim(),
      email:              this.newTrainer.email.trim()              || null,
      phone:              this.newTrainer.phone.trim()              || null,
      phytolicenceNumber: this.newTrainer.phytolicenceNumber.trim() || null,
      comment:            this.newTrainer.comment.trim()            || null,
    };

    this.trApi.create(payload).subscribe({
      next: (created) => {
        this.trainerModalLoading = false;
        this.trainers = [...this.trainers, created].sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
        );
        const ids: number[] = this.items.at(this.activeItemForModal).get('trainerIds')?.value ?? [];
        this.items.at(this.activeItemForModal).get('trainerIds')!.setValue([...ids, created.id!]);
        this.showTrainerModal = false;
      },
      error: (err) => {
        this.trainerModalLoading = false;
        this.trainerModalError   = err?.error?.message || 'Erreur lors de la création.';
      },
    });
  }

  // ─── Submit ───────────────────────────────────────────────

  submitAll(mode: 'back' | 'stay' = 'back'): void {
    this.error = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error = 'Veuillez corriger les champs obligatoires.';
      return;
    }

    this.rowStates = this.rowStates.map((s) =>
      s.status === 'success' ? s : { status: 'idle' as const }
    );
    this.loading   = true;

    const run = async () => {
      for (let i = 0; i < this.items.length; i++) {
        if (this.rowStates[i]?.status === 'success') continue;
        const g = this.items.at(i);
        this.rowStates[i] = { status: 'saving' };

        const v = g.value;
        const isSub = v.type === 'SUB_MODULES';
        const payload: TrainingAccreditationDto = {
          type:                    v.type || 'COMPLETE',
          centerAccreditationId:   isSub ? undefined : v.centerAccreditationId!,
          partnerAccreditationIds: isSub ? [] : (v.partnerAccreditationIds ?? []),
          subModuleIds:            isSub ? (v.subModuleIds ?? []) : [],
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
        };

        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((resolve) => {
          this.api.create(payload)
            .pipe(finalize(() => resolve()))
            .subscribe({
              next:  () => { this.rowStates[i] = { status: 'success' }; },
              error: (err) => {
                const msg = err?.error?.message || err?.error?.error || 'Création impossible.';
                this.rowStates[i] = { status: 'error', error: msg };
              },
            });
        });
      }
    };

    run()
      .then(() => {
        this.loading = false;
        const hasError = this.rowStates.some((s) => s.status === 'error');
        if (hasError) {
          this.error = "Certains agréments n'ont pas pu être créés. Corrige les lignes en erreur.";
          return;
        }
        if (mode === 'back') {
          this.toast.success('Agrément(s) formation créé(s).');
          this.router.navigateByUrl('/training-accreditations');
          return;
        }
        this.form.setControl('items', this.fb.array([this.newItemGroup()]));
        this.rowStates                    = [{ status: 'idle' }];
        this.subThemeMinutesList          = [{}];
        this.autoPatchFlags               = [false];
        this.trainerSearchList            = [''];
        this.partnerSearchList            = [''];
        this.subModuleSearchList          = [''];
        this.validSubModulesList          = [[]];
        this.centerAccreditationOptionsList = [[]];
        this.centerAccreditationLoadingList = [false];
        this.trainerFilterByCenterList    = [false];
        this.trainersByCenterList         = [[]];
        this.bindItemListeners(0);
        this.error = null;
      })
      .catch(() => {
        this.loading = false;
        this.error   = 'Une erreur inattendue est survenue.';
      });
  }

  // ─── Format téléphone belge (modal formateur) ────────────

  onModalPhoneBlur(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = this.formatBelgianPhone(input.value);
    input.value = formatted;
    this.newTrainer.phone = formatted;
  }

  private formatBelgianPhone(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    let digits = trimmed.replace(/\s/g, '');
    if (digits.startsWith('0032')) {
      digits = '+32' + digits.slice(4);
    } else if (/^0[^0]/.test(digits)) {
      digits = '+32' + digits.slice(1);
    } else if (!digits.startsWith('+32')) {
      return trimmed.replace(/\s+/g, ' ');
    }
    const local = digits.slice(3);
    if (!local) return '+32';
    const firstLen = local.startsWith('4') ? 3 : 2;
    const groups: string[] = [];
    let rest = local;
    const g1 = rest.slice(0, firstLen); rest = rest.slice(firstLen);
    if (g1) groups.push(g1);
    while (rest.length > 0) { groups.push(rest.slice(0, 2)); rest = rest.slice(2); }
    return '+32 ' + groups.join(' ');
  }

  // ─── Format phytolicence XXX.A.XXXXX (modal formateur) ───

  onPhytolicenceModalInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = this.formatPhytolicence(input.value);
    input.value = formatted;
    this.newTrainer.phytolicenceNumber = formatted;
  }

  private formatPhytolicence(value: string): string {
    const raw = value.replace(/[.\s]/g, '').toUpperCase().slice(0, 9);
    let result = raw.slice(0, 3);
    if (raw.length > 3) result += '.' + raw[3];
    if (raw.length > 4) result += '.' + raw.slice(4, 9);
    return result;
  }

  private trimOrNull(v: unknown): string | null {
    const s = String(v ?? '').trim();
    return s.length ? s : null;
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private addThreeYearsMinusOneDay(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return '';
    const d  = new Date(parseInt(m[1], 10) + 3, parseInt(m[2], 10) - 1, parseInt(m[3], 10) - 1);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }
}
