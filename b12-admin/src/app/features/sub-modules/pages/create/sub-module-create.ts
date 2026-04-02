import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

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

interface CenterAccreditationOption {
  id: number;
  label: string;
  endDate: string | null;
}

type RowState = { status: 'idle' | 'saving' | 'success' | 'error'; error?: string | null };

@Component({
  selector: 'app-sub-module-create',
  standalone: true,
  imports: [...SHARED_IMPORTS, ReactiveFormsModule],
  templateUrl: './sub-module-create.html',
  styleUrl: './sub-module-create.css',
})
export class SubModuleCreate implements OnInit {
  private fb     = inject(FormBuilder);
  private api    = inject(SubModuleApi);
  private caApi  = inject(CenterAccreditationApi);
  private tcApi  = inject(TrainingCenterApi);
  private ltApi  = inject(LicenseTypeApi);
  private thApi  = inject(ThemeApi);
  private trApi  = inject(TrainerApi);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private toast  = inject(ToastService);

  private tcById = new Map<number, string>();
  centerAccreditationOptionsList: CenterAccreditationOption[][] = [[]];
  centerAccreditationLoadingList: boolean[] = [false];
  licenseTypes: LicenseType[] = [];
  themes:       Theme[]       = [];
  allSubThemes: SubTheme[]    = [];
  trainers:     TrainerDto[]  = [];

  loading = false;
  error:   string | null = null;

  rowStates: RowState[] = [{ status: 'idle' }];
  subThemeMinutesList: Record<number, number>[] = [{}];
  private autoPatchFlags: boolean[] = [false];
  private pendingCaId: number | null = null;

  trainerSearchList: string[] = [''];
  partnerSearchList: string[] = [''];

  showTrainerModal    = false;
  trainerModalError:  string | null = null;
  trainerModalLoading = false;
  activeItemForModal  = 0;
  newTrainer = { firstName: '', lastName: '', email: '', phone: '', phytolicenceNumber: '', comment: '' };

  readonly statusOptions: { value: AccreditationRequestStatus; label: string }[] = [
    { value: 'RECEIVED', label: 'Reçu' },
    { value: 'ACCEPTED', label: 'Accepté' },
    { value: 'REFUSED',  label: 'Refusé' },
    { value: 'PENDING',  label: 'En attente' },
  ];

  form = this.fb.group({ items: this.fb.array([this.newItemGroup()]) });

  get items(): FormArray { return this.form.get('items') as FormArray; }
  get successCount(): number { return this.rowStates.filter(s => s.status === 'success').length; }
  get pendingCount(): number  { return this.rowStates.filter(s => s.status !== 'success').length; }

  private newItemGroup(): FormGroup {
    return this.fb.group({
      centerAccreditationId:   [null as number | null, Validators.required],
      partnerAccreditationIds: [[] as number[]],
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

  ngOnInit(): void {
    this.bindItemListeners(0);

    forkJoin({
      centers:      this.tcApi.findAll(),
      licenseTypes: this.ltApi.findAll(),
      themes:       this.thApi.findAll(),
      trainers:     this.trApi.findAll(),
    }).subscribe({
      next: ({ centers, licenseTypes, themes, trainers }) => {
        (centers ?? []).forEach((tc: TrainingCenterDto) => {
          if (tc.id) this.tcById.set(tc.id, tc.name);
        });
        this.licenseTypes = (licenseTypes ?? []).filter(lt => !lt.archived);
        this.themes       = (themes ?? []).filter(t => !t.archived);
        this.allSubThemes = this.themes.flatMap(t =>
          (t.subThemes ?? []).filter(st => !st.archived).map(st => ({ ...st, themeId: t.id! }))
        );
        this.trainers = (trainers ?? []).filter(t => !t.archived);

        const caId = this.route.snapshot.queryParamMap.get('centerAccreditationId');
        if (caId) this.pendingCaId = parseInt(caId, 10);
      },
      error: (err) => {
        this.error = err?.error?.message || 'Impossible de charger les données de référence.';
      },
    });
  }

  // ─── Agréments centre par date ────────────────────────────

  private loadCenterAccreditations(i: number, date: string): void {
    if (!date) { this.centerAccreditationOptionsList[i] = []; return; }
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

        if (i === 0 && this.pendingCaId && newOptions.some(o => o.id === this.pendingCaId)) {
          this.items.at(0).get('centerAccreditationId')?.setValue(this.pendingCaId);
          this.pendingCaId = null;
        }

        const group = this.items.at(i) as FormGroup;
        const selectedId = group.get('centerAccreditationId')?.value as number | null;
        if (selectedId && !newOptions.some(o => o.id === selectedId)) {
          group.get('centerAccreditationId')?.setValue(null);
        }
      },
      error: () => {
        this.centerAccreditationOptionsList[i] = [];
        this.centerAccreditationLoadingList[i] = false;
      },
    });
  }

  // ─── Ajout / Suppression ──────────────────────────────────

  addItem(): void {
    this.items.push(this.newItemGroup());
    this.rowStates.push({ status: 'idle' });
    this.subThemeMinutesList.push({});
    this.autoPatchFlags.push(false);
    this.trainerSearchList.push('');
    this.partnerSearchList.push('');
    this.centerAccreditationOptionsList.push([]);
    this.centerAccreditationLoadingList.push(false);
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
    this.centerAccreditationOptionsList.splice(index, 1);
    this.centerAccreditationLoadingList.splice(index, 1);
  }

  // ─── Listeners ────────────────────────────────────────────

  private bindItemListeners(i: number): void {
    const group        = this.items.at(i) as FormGroup;
    const startCtrl    = group.get('startDate');
    const endCtrl      = group.get('endDate');
    const receivedCtrl = group.get('receivedDate');
    const numCtrl      = group.get('accreditationNumber');

    if (startCtrl) {
      startCtrl.valueChanges.subscribe((iso: any) => {
        const isoStr = iso ? String(iso) : '';
        this.loadCenterAccreditations(i, isoStr);
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
        if (!current) numCtrl.setValue(prefix, { emitEvent: false });
        else if (/^SM-\d{6}/.test(current)) numCtrl.setValue(prefix + current.slice(9), { emitEvent: false });
      });
      const initialPrefix = this.receivedDateToPrefix(String(receivedCtrl.value ?? ''));
      if (initialPrefix && !numCtrl.value) numCtrl.setValue(initialPrefix, { emitEvent: false });
    }
  }

  private receivedDateToPrefix(iso: string): string {
    const m = /^(\d{4})-(\d{2})/.exec(iso);
    return m ? `SM-${m[1]}${m[2]}` : '';
  }

  // ─── Sous-thèmes ──────────────────────────────────────────

  getSubThemesForTheme(themeId: number): SubTheme[] {
    return this.allSubThemes.filter(st => st.themeId === themeId);
  }

  filteredPartnersFor(i: number): CenterAccreditationOption[] {
    const q = (this.partnerSearchList[i] ?? '').toLowerCase().trim();
    if (!q) return this.centerAccreditationOptionsList[i] ?? [];
    return (this.centerAccreditationOptionsList[i] ?? []).filter(ca => ca.label.toLowerCase().includes(q));
  }

  filteredTrainersFor(i: number): TrainerDto[] {
    const q = (this.trainerSearchList[i] ?? '').toLowerCase().trim();
    if (!q) return this.trainers;
    return this.trainers.filter(tr =>
      `${tr.firstName} ${tr.lastName} ${tr.email ?? ''}`.toLowerCase().includes(q)
    );
  }

  // ─── Toggle helpers ───────────────────────────────────────

  toggleId(i: number, field: string, id: number): void {
    const ctrl = this.items.at(i).get(field);
    if (!ctrl) return;
    const current: number[] = ctrl.value ?? [];
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    ctrl.setValue(next);

    if (field === 'themeIds') {
      const subCtrl = this.items.at(i).get('subThemeIds');
      if (subCtrl) {
        const validSubIds = this.getSubThemesForTheme(id).map(st => st.id!);
        const kept = (subCtrl.value as number[]).filter(sid => {
          const theme = this.allSubThemes.find(st => st.id === sid);
          return theme ? (this.items.at(i).get('themeIds')?.value as number[] ?? []).includes(theme.themeId) : false;
        });
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
      total > 0 ? Math.round((total / 60) * 100) / 100 : null, { emitEvent: false }
    );
  }

  // ─── Modal formateur·trice ────────────────────────────────

  openTrainerModal(i: number): void {
    this.activeItemForModal = i;
    this.newTrainer = { firstName: '', lastName: '', email: '', phone: '', phytolicenceNumber: '', comment: '' };
    this.trainerModalError  = null;
    this.showTrainerModal   = true;
  }

  closeTrainerModal(): void { this.showTrainerModal = false; }

  saveNewTrainer(): void {
    if (!this.newTrainer.firstName.trim() || !this.newTrainer.lastName.trim()) {
      this.trainerModalError = 'Le prénom et le nom sont obligatoires.'; return;
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
    if (this.form.invalid) { this.form.markAllAsTouched(); this.error = 'Veuillez corriger les champs obligatoires.'; return; }
    this.rowStates = this.rowStates.map(s => s.status === 'success' ? s : { status: 'idle' as const });
    this.loading   = true;

    const run = async () => {
      for (let i = 0; i < this.items.length; i++) {
        if (this.rowStates[i]?.status === 'success') continue;
        const g = this.items.at(i);
        this.rowStates[i] = { status: 'saving' };
        const v = g.value;
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
        };
        await new Promise<void>((resolve) => {
          this.api.create(payload).pipe(finalize(() => resolve())).subscribe({
            next:  () => { this.rowStates[i] = { status: 'success' }; },
            error: (err) => {
              const msg = err?.error?.message || err?.error?.error || 'Création impossible.';
              this.rowStates[i] = { status: 'error', error: msg };
            },
          });
        });
      }
    };

    run().then(() => {
      this.loading = false;
      const hasError = this.rowStates.some(s => s.status === 'error');
      if (hasError) { this.error = "Certains sous-modules n'ont pas pu être créés."; return; }
      if (mode === 'back') {
        this.toast.success('Sous-module(s) créé(s).');
        this.router.navigateByUrl('/sub-modules');
        return;
      }
      this.form.setControl('items', this.fb.array([this.newItemGroup()]));
      this.rowStates = [{ status: 'idle' }]; this.subThemeMinutesList = [{}];
      this.autoPatchFlags = [false]; this.trainerSearchList = [''];
      this.partnerSearchList = ['']; this.centerAccreditationOptionsList = [[]];
      this.centerAccreditationLoadingList = [false];
      this.bindItemListeners(0); this.error = null;
    }).catch(() => { this.loading = false; this.error = 'Une erreur inattendue est survenue.'; });
  }

  // ─── Helpers ──────────────────────────────────────────────

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
    if (digits.startsWith('0032')) digits = '+32' + digits.slice(4);
    else if (/^0[^0]/.test(digits)) digits = '+32' + digits.slice(1);
    else if (!digits.startsWith('+32')) return trimmed.replace(/\s+/g, ' ');
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

  private todayIso(): string { return new Date().toISOString().slice(0, 10); }

  private addThreeYearsMinusOneDay(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return '';
    const d  = new Date(parseInt(m[1], 10) + 3, parseInt(m[2], 10) - 1, parseInt(m[3], 10) - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
