import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormArray,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { SectorApi, SectorDto, SectorImportRowDto } from '../../api/sector.api';
import { OrganismApi, OrganismDto } from '../../../organisms/api/organism.api';
import { PilotCenterApi, PilotCenterDto } from '../../../pilot-centers/api/pilot-center.api';
import { ToastService } from '../../../../shared/toast/toast.service';

type RowState = {
  status: 'idle' | 'saving' | 'success' | 'error';
  error?: string | null;
};

@Component({
  standalone: true,
  selector: 'app-sector-create',
  imports: [...SHARED_IMPORTS, ReactiveFormsModule],
  templateUrl: './sector-create.html',
  styleUrl: './sector-create.css',
})
export class SectorCreate implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(SectorApi);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private organismApi = inject(OrganismApi);
  private pilotCenterApi = inject(PilotCenterApi);
  private toast = inject(ToastService);

  organisms: OrganismDto[] = [];
  pilotCenters: PilotCenterDto[] = [];

  organismSearch:    string[] = [''];
  pilotCenterSearch: string[] = [''];

  filteredOrganismsFor(i: number): OrganismDto[] {
    const q = (this.organismSearch[i] ?? '').toLowerCase().trim();
    if (!q) return this.organisms;
    return this.organisms.filter(o => (o.name ?? '').toLowerCase().includes(q));
  }

  filteredPilotCentersFor(i: number): PilotCenterDto[] {
    const q = (this.pilotCenterSearch[i] ?? '').toLowerCase().trim();
    if (!q) return this.pilotCenters;
    return this.pilotCenters.filter(pc => (pc.name ?? '').toLowerCase().includes(q));
  }

  loading = false;
  error: string | null = null;

  rowStates: RowState[] = [{ status: 'idle' }];

  // ===== Autocomplete nom =====
  private allNames: string[] = [];
  nameSuggestions: string[] = [];
  showNameSuggestions = false;
  activeRowIndex: number | null = null;

  @ViewChild('importInput') importInputRef!: ElementRef<HTMLInputElement>;

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
    forkJoin({
      organisms:    this.organismApi.findAll(),
      pilotCenters: this.pilotCenterApi.findAll(),
    }).subscribe({
      next: ({ organisms, pilotCenters }) => {
        this.organisms    = (organisms    ?? []).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
        this.pilotCenters = (pilotCenters ?? []).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
      },
    });

    this.api.findAll().subscribe({
      next: (data: SectorDto[]) => {
        const names = (data ?? []).map((x) => (x.name ?? '').trim()).filter(Boolean);
        this.allNames = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
      },
      error: () => { this.allNames = []; },
    });

    const cloneIdRaw = this.route.snapshot.queryParamMap.get('cloneId');
    const cloneId = cloneIdRaw ? Number(cloneIdRaw) : null;

    if (cloneId && !Number.isNaN(cloneId)) {
      this.loading = true;
      this.api
        .get(cloneId)
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: (s: SectorDto) => this.prefillFromClone(s),
          error: () => {
            this.error = 'Impossible de dupliquer : élément introuvable.';
          },
        });
    }
  }

  private newItemGroup() {
    return this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(120)]],
      description: ['', [Validators.maxLength(500)]],
      organismIds: [[] as number[]],
      pilotCenterIds: [[] as number[]],
    });
  }

  private prefillFromClone(s: SectorDto) {
    this.form.setControl('items', this.fb.array([this.newItemGroup()]));
    this.rowStates = [{ status: 'idle' }];
    this.items.at(0).patchValue({
      name: '',
      description: s.description ?? '',
      organismIds: Array.isArray(s.organismIds) ? s.organismIds : [],
      pilotCenterIds: Array.isArray(s.pilotCenterIds) ? s.pilotCenterIds : [],
    });
    this.error = 'Secteur dupliqué : définis un nouveau nom puis enregistre.';
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
      next: (rows: SectorImportRowDto[]) => {
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

  private prefillFromImport(items: SectorImportRowDto[]) {
    const groups = items.map(() => this.newItemGroup());
    this.form.setControl('items', this.fb.array(groups));
    this.rowStates = items.map(() => ({ status: 'idle' as const }));
    items.forEach((item, i) => {
      this.items.at(i).patchValue({
        name: item.name ?? '',
        description: item.description ?? '',
        organismIds: [],
        pilotCenterIds: [],
      });
    });
  }

  addItem(): void {
    this.items.push(this.newItemGroup());
    this.rowStates.push({ status: 'idle' });
    this.organismSearch.push('');
    this.pilotCenterSearch.push('');
  }

  removeItem(index: number): void {
    if (this.items.length <= 1) return;
    this.items.removeAt(index);
    this.rowStates.splice(index, 1);
    this.organismSearch.splice(index, 1);
    this.pilotCenterSearch.splice(index, 1);
  }

  toggleMultiItem(id: number, index: number, key: 'organismIds' | 'pilotCenterIds') {
    const ctrl = this.items.at(index).get(key);
    const current: number[] = ctrl?.value ?? [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    ctrl?.setValue(next);
  }

  // ===== Autocomplete : nom =====
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
    if (!q) { this.nameSuggestions = []; return; }
    this.nameSuggestions = this.allNames
      .filter((n) => n.toLowerCase().startsWith(q))
      .filter((n) => n.toLowerCase() !== q)
      .slice(0, 8);
  }

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
    this.loading = true;

    const run = async () => {
      for (let i = 0; i < this.items.length; i++) {
        if (this.rowStates[i]?.status === 'success') continue;
        const g = this.items.at(i);
        this.rowStates[i] = { status: 'saving' };

        const dto = {
          name: (g.get('name')?.value ?? '').trim(),
          description: (g.get('description')?.value ?? '').trim() || null,
          organismIds: g.get('organismIds')?.value ?? [],
          pilotCenterIds: g.get('pilotCenterIds')?.value ?? [],
        };

        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((resolve) => {
          this.api
            .create(dto as any)
            .pipe(finalize(() => resolve()))
            .subscribe({
              next: () => {
                this.rowStates[i] = { status: 'success' };
              },
              error: (err) => {
                const msg =
                  err?.error?.message || err?.error?.error || 'Création impossible.';
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
          this.error = "Certains secteurs n'ont pas pu être créés. Corrige les lignes en erreur.";
          return;
        }
        if (mode === 'back') {
          this.toast.success('Secteur(s) créé(s).');
          this.router.navigateByUrl('/sectors');
          return;
        }
        this.form.setControl('items', this.fb.array([this.newItemGroup()]));
        this.rowStates = [{ status: 'idle' }];
        this.error = null;
      })
      .catch(() => {
        this.loading = false;
        this.error = 'Une erreur inattendue est survenue.';
      });
  }

}
