import { Component, OnInit, inject } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { UserAdminApi } from '../../api/user-admin.api';
import { Role } from '../../models/user.models';
import { ToastService } from '../../../../shared/toast/toast.service';

type RowState = {
  status: 'idle' | 'saving' | 'success' | 'error';
  error?: string | null;
};

function emailValidator(control: AbstractControl): ValidationErrors | null {
  const v = (control.value ?? '').toString().trim();
  if (!v) return null; // required géré ailleurs
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  return ok ? null : { email: true };
}

@Component({
  selector: 'app-user-create',
  standalone: true,
  imports: [...SHARED_IMPORTS, ReactiveFormsModule],
  templateUrl: './user-create.html',
  styleUrls: ['./user-create.css'],
})
export class UserCreate implements OnInit {
  private api = inject(UserAdminApi);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);

  loading = false;
  error: string | null = null;

  rowStates: RowState[] = [];
  showPasswordByRow: boolean[] = [];

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

  ngOnInit(): void {
    this.rowStates = [{ status: 'idle', error: null }];
    this.showPasswordByRow = [false];
  }

  private newItemGroup() {
    return this.fb.group({
      email: ['', [Validators.required, Validators.maxLength(160), emailValidator]],
      role: ['USER' as Role, [Validators.required]],
      tempPassword: ['123456789', [Validators.required, Validators.minLength(6), Validators.maxLength(120)]],
    });
  }

  addItem(): void {
    this.items.push(this.newItemGroup());
    this.rowStates.push({ status: 'idle', error: null });
    this.showPasswordByRow.push(false);
  }

  removeItem(index: number): void {
    if (this.items.length <= 1) return;
    this.items.removeAt(index);
    this.rowStates.splice(index, 1);
    this.showPasswordByRow.splice(index, 1);
  }

  togglePassword(index: number): void {
    this.showPasswordByRow[index] = !this.showPasswordByRow[index];
  }

  private buildPayload(i: number) {
    const g = this.items.at(i);

    const email = (g.get('email')?.value ?? '').toString().trim();
    const role = g.get('role')?.value as Role;
    const tempPassword = (g.get('tempPassword')?.value ?? '').toString().trim();

    return { email, role, tempPassword };
  }

  // ===== Submit batch séquentiel (continue même si erreur) =====
  submitAll(mode: 'back' | 'stay' = 'back'): void {
    if (this.loading) return;

    this.error = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error = 'Veuillez corriger les champs obligatoires.';
      return;
    }

    // reset states
    this.rowStates = this.rowStates.map((s) =>
      s.status === 'success' ? s : { status: 'idle' as const, error: null }
    );
    this.loading = true;

    const run = async () => {
      for (let i = 0; i < this.items.length; i++) {
        if (this.rowStates[i]?.status === 'success') continue;
        const payload = this.buildPayload(i);

        this.rowStates[i] = { status: 'saving', error: null };

        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((resolve) => {
          this.api
            .create(payload)
            .pipe(finalize(() => resolve()))
            .subscribe({
              next: () => {
                this.rowStates[i] = { status: 'success', error: null };
              },
              error: (err) => {
                const fieldErrors = err?.error?.fieldErrors;

                if (fieldErrors && typeof fieldErrors === 'object') {
                  const msg = Object.entries(fieldErrors)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' | ');
                  this.rowStates[i] = { status: 'error', error: msg };
                  return;
                }

                const msg =
                  err?.error?.message ||
                  'Création impossible (email déjà utilisé ou erreur serveur).';

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
          this.error =
            "Certains utilisateurs n’ont pas pu être créés. Corrige les lignes en erreur et relance.";
          return;
        }

        // ✅ tout OK
        if (mode === 'back') {
          this.toast.success('Utilisateur(s) créé(s).');
          this.router.navigateByUrl('/users');
          return;
        }

        // stay: reset
        this.form.setControl('items', this.fb.array([this.newItemGroup()]));
        this.rowStates = [{ status: 'idle', error: null }];
        this.showPasswordByRow = [false];
        this.error = null;
      })
      .catch(() => {
        this.loading = false;
        this.error = 'Une erreur inattendue est survenue.';
      });
  }
}
