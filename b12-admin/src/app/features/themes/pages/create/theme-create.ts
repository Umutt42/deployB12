import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { ThemeApi } from '../../api/theme.api';
import { Theme } from '../../models/theme.model';

type RowState = {
  status: 'idle' | 'saving' | 'success' | 'error';
  error?: string | null;
};

@Component({
  selector: 'app-theme-create',
  standalone: true,
  imports: [...SHARED_IMPORTS, ReactiveFormsModule],
  templateUrl: './theme-create.html',
  styleUrl: './theme-create.css',
})
export class ThemeCreate implements OnInit {
  private api = inject(ThemeApi);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  loading = false;
  error: string | null = null;

  // ===== Autocomplete noms (global) =====
  private allNames: string[] = [];
  nameSuggestions: string[] = [];
  showNameSuggestions = false;
  activeRowIndex: number | null = null;

  // ===== Etat par ligne =====
  rowStates: RowState[] = [];

  // ===== Dernier thème créé (pour proposer sous-thèmes) =====
  lastCreatedTheme: Theme | null = null;
  showPostCreatePanel = false;

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
    this.api.findAll().subscribe({
      next: (data: Theme[]) => {
        const names = (data ?? [])
          .map((x) => ((x as any).name ?? '').trim())
          .filter(Boolean);

        this.allNames = Array.from(new Set(names)).sort((a, b) =>
          a.localeCompare(b)
        );
      },
      error: () => {
        this.allNames = [];
      },
    });

    this.rowStates = [{ status: 'idle', error: null }];

    // ✅ DUPLICATION: pré-remplir via cloneId
    const cloneIdRaw = this.route.snapshot.queryParamMap.get('cloneId');
    const cloneId = cloneIdRaw ? Number(cloneIdRaw) : null;

    if (cloneId && !Number.isNaN(cloneId)) {
      this.loading = true;

      this.api
        .get(cloneId)
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: (t: Theme) => this.prefillFromClone(t),
          error: () => {
            this.error = "Impossible de dupliquer : élément introuvable ou erreur serveur.";
          },
        });
    }
  }

  private newItemGroup() {
    return this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(120)]],
      description: ['', [Validators.maxLength(500)]],
    });
  }

  // ✅ Applique les valeurs du clone dans le formulaire
  private prefillFromClone(t: Theme) {
    // on repart sur 1 seule ligne
    this.form.setControl('items', this.fb.array([this.newItemGroup()]));
    this.rowStates = [{ status: 'idle', error: null }];
    this.activeRowIndex = 0;

    this.items.at(0).patchValue({
      name: '', // ⚠️ force un nouveau nom si unique
      description: ((t as any).description ?? '').toString(),
    });

    this.error = 'Thématique dupliquée : définis un nouveau nom puis enregistre.';
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
      this.showNameSuggestions = false;
      this.nameSuggestions = [];
    } else if (this.activeRowIndex !== null && this.activeRowIndex > index) {
      this.activeRowIndex--;
    }
  }

  // ===== Autocomplete par ligne =====
  onNameChange(index: number) {
    this.activeRowIndex = index;
    const v = (this.items.at(index).get('name')?.value ?? '').toString();
    this.refreshNameSuggestions(v);
  }

  onNameFocus(index: number) {
    this.activeRowIndex = index;
    this.showNameSuggestions = true;

    const current = (this.items.at(index).get('name')?.value ?? '').toString();
    this.refreshNameSuggestions(current);
  }

  onNameBlur() {
    setTimeout(() => (this.showNameSuggestions = false), 150);
  }

  pickName(v: string) {
    if (this.activeRowIndex === null) return;
    this.items.at(this.activeRowIndex).get('name')?.setValue(v);
    this.showNameSuggestions = false;
    this.nameSuggestions = [];
  }

  private refreshNameSuggestions(raw: string) {
    const q = (raw ?? '').trim().toLowerCase();
    if (!q) {
      this.nameSuggestions = [];
      return;
    }

    this.nameSuggestions = this.allNames
      .filter((n) => n.toLowerCase().startsWith(q))
      .filter((n) => n.toLowerCase() !== q)
      .slice(0, 8);
  }

  // ===== Post-create panel actions =====
  closePostCreatePanel() {
    this.showPostCreatePanel = false;
  }

  goToDetailLast() {
    const id = (this.lastCreatedTheme as any)?.id;
    if (!id) return;
    this.router.navigateByUrl(`/thematics/${id}`);
  }

  goToAddSubThemeLast() {
    const id = (this.lastCreatedTheme as any)?.id;
    if (!id) return;
    this.router.navigateByUrl(`/thematics/${id}/sub-themes/new`);
  }

  goToList() {
    this.router.navigateByUrl('/thematics');
  }

  // ===== Submit batch séquentiel (continue même si erreur) =====
  submitAll(mode: 'back' | 'stay' = 'back'): void {
    this.error = null;
    this.showPostCreatePanel = false;
    this.lastCreatedTheme = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error = 'Veuillez corriger les champs obligatoires.';
      return;
    }

    this.rowStates = this.rowStates.map((s) =>
      s.status === 'success' ? s : { status: 'idle' as const, error: null }
    );
    this.loading = true;

    const run = async () => {
      for (let i = 0; i < this.items.length; i++) {
        if (this.rowStates[i]?.status === 'success') continue;
        const g = this.items.at(i);

        const name = (g.get('name')?.value ?? '').toString().trim();
        const descRaw = (g.get('description')?.value ?? '').toString().trim();

        const payload = {
          name,
          description: descRaw ? descRaw : null,
        };

        this.rowStates[i] = { status: 'saving', error: null };

        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((resolve) => {
          this.api
            .create(payload)
            .pipe(finalize(() => resolve()))
            .subscribe({
              next: (created: Theme) => {
                this.rowStates[i] = { status: 'success', error: null };
                this.lastCreatedTheme = created;
              },
              error: (err) => {
                const msg =
                  err?.error?.message ||
                  err?.error?.error ||
                  'Création impossible (nom déjà existant ?).';

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
            "Certaines thématiques n’ont pas pu être créées. Corrige les lignes en erreur et relance.";
          if (this.lastCreatedTheme) this.showPostCreatePanel = true;
          return;
        }

        if (mode === 'back') {
          this.showPostCreatePanel = true;
          return;
        }

        // mode === 'stay' : reset
        this.form.setControl('items', this.fb.array([this.newItemGroup()]));
        this.rowStates = [{ status: 'idle', error: null }];

        this.activeRowIndex = null;
        this.showNameSuggestions = false;
        this.nameSuggestions = [];

        if (this.lastCreatedTheme) this.showPostCreatePanel = true;
      })
      .catch(() => {
        this.loading = false;
        this.error = 'Une erreur inattendue est survenue.';
      });
  }
}
