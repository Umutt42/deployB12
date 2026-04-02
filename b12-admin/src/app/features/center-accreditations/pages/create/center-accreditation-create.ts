import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import {
  CenterAccreditationApi,
  CenterAccreditationDto,
  AccreditationRequestStatus,
} from '../../api/center-accreditation.api';
import { TrainingCenterApi, TrainingCenterDto } from '../../../training-centers/api/training-center.api';
import { getProvinceFromPostalCode } from '../../../../shared/utils/belgian-postal-code';
import { ToastService } from '../../../../shared/toast/toast.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

function endAfterStart(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value;
  const end   = group.get('endDate')?.value;
  if (start && end && end < start) return { endBeforeStart: true };
  return null;
}

type RowState = {
  status: 'idle' | 'saving' | 'success' | 'error';
  error?: string | null;
};

@Component({
  selector: 'app-center-accreditation-create',
  standalone: true,
  imports: [...SHARED_IMPORTS, ReactiveFormsModule],
  templateUrl: './center-accreditation-create.html',
  styleUrl: './center-accreditation-create.css',
})
export class CenterAccreditationCreate implements OnInit {
  private fb     = inject(FormBuilder);
  private api    = inject(CenterAccreditationApi);
  private tcApi  = inject(TrainingCenterApi);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private toast  = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);

  trainingCenters: TrainingCenterDto[] = [];

  loading = false;
  error:   string | null = null;

  rowStates: RowState[] = [{ status: 'idle' }];

  /** Empêche la boucle quand on patch endDate suite à startDate (par item) */
  private autoPatchFlags: boolean[] = [false];

  /** Empêche d'écraser les adresses lors du chargement cloneId (par item) */
  private suppressFlags: boolean[] = [false];

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
      trainingCenterId:    [null as number | null, [Validators.required]],
      receivedDate:        [this.todayIso()],
      requestStatus:       ['RECEIVED' as AccreditationRequestStatus | ''],
      accreditationNumber: ['', [Validators.maxLength(60)]],
      startDate:           [''],
      endDate:             [''],
      initial:             [true],
      continuous:          [true],
      trainingSiteAddresses: this.fb.array([]),
      contactPeople:         this.fb.array([]),
    }, { validators: endAfterStart });
  }

  // ─── Accesseurs sous-FormArray ────────────────────────────

  getAddresses(i: number): FormArray {
    return this.items.at(i).get('trainingSiteAddresses') as FormArray;
  }

  getContacts(i: number): FormArray {
    return this.items.at(i).get('contactPeople') as FormArray;
  }

  private addressGroup(): FormGroup {
    return this.fb.group({
      street:     ['', [Validators.maxLength(180)]],
      number:     ['', [Validators.maxLength(30)]],
      city:       ['', [Validators.maxLength(120)]],
      postalCode: ['', [Validators.maxLength(20)]],
      province:   ['', [Validators.maxLength(120)]],
    });
  }

  private contactGroup(): FormGroup {
    return this.fb.group({
      firstName: ['', [Validators.maxLength(120)]],
      lastName:  ['', [Validators.maxLength(120)]],
      fonction:  ['', [Validators.maxLength(120)]],
      email:     ['', [Validators.maxLength(180), Validators.email]],
      phone:     ['', [Validators.maxLength(40)]],
    });
  }

  addAddress(i: number): void              { this.getAddresses(i).push(this.addressGroup()); }
  removeAddress(i: number, j: number): void { this.getAddresses(i).removeAt(j); }

  addContact(i: number): void              { this.getContacts(i).push(this.contactGroup()); }
  removeContact(i: number, j: number): void { this.getContacts(i).removeAt(j); }

  // ─── Lifecycle ────────────────────────────────────────────

  ngOnInit(): void {
    this.tcApi.findAll().subscribe({
      next: (list) => {
        this.trainingCenters = (list ?? [])
          .filter((tc) => !tc.archived)
          .sort((a, b) => a.name.localeCompare(b.name));

        for (let i = 0; i < this.items.length; i++) {
          const tcId = this.items.at(i).get('trainingCenterId')?.value;
          if (tcId) this.copyHqToFirstAddress(i, tcId);
        }
      },
    });

    // Pré-sélectionner le centre si passé en query param
    const tcId = this.route.snapshot.queryParamMap.get('trainingCenterId');
    if (tcId) {
      this.items.at(0).patchValue({ trainingCenterId: parseInt(tcId, 10) });
    }

    this.bindItemListeners(0);

    // Dupliquer un agrément existant
    const cloneId = this.route.snapshot.queryParamMap.get('cloneId');
    if (cloneId) {
      this.suppressFlags[0] = true;
      this.api.get(parseInt(cloneId, 10)).subscribe({
        next: (src) => {
          this.items.at(0).patchValue({
            trainingCenterId:    src.trainingCenterId ?? null,
            receivedDate:        src.receivedDate     ?? '',
            requestStatus:       src.requestStatus    ?? '',
            accreditationNumber: src.accreditationNumber ?? '',
            startDate:  src.startDate  ?? '',
            endDate:    src.endDate    ?? '',
            initial:    src.initial    ?? false,
            continuous: src.continuous ?? false,
          });

          const addrs = this.getAddresses(0);
          addrs.clear();
          for (const a of src.trainingSiteAddresses ?? []) {
            addrs.push(this.fb.group({
              street:     [a.street     ?? ''],
              number:     [a.number     ?? ''],
              city:       [a.city       ?? ''],
              postalCode: [a.postalCode ?? ''],
              province:   [a.province   ?? ''],
            }));
          }

          const ctcts = this.getContacts(0);
          ctcts.clear();
          for (const c of src.contactPeople ?? []) {
            ctcts.push(this.fb.group({
              firstName: [c.firstName ?? ''],
              lastName:  [c.lastName  ?? ''],
              fonction:  [(c as any).fonction ?? ''],
              email:     [c.email     ?? '', [Validators.maxLength(180), Validators.email]],
              phone:     [c.phone     ?? ''],
            }));
          }

          this.suppressFlags[0] = false;
        },
      });
    }

    // Renouveler un agrément existant
    const renewId = this.route.snapshot.queryParamMap.get('renewId');
    if (renewId) {
      this.suppressFlags[0] = true;
      this.api.get(parseInt(renewId, 10)).subscribe({
        next: (src) => {
          const today     = this.todayIso();
          const startDate = this.computeRenewalStartDate(src.endDate, today);
          const endDate   = this.computeEndDateIso(startDate) ?? '';

          this.items.at(0).patchValue({
            trainingCenterId:    src.trainingCenterId    ?? null,
            receivedDate:        today,
            requestStatus:       'RECEIVED' as AccreditationRequestStatus,
            accreditationNumber: src.accreditationNumber ?? '',
            startDate,
            endDate,
            initial:    src.initial    ?? false,
            continuous: src.continuous ?? false,
          });

          const addrs = this.getAddresses(0);
          addrs.clear();
          for (const a of src.trainingSiteAddresses ?? []) {
            addrs.push(this.fb.group({
              street:     [a.street     ?? ''],
              number:     [a.number     ?? ''],
              city:       [a.city       ?? ''],
              postalCode: [a.postalCode ?? ''],
              province:   [a.province   ?? ''],
            }));
          }

          const ctcts = this.getContacts(0);
          ctcts.clear();
          for (const c of src.contactPeople ?? []) {
            ctcts.push(this.fb.group({
              firstName: [c.firstName ?? ''],
              lastName:  [c.lastName  ?? ''],
              fonction:  [(c as any).fonction ?? ''],
              email:     [c.email     ?? '', [Validators.maxLength(180), Validators.email]],
              phone:     [c.phone     ?? ''],
            }));
          }

          this.suppressFlags[0] = false;
        },
      });
    }
  }

  // ─── Ajout / Suppression d'agréments ─────────────────────

  addItem(): void {
    this.items.push(this.newItemGroup());
    this.rowStates.push({ status: 'idle' });
    this.autoPatchFlags.push(false);
    this.suppressFlags.push(false);
    const i = this.items.length - 1;
    this.bindItemListeners(i);
  }

  removeItem(index: number): void {
    if (this.items.length <= 1) return;
    this.items.removeAt(index);
    this.rowStates.splice(index, 1);
    this.autoPatchFlags.splice(index, 1);
    this.suppressFlags.splice(index, 1);
  }

  // ─── Listeners par item ───────────────────────────────────

  private bindItemListeners(i: number): void {
    const group     = this.items.at(i) as FormGroup;
    const startCtrl = group.get('startDate');
    const endCtrl   = group.get('endDate');

    // Auto-calcule endDate = startDate + 3 ans - 1 jour
    if (startCtrl && endCtrl) {
      startCtrl.valueChanges.subscribe((start: any) => {
        if (this.autoPatchFlags[i]) return;
        const startIso = String(start ?? '').trim();
        if (!startIso) {
          this.autoPatchFlags[i] = true;
          endCtrl.patchValue('', { emitEvent: false });
          this.autoPatchFlags[i] = false;
          return;
        }
        const computed = this.computeEndDateIso(startIso);
        if (!computed) return;
        this.autoPatchFlags[i] = true;
        endCtrl.patchValue(computed, { emitEvent: false });
        this.autoPatchFlags[i] = false;
      });
    }

    // Auto-copy HQ → 1ère adresse de site
    const tcCtrl = group.get('trainingCenterId');
    if (tcCtrl) {
      tcCtrl.valueChanges.subscribe((id: any) => {
        if (this.suppressFlags[i]) return;
        const tcId = Number(id ?? 0);
        if (!tcId) return;
        this.copyHqToFirstAddress(i, tcId);
      });
    }
  }

  private computeEndDateIso(startIso: string): string | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startIso);
    if (!m) return null;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const startUtc = new Date(Date.UTC(y, mo - 1, d));
    if (Number.isNaN(startUtc.getTime())) return null;
    const endUtc = new Date(startUtc);
    endUtc.setUTCFullYear(endUtc.getUTCFullYear() + 3);
    endUtc.setUTCDate(endUtc.getUTCDate() - 1);
    return endUtc.toISOString().slice(0, 10);
  }

  /**
   * Calcule la date de début du renouvellement :
   * - Si aujourd'hui est avant la date de fin → endDate + 1 jour
   * - Sinon → aujourd'hui
   */
  private computeRenewalStartDate(endDateIso: string | null | undefined, today: string): string {
    if (!endDateIso) return today;
    if (today < endDateIso) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endDateIso);
      if (!m) return today;
      const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
      dt.setUTCDate(dt.getUTCDate() + 1);
      return dt.toISOString().slice(0, 10);
    }
    return today;
  }

  // ─── Auto-copy HQ → adresse de site ──────────────────────

  private copyHqToFirstAddress(i: number, trainingCenterId: number): void {
    const first = this.getAddresses(i).at(0) as FormGroup | undefined;
    if (first && first.dirty) return;

    const tc = this.trainingCenters.find((x) => x.id === trainingCenterId);
    if (!tc) {
      this.tcApi.get(trainingCenterId).subscribe({
        next: (fetched) => this.applyHqToFirstAddress(i, fetched),
      });
      return;
    }
    this.applyHqToFirstAddress(i, tc);
  }

  private applyHqToFirstAddress(i: number, tc: TrainingCenterDto): void {
    const addrs = this.getAddresses(i);
    if (addrs.length === 0) this.addAddress(i);
    const first = addrs.at(0) as FormGroup;
    if (first.dirty) return;
    first.patchValue({
      street:     tc.hqStreet     ?? '',
      number:     tc.hqNumber     ?? '',
      postalCode: tc.hqPostalCode ?? '',
      city:       tc.hqCity       ?? '',
      province:   tc.hqProvince   ?? '',
    }, { emitEvent: false });
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

    let lastCreatedId: number | null = null;

    const run = async () => {
      for (let i = 0; i < this.items.length; i++) {
        if (this.rowStates[i]?.status === 'success') continue;

        const g = this.items.at(i);
        this.rowStates[i] = { status: 'saving' };

        const v = g.value;
        const payload: CenterAccreditationDto = {
          trainingCenterId:    v.trainingCenterId!,
          receivedDate:        this.trimOrNull(v.receivedDate),
          requestStatus:       (v.requestStatus || null) as AccreditationRequestStatus | null,
          accreditationNumber: this.trimOrNull(v.accreditationNumber),
          startDate:           this.trimOrNull(v.startDate),
          endDate:             this.trimOrNull(v.endDate),
          initial:             v.initial ?? false,
          continuous:          v.continuous ?? false,
          trainingSiteAddresses: (v.trainingSiteAddresses ?? []).map((a: any) => ({
            street:     this.trimOrNull(a.street),
            number:     this.trimOrNull(a.number),
            city:       this.trimOrNull(a.city),
            postalCode: this.trimOrNull(a.postalCode),
            province:   this.trimOrNull(a.province),
            archived:   false,
          })),
          contactPeople: (v.contactPeople ?? []).map((c: any) => ({
            firstName: this.trimOrNull(c.firstName),
            lastName:  this.trimOrNull(c.lastName),
            fonction:  this.trimOrNull(c.fonction),
            email:     this.trimOrNull(c.email),
            phone:     this.trimOrNull(c.phone),
            archived:  false,
          })),
        };

        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((resolve) => {
          this.api.create(payload)
            .pipe(finalize(() => resolve()))
            .subscribe({
              next:  (created) => { this.rowStates[i] = { status: 'success' }; lastCreatedId = created.id ?? null; },
              error: (err) => {
                const msg = err?.error?.message || err?.error?.error || 'Création impossible.';
                this.rowStates[i] = { status: 'error', error: msg };
              },
            });
        });
      }
    };

    run()
      .then(async () => {
        this.loading = false;
        const hasError = this.rowStates.some((s) => s.status === 'error');
        if (hasError) {
          this.error = "Certains agréments n'ont pas pu être créés. Corrige les lignes en erreur.";
          return;
        }
        if (mode === 'back') {
          this.toast.success('Agrément(s) centre créé(s).');
          // Si on vient d'un renouvellement, demander d'archiver l'ancien agrément en premier
          const renewId = this.route.snapshot.queryParamMap.get('renewId');
          if (renewId) {
            const archiveOld = await this.confirmDialog.confirm('Voulez-vous archiver l\'ancien agrément centre ?');
            if (archiveOld) {
              this.api.archive(parseInt(renewId, 10), true).subscribe();
            }
          }

          const goToTrainingAccreditation = lastCreatedId
            ? await this.confirmDialog.confirm('Agrément(s) centre créé(s) avec succès.\n\nVoulez-vous créer un agrément formation pour cet agrément centre ?')
            : false;
          if (goToTrainingAccreditation) {
            this.router.navigate(['/training-accreditations/new'], { queryParams: { centerAccreditationId: lastCreatedId } });
          } else {
            this.router.navigateByUrl('/center-accreditations');
          }
          return;
        }
        this.form.setControl('items', this.fb.array([this.newItemGroup()]));
        this.rowStates      = [{ status: 'idle' }];
        this.autoPatchFlags = [false];
        this.suppressFlags  = [false];
        this.bindItemListeners(0);
        this.error = null;
      })
      .catch(() => {
        this.loading = false;
        this.error   = 'Une erreur inattendue est survenue.';
      });
  }

  // ─── Formatage téléphone / email ─────────────────────────

  formatPhoneBlur(event: Event, ctrl: AbstractControl | null): void {
    if (!ctrl) return;
    const input = event.target as HTMLInputElement;
    const formatted = this.formatBelgianPhone(input.value);
    ctrl.setValue(formatted, { emitEvent: false });
    input.value = formatted;
  }

  normalizeEmailBlur(event: Event, ctrl: AbstractControl | null): void {
    if (!ctrl) return;
    const input = event.target as HTMLInputElement;
    const normalized = input.value.trim().toLowerCase();
    if (normalized !== input.value) {
      ctrl.setValue(normalized, { emitEvent: false });
      input.value = normalized;
    }
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

  // ─── Auto-fill province depuis code postal ───────────────

  onAddressPostalCodeInput(i: number, j: number): void {
    const cp       = this.getAddresses(i).at(j).get('postalCode')?.value ?? '';
    const province = getProvinceFromPostalCode(cp);
    if (province) {
      this.getAddresses(i).at(j).get('province')?.setValue(province, { emitEvent: false });
    }
  }

  private trimOrNull(v: unknown): string | null {
    const s = String(v ?? '').trim();
    return s.length ? s : null;
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
}