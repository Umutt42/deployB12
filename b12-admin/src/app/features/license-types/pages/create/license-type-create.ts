import { Component, OnInit, ViewChild, ElementRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { LicenseTypeApi, ImportRowDto } from '../../api/license-type.api';
import { LicenseType } from '../../models/license-type.model';
import { ToastService } from '../../../../shared/toast/toast.service';

type RowState = {
  status: 'idle' | 'saving' | 'success' | 'error';
  error?: string | null;
};

@Component({
  selector: 'app-license-type-create',
  standalone: true,
  imports: [...SHARED_IMPORTS, ReactiveFormsModule],
  templateUrl: './license-type-create.html',
  styleUrl: './license-type-create.css',
})
export class LicenseTypeCreate implements OnInit {
  private api = inject(LicenseTypeApi);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);

  loading = false;
  error: string | null = null;

  @ViewChild('importInput') importInputRef!: ElementRef<HTMLInputElement>;

  // ===== Autocomplete codes (global) =====
  private allCodes: string[] = [];
  codeSuggestions: string[] = [];
  showCodeSuggestions = false;
  activeRowIndex: number | null = null;

  // ===== Etat par ligne =====
  rowStates: RowState[] = [];

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
    // charge codes existants pour suggestions
    this.api.findAll(undefined).subscribe({
      next: (data: LicenseType[]) => {
        const codes = (data ?? [])
          .map((x) => (x.code ?? '').trim())
          .filter(Boolean);

        this.allCodes = Array.from(new Set(codes)).sort((a, b) =>
          a.localeCompare(b)
        );
      },
      error: () => {
        this.allCodes = [];
      },
    });

    this.rowStates = [{ status: 'idle', error: null }];

    // ✅ IMPORT: pré-remplir depuis le state de navigation
    const navState = window.history.state as { importItems?: { code: string; label: string; description: string | null }[] };
    if (navState?.importItems?.length) {
      this.prefillFromImport(navState.importItems);
      return;
    }

    // ✅ DUPLICATION: pré-remplir via cloneId
    const cloneIdRaw = this.route.snapshot.queryParamMap.get('cloneId');
    const cloneId = cloneIdRaw ? Number(cloneIdRaw) : null;

    if (cloneId && !Number.isNaN(cloneId)) {
      this.loading = true;

      this.api
        .get(cloneId)
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: (lt: LicenseType) => this.prefillFromClone(lt),
          error: () => {
            this.error = "Impossible de dupliquer : élément introuvable ou erreur serveur.";
          },
        });
    }
  }

  private newItemGroup() {
    return this.fb.group({
      code: ['', [Validators.required, Validators.maxLength(20)]],
      label: ['', [Validators.required, Validators.maxLength(120)]],
      description: ['', [Validators.maxLength(500)]],
    });
  }

  // ✅ Pré-remplit le formulaire depuis un import de fichier
  private prefillFromImport(items: { code: string; label: string; description: string | null }[]) {
    const groups = items.map(() => this.newItemGroup());
    this.form.setControl('items', this.fb.array(groups));
    this.rowStates = items.map(() => ({ status: 'idle' as const, error: null }));
    items.forEach((item, i) => {
      this.items.at(i).patchValue({
        code: item.code ?? '',
        label: item.label ?? '',
        description: item.description ?? '',
      });
    });
  }

  // ✅ Applique les valeurs du clone dans le formulaire
  private prefillFromClone(lt: LicenseType) {
    // on repart sur 1 seule ligne
    this.form.setControl('items', this.fb.array([this.newItemGroup()]));
    this.rowStates = [{ status: 'idle', error: null }];
    this.activeRowIndex = 0;

    this.items.at(0).patchValue({
      code: '', // ⚠️ on force un nouveau code (unique)
      label: (lt.label ?? '').toString().trim(),
      description: (lt.description ?? '').toString(),
    });

    this.error = 'Type dupliqué : définis un nouveau code puis enregistre.';
  }

  handleImport(format: 'csv' | 'xlsx') {
    const input = this.importInputRef.nativeElement;
    input.accept = format === 'csv' ? '.csv' : '.xlsx,.xls';
    input.value = '';
    input.click();
  }

  onImportFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.loading = true;
    this.api.previewImport(file).subscribe({
      next: (rows: ImportRowDto[]) => {
        this.loading = false;
        this.prefillFromImport(rows);
      },
      error: () => {
        this.loading = false;
        this.error = 'Erreur lors de la lecture du fichier.';
      },
    });
  }

  addItem(): void {
    this.items.push(this.newItemGroup());
    this.rowStates.push({ status: 'idle', error: null });
  }

  removeItem(index: number): void {
    if (this.items.length <= 1) return;
    this.items.removeAt(index);
    this.rowStates.splice(index, 1);

    if (this.activeRowIndex === index) {
      this.activeRowIndex = null;
      this.showCodeSuggestions = false;
      this.codeSuggestions = [];
    } else if (this.activeRowIndex !== null && this.activeRowIndex > index) {
      this.activeRowIndex--;
    }
  }

  // ===== Autocomplete par ligne =====
  onCodeChange(index: number) {
    this.activeRowIndex = index;
    const v = (this.items.at(index).get('code')?.value ?? '').toString();
    this.refreshCodeSuggestions(v);
  }

  onCodeFocus(index: number) {
    this.activeRowIndex = index;
    this.showCodeSuggestions = true;

    const current = (this.items.at(index).get('code')?.value ?? '').toString();
    this.refreshCodeSuggestions(current);
  }

  onCodeBlur() {
    setTimeout(() => (this.showCodeSuggestions = false), 150);
  }

  pickCode(v: string) {
    if (this.activeRowIndex === null) return;
    this.items.at(this.activeRowIndex).get('code')?.setValue(v);
    this.showCodeSuggestions = false;
    this.codeSuggestions = [];
  }

  private refreshCodeSuggestions(raw: string) {
    const q = (raw ?? '').trim().toLowerCase();
    if (!q) {
      this.codeSuggestions = [];
      return;
    }

    this.codeSuggestions = this.allCodes
      .filter((c) => c.toLowerCase().startsWith(q))
      .filter((c) => c.toLowerCase() !== q)
      .slice(0, 8);
  }

  // ===== Submit batch séquentiel (continue même si erreur) =====
  submitAll(mode: 'back' | 'stay' = 'back'): void {
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
        const g = this.items.at(i);

        const code = (g.get('code')?.value ?? '').toString().trim();
        const label = (g.get('label')?.value ?? '').toString().trim();
        const descRaw = (g.get('description')?.value ?? '').toString().trim();

        const payload = {
          code,
          label,
          description: descRaw ? descRaw : null,
        };

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
                const msg =
                  err?.error?.message ||
                  err?.error?.error ||
                  'Création impossible (code déjà existant ?).';

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
            'Certains types n’ont pas pu être créés. Corrige les lignes en erreur et relance.';
          return;
        }

        if (mode === 'back') {
          this.toast.success('Type(s) de phytolicence créé(s).');
          this.router.navigateByUrl('/license-types');
          return;
        }

        // stay: reset
        this.form.setControl('items', this.fb.array([this.newItemGroup()]));
        this.rowStates = [{ status: 'idle', error: null }];
        this.activeRowIndex = null;
        this.showCodeSuggestions = false;
        this.codeSuggestions = [];
        this.error = null;
      })
      .catch(() => {
        this.loading = false;
        this.error = 'Une erreur inattendue est survenue.';
      });
  }
}
