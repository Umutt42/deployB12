import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { TrainingActivityApi, TrainingActivityDto } from '../../api/training-activity.api';
import { getProvinceFromPostalCode } from '../../../../shared/utils/belgian-postal-code';
import { ToastService } from '../../../../shared/toast/toast.service';

type RowState = {
  status: 'idle' | 'saving' | 'success' | 'error';
  error?: string | null;
};

interface EligibleOption {
  id: number;
  label: string;
}

@Component({
  selector: 'app-training-activity-create',
  standalone: true,
  imports: [...SHARED_IMPORTS, ReactiveFormsModule],
  templateUrl: './training-activity-create.html',
  styleUrl: './training-activity-create.css',
})
export class TrainingActivityCreate implements OnInit {
  private fb     = inject(FormBuilder);
  private api    = inject(TrainingActivityApi);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private toast  = inject(ToastService);

  loading = false;
  error:   string | null = null;

  rowStates: RowState[] = [{ status: 'idle' }];

  /** Options TA éligibles par ligne (mis à jour quand startDate change) */
  eligibleOptionsPerItem: EligibleOption[][] = [[]];
  eligibleLoadingPerItem: boolean[] = [false];

  /** TA ID à restaurer après chargement des éligibles (utilisé lors d'un clonage) */
  private pendingCloneTaIds: (number | null)[] = [null];

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
  }

  ngOnInit(): void {
    this.bindStartDateListener(0);

    const cloneIdStr = this.route.snapshot.queryParamMap.get('cloneId');
    if (cloneIdStr) {
      this.api.get(parseInt(cloneIdStr, 10)).subscribe({
        next: (src) => {
          if (src.trainingAccreditationId != null) {
            this.pendingCloneTaIds[0] = src.trainingAccreditationId;
          }
          this.items.at(0).patchValue({
            startDate:            src.startDate            ?? '',
            endDate:              src.endDate              ?? '',
            numberOfParticipants: src.numberOfParticipants ?? null,
            online:               src.online               ?? false,
            memberPrice:          src.memberPrice          ?? 0,
            nonMemberPrice:       src.nonMemberPrice       ?? 0,
            phytodama:            src.phytodama            ?? false,
            street:               src.street               ?? '',
            number:               src.number               ?? '',
            postalCode:           src.postalCode           ?? '',
            ville:                src.ville                ?? '',
            province:             src.province             ?? '',
          });
        },
      });
    }
  }

  // ─── Ajout / Suppression d'activités ──────────────────────

  addItem(): void {
    this.items.push(this.newItemGroup());
    this.rowStates.push({ status: 'idle' });
    this.eligibleOptionsPerItem.push([]);
    this.eligibleLoadingPerItem.push(false);
    const i = this.items.length - 1;
    this.bindStartDateListener(i);
  }

  removeItem(index: number): void {
    if (this.items.length <= 1) return;
    this.items.removeAt(index);
    this.rowStates.splice(index, 1);
    this.eligibleOptionsPerItem.splice(index, 1);
    this.eligibleLoadingPerItem.splice(index, 1);
  }

  // ─── Rechargement des TA éligibles quand la date change ───

  private bindStartDateListener(i: number): void {
    const group     = this.items.at(i) as FormGroup;
    const startCtrl = group.get('startDate');
    const taCtrl    = group.get('trainingAccreditationId');

    if (!startCtrl) return;
    startCtrl.valueChanges.subscribe((iso: any) => {
      if (!iso) {
        this.eligibleOptionsPerItem[i] = [];
        taCtrl?.setValue(null, { emitEvent: false });
        return;
      }
      this.eligibleLoadingPerItem[i] = true;
      taCtrl?.setValue(null, { emitEvent: false });
      this.api.findEligible(String(iso)).subscribe({
        next: (dtos: TrainingActivityDto[]) => {
          this.eligibleOptionsPerItem[i] = dtos
            .filter(d => d.trainingAccreditationId != null)
            .map(d => {
              const centerPart = d.centerAccreditationLabel ?? '';
              const taPart = d.trainingAccreditationLabel ?? `#${d.trainingAccreditationId}`;
              return { id: d.trainingAccreditationId!, label: centerPart ? `${centerPart} — ${taPart}` : taPart };
            })
            .sort((a, b) => a.label.localeCompare(b.label));
          this.eligibleLoadingPerItem[i] = false;
          if (this.pendingCloneTaIds[i] != null) {
            taCtrl?.setValue(this.pendingCloneTaIds[i], { emitEvent: false });
            this.pendingCloneTaIds[i] = null;
          }
        },
        error: () => {
          this.eligibleOptionsPerItem[i] = [];
          this.eligibleLoadingPerItem[i] = false;
          this.pendingCloneTaIds[i] = null;
        },
      });
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
        };

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
          this.error = "Certaines activités n'ont pas pu être créées. Corrige les lignes en erreur.";
          return;
        }
        if (mode === 'back') {
          this.toast.success('Activité(s) de formation créée(s).');
          this.router.navigateByUrl('/training-activities');
          return;
        }
        this.form.setControl('items', this.fb.array([this.newItemGroup()]));
        this.rowStates              = [{ status: 'idle' }];
        this.eligibleOptionsPerItem = [[]];
        this.eligibleLoadingPerItem = [false];
        this.bindStartDateListener(0);
        this.error = null;
      })
      .catch(() => {
        this.loading = false;
        this.error   = 'Une erreur inattendue est survenue.';
      });
  }

  // ─── Auto-fill province depuis code postal ───────────────

  onPostalCodeInput(i: number): void {
    const cp       = this.items.at(i).get('postalCode')?.value ?? '';
    const province = getProvinceFromPostalCode(cp);
    if (province) {
      this.items.at(i).get('province')?.setValue(province, { emitEvent: false });
    }
  }

  private trimOrNull(v: unknown): string | null {
    const s = String(v ?? '').trim();
    return s.length ? s : null;
  }
}
