import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';
import { HasRoleDirective } from '../../../../core/auth/has-role.directive';

import {
  CenterAccreditationApi,
  CenterAccreditationDto,
  ContactPersonDto,
  TrainingSiteAddressDto,
  AccreditationRequestStatus,
} from '../../api/center-accreditation.api';
import { TrainingCenterApi } from '../../../training-centers/api/training-center.api';
import { getProvinceFromPostalCode } from '../../../../shared/utils/belgian-postal-code';
import { ToastService } from '../../../../shared/toast/toast.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

function endAfterStart(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value;
  const end   = group.get('endDate')?.value;
  if (start && end && end < start) return { endBeforeStart: true };
  return null;
}

@Component({
  selector: 'app-center-accreditation-detail',
  standalone: true,
  imports: [...SHARED_IMPORTS, ReactiveFormsModule, HasRoleDirective],
  templateUrl: './center-accreditation-detail.html',
  styleUrl: './center-accreditation-detail.css',
})
export class CenterAccreditationDetail implements OnInit {
  private fb     = inject(FormBuilder);
  private api    = inject(CenterAccreditationApi);
  private tcApi  = inject(TrainingCenterApi);
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private toast  = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);

  id!: number;
  private trainingCenterId!: number;

  tcName          = '-';
  tcCompanyNumber = '-';

  currentArchived = false;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;

  loading = false;
  error: string | null = null;
  success: string | null = null;

  readonly statusOptions: { value: AccreditationRequestStatus; label: string }[] = [
    { value: 'RECEIVED', label: 'Reçu' },
    { value: 'ACCEPTED', label: 'Accepté' },
    { value: 'REFUSED',  label: 'Refusé' },
    { value: 'PENDING',  label: 'En attente' },
  ];

  form = this.fb.group({
    receivedDate:        [''],
    requestStatus:       ['' as AccreditationRequestStatus | ''],
    accreditationNumber: ['', [Validators.maxLength(60)]],
    startDate:  [''],
    endDate:    [''],
    initial:    [false],
    continuous: [false],
    trainingSiteAddresses: this.fb.array([]),
    contactPeople:         this.fb.array([]),
  }, { validators: endAfterStart });

  // ─── FormArray getters ────────────────────────────────────

  get addresses(): FormArray {
    return this.form.get('trainingSiteAddresses') as FormArray;
  }

  get contacts(): FormArray {
    return this.form.get('contactPeople') as FormArray;
  }

  private addressGroup(a?: TrainingSiteAddressDto): FormGroup {
    return this.fb.group({
      street:     [a?.street     ?? '', [Validators.maxLength(180)]],
      number:     [a?.number     ?? '', [Validators.maxLength(30)]],
      city:       [a?.city       ?? '', [Validators.maxLength(120)]],
      postalCode: [a?.postalCode ?? '', [Validators.maxLength(20)]],
      province:   [a?.province   ?? '', [Validators.maxLength(120)]],
    });
  }

  private contactGroup(c?: ContactPersonDto): FormGroup {
    return this.fb.group({
      firstName: [c?.firstName ?? '', [Validators.maxLength(120)]],
      lastName:  [c?.lastName  ?? '', [Validators.maxLength(120)]],
      email:     [c?.email     ?? '', [Validators.maxLength(180), Validators.email]],
      phone:     [c?.phone     ?? '', [Validators.maxLength(40)]],
    });
  }

  addAddress(): void             { this.addresses.push(this.addressGroup()); }
  removeAddress(i: number): void { this.addresses.removeAt(i); }

  addContact(): void             { this.contacts.push(this.contactGroup()); }
  removeContact(i: number): void { this.contacts.removeAt(i); }

  // ─── Lifecycle ────────────────────────────────────────────

  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('id');
    this.id = Number(rawId);
    if (!this.id || isNaN(this.id)) {
      this.router.navigateByUrl('/center-accreditations');
      return;
    }

    this.loading = true;

    forkJoin({
      accreditation: this.api.get(this.id),
      centers: this.tcApi.findAll(),
    }).subscribe({
      next: ({ accreditation, centers }) => {
        this.trainingCenterId = accreditation.trainingCenterId!;
        this.currentArchived  = !!accreditation.archived;
        this.createdAt        = accreditation.createdAt;
        this.updatedAt        = accreditation.updatedAt;
        this.createdBy        = accreditation.createdBy;
        this.updatedBy        = accreditation.updatedBy;

        const tc = (centers ?? []).find((c) => c.id === accreditation.trainingCenterId);
        this.tcName          = tc?.name          ?? '-';
        this.tcCompanyNumber = tc?.companyNumber ?? '-';

        this.form.patchValue({
          receivedDate:        accreditation.receivedDate        ?? '',
          requestStatus:       accreditation.requestStatus       ?? '',
          accreditationNumber: accreditation.accreditationNumber ?? '',
          startDate:  accreditation.startDate  ?? '',
          endDate:    accreditation.endDate    ?? '',
          initial:    accreditation.initial    ?? false,
          continuous: accreditation.continuous ?? false,
        });

        // Pré-remplir adresses
        this.addresses.clear();
        (accreditation.trainingSiteAddresses ?? []).forEach((a) =>
          this.addresses.push(this.addressGroup(a))
        );

        // Pré-remplir contacts
        this.contacts.clear();
        (accreditation.contactPeople ?? []).forEach((c) =>
          this.contacts.push(this.contactGroup(c))
        );
      },
      error: (err) => {
        this.error = err?.error?.message || 'Impossible de charger cet agrément.';
      },
      complete: () => (this.loading = false),
    });
  }

  // ─── Actions ──────────────────────────────────────────────

  save(): void {
    this.error   = null;
    this.success = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error = 'Veuillez corriger les champs obligatoires.';
      return;
    }

    this.loading = true;
    const v = this.form.value;

    const payload: CenterAccreditationDto = {
      trainingCenterId:    this.trainingCenterId,
      receivedDate:        this.trimOrNull(v.receivedDate),
      requestStatus:       (v.requestStatus || null) as AccreditationRequestStatus | null,
      accreditationNumber: this.trimOrNull(v.accreditationNumber),
      startDate:  this.trimOrNull(v.startDate),
      endDate:    this.trimOrNull(v.endDate),
      initial:    v.initial    ?? false,
      continuous: v.continuous ?? false,
      archived:   this.currentArchived,
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
        email:     this.trimOrNull(c.email),
        phone:     this.trimOrNull(c.phone),
        archived:  false,
      })),
    };

    this.api.update(this.id, payload).subscribe({
      next: (updated) => {
        this.currentArchived = !!updated.archived;
        this.updatedAt       = updated.updatedAt;
        this.updatedBy       = updated.updatedBy;
        this.success = 'Modifications enregistrées.';
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors de la sauvegarde.';
      },
      complete: () => (this.loading = false),
    });
  }

  toggleArchive(): void {
    this.error   = null;
    this.success = null;
    this.loading = true;

    this.api.archive(this.id, !this.currentArchived).subscribe({
      next: (updated) => {
        this.currentArchived = !!updated.archived;
        this.success = this.currentArchived ? 'Agrément archivé.' : 'Agrément désarchivé.';
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors du changement de statut.';
      },
      complete: () => (this.loading = false),
    });
  }

  renew(): void {
    this.router.navigate(['/center-accreditations/new'], {
      queryParams: { renewId: this.id },
    });
  }

  async delete(): Promise<void> {
    const ok = await this.confirmDialog.confirm('Supprimer cet agrément centre ? Cette action est irréversible.', { danger: true });
    if (!ok) return;

    this.loading = true;
    this.api.delete(this.id).subscribe({
      next: () => { this.toast.success('Agrément centre supprimé.'); this.router.navigateByUrl('/center-accreditations'); },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors de la suppression.';
        this.loading = false;
      },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────

  formatDate(iso?: string): string {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    const datePart = new Intl.DateTimeFormat('fr-BE', {
      day: '2-digit', month: 'long', year: 'numeric',
    }).format(d);
    const timePart = new Intl.DateTimeFormat('fr-BE', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(d);
    return `${datePart} ${timePart}`;
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

  onAddressPostalCodeInput(j: number): void {
    const cp       = this.addresses.at(j).get('postalCode')?.value ?? '';
    const province = getProvinceFromPostalCode(cp);
    if (province) {
      this.addresses.at(j).get('province')?.setValue(province, { emitEvent: false });
    }
  }

  private trimOrNull(v: unknown): string | null {
    const s = String(v ?? '').trim();
    return s.length ? s : null;
  }
}
