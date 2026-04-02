import { Component, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AbstractControl, FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { TrainerApi, TrainerDto, TrainerImportRowDto } from '../../api/trainer.api';
import { TrainingAccreditationApi, TrainingAccreditationDto } from '../../../training-accreditations/api/training-accreditation.api';
import { OrganismApi, OrganismDto } from '../../../organisms/api/organism.api';
import { ToastService } from '../../../../shared/toast/toast.service';

type RowState = {
  status: 'idle' | 'saving' | 'success' | 'error';
  error?: string | null;
};

@Component({
  selector: 'app-trainer-create',
  standalone: true,
  imports: [...SHARED_IMPORTS, ReactiveFormsModule],
  templateUrl: './trainer-create.html',
  styleUrl: './trainer-create.css',
})
export class TrainerCreate implements OnInit {
  private fb     = inject(FormBuilder);
  private api    = inject(TrainerApi);
  private taApi  = inject(TrainingAccreditationApi);
  private orgApi = inject(OrganismApi);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private toast  = inject(ToastService);

  @ViewChild('importInput') importInputRef!: ElementRef<HTMLInputElement>;

  // ─── Listes de référence ──────────────────────────────────
  trainingAccreditations: TrainingAccreditationDto[] = [];
  organisms: OrganismDto[] = [];

  // ─── Recherche par item ───────────────────────────────────
  accreditationSearch: string[] = [''];
  organismSearch:      string[] = [''];

  filteredAccreditationsFor(i: number): TrainingAccreditationDto[] {
    const q = (this.accreditationSearch[i] ?? '').toLowerCase().trim();
    if (!q) return this.trainingAccreditations;
    return this.trainingAccreditations.filter(ta =>
      `${ta.accreditationNumber ?? ''} ${ta.title ?? ''}`.toLowerCase().includes(q)
    );
  }

  filteredOrganismsFor(i: number): OrganismDto[] {
    const q = (this.organismSearch[i] ?? '').toLowerCase().trim();
    if (!q) return this.organisms;
    return this.organisms.filter(o => (o.name ?? '').toLowerCase().includes(q));
  }

  // ─── Import dropdown ──────────────────────────────────────
  showImportMenu = false;

  toggleImportMenu(): void { this.showImportMenu = !this.showImportMenu; }

  @HostListener('document:click')
  closeImportMenu(): void { this.showImportMenu = false; }

  // ─── État batch ───────────────────────────────────────────
  loading = false;
  error:   string | null = null;

  rowStates: RowState[] = [{ status: 'idle' }];

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
      firstName:               ['', [Validators.required, Validators.maxLength(100)]],
      lastName:                ['', [Validators.required, Validators.maxLength(100)]],
      email:                   ['', [Validators.email, Validators.maxLength(180)]],
      phone:                   ['', Validators.maxLength(50)],
      phytolicenceNumber:       ['', Validators.maxLength(100)],
      trainingAccreditationIds: [[] as number[]],
      partnerOrganismIds:       [[] as number[]],
      comment:                 [''],
    });
  }

  ngOnInit(): void {
    forkJoin({
      accreditations: this.taApi.findAll(),
      organisms:      this.orgApi.findAll(),
    }).subscribe({
      next: ({ accreditations, organisms }) => {
        this.trainingAccreditations = (accreditations ?? []).filter(a => !a.archived);
        this.organisms = (organisms ?? []).filter(o => !o.archived);

        // Dupliquer un formateur·trice existant
        const cloneId = this.route.snapshot.queryParamMap.get('cloneId');
        if (cloneId) {
          this.api.get(parseInt(cloneId, 10)).subscribe({
            next: (src) => {
              this.items.at(0).patchValue({
                firstName:                src.firstName                         ?? '',
                lastName:                 src.lastName                          ?? '',
                email:                    src.email                             ?? '',
                phone:                    src.phone                             ?? '',
                phytolicenceNumber:       src.phytolicenceNumber                ?? '',
                trainingAccreditationIds: [...(src.trainingAccreditationIds ?? [])],
                partnerOrganismIds:       src.partnerOrganismIds                ?? [],
                comment:                  src.comment                           ?? '',
              });
            },
          });
        }
      },
      error: (err) => {
        this.error = err?.error?.message || 'Impossible de charger les données de référence.';
      },
    });
  }

  // ─── Import CSV / XLSX ────────────────────────────────────

  handleImport(format: 'csv' | 'xlsx'): void {
    const input = this.importInputRef.nativeElement;
    input.accept = format === 'csv' ? '.csv' : '.xlsx,.xls';
    input.value  = '';
    input.click();
  }

  onImportFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.loading = true;
    this.api.previewImport(file).subscribe({
      next: (rows: TrainerImportRowDto[]) => {
        this.loading = false;
        this.prefillFromImport(rows);
      },
      error: (err) => {
        console.error(err);
        this.toast.error('Erreur lors de la lecture du fichier.');
        this.loading = false;
      },
    });
  }

  private prefillFromImport(rows: TrainerImportRowDto[]): void {
    const groups = rows.map(() => this.newItemGroup());
    this.form.setControl('items', this.fb.array(groups));
    this.rowStates = rows.map(() => ({ status: 'idle' as const }));
    rows.forEach((row, i) => {
      this.items.at(i).patchValue({
        firstName:               row.firstName          ?? '',
        lastName:                row.lastName           ?? '',
        email:                   row.email              ?? '',
        phone:                   row.phone              ?? '',
        phytolicenceNumber:      row.phytolicenceNumber ?? '',
        trainingAccreditationIds: [],
        partnerOrganismIds:       [],
        comment:                 '',
      });
    });
  }

  // ─── Ajout / Suppression ──────────────────────────────────

  addItem(): void {
    this.items.push(this.newItemGroup());
    this.rowStates.push({ status: 'idle' });
    this.accreditationSearch.push('');
    this.organismSearch.push('');
  }

  removeItem(index: number): void {
    if (this.items.length <= 1) return;
    this.items.removeAt(index);
    this.rowStates.splice(index, 1);
    this.accreditationSearch.splice(index, 1);
    this.organismSearch.splice(index, 1);
  }

  // ─── Toggle agrément formation ────────────────────────────

  isAccreditationSelected(i: number, id: number): boolean {
    const val: number[] = this.items.at(i).get('trainingAccreditationIds')?.value ?? [];
    return val.includes(id);
  }

  toggleAccreditation(i: number, id: number): void {
    const ctrl = this.items.at(i).get('trainingAccreditationIds');
    if (!ctrl) return;
    const current: number[] = ctrl.value ?? [];
    ctrl.setValue(current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  }

  // ─── Toggle organisme ─────────────────────────────────────

  isOrganismSelected(i: number, id: number): boolean {
    const val: number[] = this.items.at(i).get('partnerOrganismIds')?.value ?? [];
    return val.includes(id);
  }

  toggleOrganism(i: number, id: number): void {
    const ctrl = this.items.at(i).get('partnerOrganismIds');
    if (!ctrl) return;
    const current: number[] = ctrl.value ?? [];
    ctrl.setValue(current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
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
          this.error = "Certain(e)s formateur·trices n'ont pas pu être créé(e)s. Corrige les lignes en erreur.";
          return;
        }
        if (mode === 'back') {
          this.toast.success('Formateur(trice)(s) créé(e)(s).');
          this.router.navigateByUrl('/trainers');
          return;
        }
        this.form.setControl('items', this.fb.array([this.newItemGroup()]));
        this.rowStates = [{ status: 'idle' }];
        this.error = null;
      })
      .catch(() => {
        this.loading = false;
        this.error   = 'Une erreur inattendue est survenue.';
      });
  }

  // ─── Format téléphone belge ───────────────────────────────

  onPhoneBlur(event: Event, ctrl: AbstractControl | null): void {
    if (!ctrl) return;
    const input = event.target as HTMLInputElement;
    const formatted = this.formatBelgianPhone(input.value);
    ctrl.setValue(formatted, { emitEvent: false });
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

  onPhytolicenceInput(event: Event, ctrl: AbstractControl | null): void {
    if (!ctrl) return;
    const input = event.target as HTMLInputElement;
    const formatted = this.formatPhytolicence(input.value);
    input.value = formatted;
    ctrl.setValue(formatted, { emitEvent: false });
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
