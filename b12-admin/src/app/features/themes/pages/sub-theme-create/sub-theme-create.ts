import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { SubThemeApi, SubThemeImportRowDto } from '../../api/sub-theme.api';
import { SubTheme } from '../../models/sub-theme.model';
import { ToastService } from '../../../../shared/toast/toast.service';

type RowState = {
  status: 'idle' | 'saving' | 'success' | 'error';
  error?: string | null;
};

@Component({
  selector: 'app-sub-theme-create',
  standalone: true,
  imports: [...SHARED_IMPORTS, ReactiveFormsModule],
  templateUrl: './sub-theme-create.html',
  styleUrl: './sub-theme-create.css',
})
export class SubThemeCreate implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(SubThemeApi);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);

  themeId!: number;

  loading = false;
  error: string | null = null;

  // ===== Autocomplete global, appliqué à la ligne active =====
  private allNames: string[] = [];
  nameSuggestions: string[] = [];
  showNameSuggestions = false;
  activeRowIndex: number | null = null;

  // ===== Import =====
  @ViewChild('importInput') importInputRef!: ElementRef<HTMLInputElement>;

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
    //this.themeId = Number(this.route.snapshot.paramMap.get('id'));
    this.themeId = Number(this.route.snapshot.paramMap.get('themeId'));

    if (this.themeId && !Number.isNaN(this.themeId)) {
      this.api.findByTheme(this.themeId).subscribe({
        next: (data: SubTheme[]) => {
          const names = (data ?? [])
            .map((x) => (x.name ?? '').trim())
            .filter(Boolean);

          this.allNames = Array.from(new Set(names)).sort((a, b) =>
            a.localeCompare(b)
          );
        },
        error: () => {
          this.allNames = [];
        },
      });
    }

    this.rowStates = [{ status: 'idle', error: null }];
  }

  private newItemGroup() {
    return this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(160)]],
      description: ['', [Validators.maxLength(600)]],
      hours: [null as number | null, [Validators.min(0)]],
    });
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
      next: (rows: SubThemeImportRowDto[]) => {
        this.loading = false;
        this.prefillFromImport(rows);
      },
      error: (err) => {
        console.error(err);
        this.toast.error("Erreur lors de la lecture du fichier.");
        this.loading = false;
      },
    });
  }

  private prefillFromImport(items: SubThemeImportRowDto[]) {
    const groups = items.map(() => this.newItemGroup());
    this.form.setControl('items', this.fb.array(groups));
    this.rowStates = items.map(() => ({ status: 'idle' as const, error: null }));
    items.forEach((item, i) => {
      this.items.at(i).patchValue({
        name: item.name ?? '',
        description: item.description ?? '',
        hours: item.hours ?? null,
      });
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
      this.showNameSuggestions = false;
      this.nameSuggestions = [];
    } else if (this.activeRowIndex !== null && this.activeRowIndex > index) {
      this.activeRowIndex--;
    }
  }

  // ===== Autocomplete (on lit la valeur du FormControl) =====
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

  // ===== Submit batch séquentiel (continue même si erreur) =====
  submitAll(mode: 'back' | 'stay' = 'back'): void {
    this.error = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error = 'Veuillez corriger les champs obligatoires.';
      return;
    }

    // reset row states
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
        const hours = g.get('hours')?.value as number | null;

        const payload = {
          name,
          description: descRaw ? descRaw : null,
          hours: hours ?? null,
          themeId: this.themeId,
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
                  'Création impossible (nom déjà existant pour ce thème ?).';

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
            'Certains sous-thèmes n’ont pas pu être créés. Corrige les lignes en erreur et relance.';
          return; // on reste sur la page
        }

        // ✅ Tout OK
        if (mode === 'back') {
          this.toast.success('Sous-thème(s) créé(s).');
          this.router.navigate(['/thematics', this.themeId]);
          return;
        }

        // mode === 'stay' : reset pour continuer
        this.form.setControl('items', this.fb.array([this.newItemGroup()]));
        this.rowStates = [{ status: 'idle', error: null }];

        this.activeRowIndex = null;
        this.showNameSuggestions = false;
        this.nameSuggestions = [];
        this.error = null;
      })
      .catch(() => {
        this.loading = false;
        this.error = 'Une erreur inattendue est survenue.';
      });
  }
}
