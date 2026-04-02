import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';
import { HasRoleDirective } from '../../../../core/auth/has-role.directive';

import { TrainerApi, TrainerDto } from '../../api/trainer.api';
import { TrainingAccreditationApi, TrainingAccreditationDto } from '../../../training-accreditations/api/training-accreditation.api';
import { OrganismApi, OrganismDto } from '../../../organisms/api/organism.api';
import { ToastService } from '../../../../shared/toast/toast.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

@Component({
  selector: 'app-trainer-detail',
  standalone: true,
  imports: [...SHARED_IMPORTS, ReactiveFormsModule, HasRoleDirective],
  templateUrl: './trainer-detail.html',
  styleUrl: './trainer-detail.css',
})
export class TrainerDetail implements OnInit {
  private fb     = inject(FormBuilder);
  private api    = inject(TrainerApi);
  private taApi  = inject(TrainingAccreditationApi);
  private orgApi = inject(OrganismApi);
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
  trainingAccreditations: TrainingAccreditationDto[] = [];
  organisms: OrganismDto[] = [];

  // ─── État ─────────────────────────────────────────────────
  loading  = false;
  error:   string | null = null;
  success: string | null = null;

  // ─── Formulaire ───────────────────────────────────────────
  form = this.fb.group({
    firstName:               ['', [Validators.required, Validators.maxLength(100)]],
    lastName:                ['', [Validators.required, Validators.maxLength(100)]],
    email:                   ['', [Validators.email, Validators.maxLength(180)]],
    phone:                   ['', Validators.maxLength(50)],
    phytolicenceNumber:       ['', Validators.maxLength(100)],
    trainingAccreditationIds: [[] as number[]],
    partnerOrganismIds:       [[] as number[]],
    comment:                 [''],
  });

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));

    forkJoin({
      trainer:       this.api.get(this.id),
      accreditations: this.taApi.findAll(),
      organisms:     this.orgApi.findAll(),
    }).subscribe({
      next: ({ trainer, accreditations, organisms }) => {
        this.trainingAccreditations = (accreditations ?? []).filter(a => !a.archived);
        this.organisms = (organisms ?? []).filter(o => !o.archived);

        // Populate audit fields
        this.currentArchived = trainer.archived ?? false;
        this.createdAt  = trainer.createdAt;
        this.updatedAt  = trainer.updatedAt;
        this.createdBy  = trainer.createdBy;
        this.updatedBy  = trainer.updatedBy;

        // Populate form
        this.form.patchValue({
          firstName:                trainer.firstName,
          lastName:                 trainer.lastName,
          email:                    trainer.email ?? '',
          phone:                    trainer.phone ?? '',
          phytolicenceNumber:       trainer.phytolicenceNumber ?? '',
          trainingAccreditationIds: [...(trainer.trainingAccreditationIds ?? [])],
          partnerOrganismIds:       trainer.partnerOrganismIds ?? [],
          comment:                  trainer.comment ?? '',
        });
      },
      error: (err) => {
        this.error = err?.error?.message || 'Impossible de charger les données.';
      },
    });
  }

  // ─── Toggle agrément formation ────────────────────────────

  isAccreditationSelected(id: number): boolean {
    const val: number[] = this.form.get('trainingAccreditationIds')?.value ?? [];
    return val.includes(id);
  }

  toggleAccreditation(id: number): void {
    const ctrl = this.form.get('trainingAccreditationIds');
    if (!ctrl) return;
    const current: number[] = ctrl.value ?? [];
    ctrl.setValue(current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  }

  // ─── Toggle organisme ─────────────────────────────────────

  isOrganismSelected(id: number): boolean {
    const val: number[] = this.form.get('partnerOrganismIds')?.value ?? [];
    return val.includes(id);
  }

  toggleOrganism(id: number): void {
    const ctrl = this.form.get('partnerOrganismIds');
    if (!ctrl) return;
    const current: number[] = ctrl.value ?? [];
    ctrl.setValue(current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  }

  // ─── Submit ───────────────────────────────────────────────

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

    const payload: TrainerDto = {
      firstName:                v.firstName?.trim() ?? '',
      lastName:                 v.lastName?.trim()  ?? '',
      email:                    this.trimOrNull(v.email),
      phone:                    this.trimOrNull(v.phone),
      phytolicenceNumber:       this.trimOrNull(v.phytolicenceNumber),
      trainingAccreditationIds: v.trainingAccreditationIds ?? [],
      partnerOrganismIds:       v.partnerOrganismIds ?? [],
      comment:                  this.trimOrNull(v.comment),
    };

    this.api.update(this.id, payload).subscribe({
      next: (updated) => {
        this.loading  = false;
        this.success  = 'Modifications enregistrées.';
        this.updatedAt = updated.updatedAt;
        this.updatedBy = updated.updatedBy;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || err?.error?.error || 'Erreur lors de la sauvegarde.';
      },
    });
  }

  // ─── Archive / Désarchiver ────────────────────────────────

  async toggleArchive(): Promise<void> {
    const archived = !this.currentArchived;
    const msg = archived ? 'Archiver ce formateur·trice ?' : 'Désarchiver ce formateur·trice ?';
    if (!await this.confirmDialog.confirm(msg)) return;

    this.loading = true;
    this.api.archive(this.id, archived).subscribe({
      next: () => {
        this.loading = false;
        this.currentArchived = archived;
        this.success = archived ? 'Formateur·trice archivé(e).' : 'Formateur·trice désarchivé(e).';
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Erreur lors de l\'archivage.';
      },
    });
  }

  // ─── Supprimer ────────────────────────────────────────────

  async delete(): Promise<void> {
    if (!await this.confirmDialog.confirm('Supprimer définitivement ce formateur·trice ? Cette action est irréversible.', { danger: true })) return;
    this.loading = true;
    this.api.delete(this.id).subscribe({
      next: () => { this.toast.success('Formateur supprimé.'); this.router.navigateByUrl('/trainers'); },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Erreur lors de la suppression.';
      },
    });
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

  // ─── Format téléphone belge ───────────────────────────────

  onPhoneBlur(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = this.formatBelgianPhone(input.value);
    this.form.get('phone')?.setValue(formatted, { emitEvent: false });
    input.value = formatted;
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

  // ─── Format phytolicence DD.X.DDDDD (X = lettre ou chiffre) ──────────────────────

  onPhytolicenceInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = this.formatPhytolicence(input.value);
    input.value = formatted;
    this.form.get('phytolicenceNumber')?.setValue(formatted, { emitEvent: false });
  }

  private formatPhytolicence(value: string): string {
    const cleaned = value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    let result = '';
    let pos = 0;

    // Partie 1 : 2 chiffres
    while (pos < cleaned.length && result.length < 2) {
      if (/\d/.test(cleaned[pos])) result += cleaned[pos];
      pos++;
    }

    if (result.length === 2 && pos < cleaned.length) {
      // Partie 2 : 1 caractère (lettre OU chiffre)
      const mid = cleaned[pos];
      result += '.' + mid;
      pos++;
      // Partie 3 : 5 chiffres
      if (pos < cleaned.length) {
        let digits = '';
        while (pos < cleaned.length && digits.length < 5) {
          if (/\d/.test(cleaned[pos])) digits += cleaned[pos];
          pos++;
        }
        if (digits) result += '.' + digits;
      }
    }

    return result;
  }

  private trimOrNull(v: unknown): string | null {
    const s = String(v ?? '').trim();
    return s.length ? s : null;
  }
}
