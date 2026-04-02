import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormArray,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { OrganismApi, OrganismDto, OrganismImportRowDto } from '../../api/organism.api';
import { SectorApi, SectorDto } from '../../../sectors/api/sector.api';
import { PilotCenterApi, PilotCenterDto } from '../../../pilot-centers/api/pilot-center.api';
import { ToastService } from '../../../../shared/toast/toast.service';

type RowState = {
  status: 'idle' | 'saving' | 'success' | 'error';
  error?: string | null;
};

@Component({
  selector: 'app-organism-create',
  standalone: true,
  imports: [...SHARED_IMPORTS, ReactiveFormsModule],
  templateUrl: './organism-create.html',
  styleUrl: './organism-create.css',
})
export class OrganismCreate implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(OrganismApi);
  private sectorApi = inject(SectorApi);
  private pilotCenterApi = inject(PilotCenterApi);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  sectors: SectorDto[] = [];
  pilotCenters: PilotCenterDto[] = [];

  sectorSearch:      string[] = [''];
  pilotCenterSearch: string[] = [''];

  filteredSectorsFor(i: number): SectorDto[] {
    const q = (this.sectorSearch[i] ?? '').toLowerCase().trim();
    if (!q) return this.sectors;
    return this.sectors.filter(s => (s.name ?? '').toLowerCase().includes(q));
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

  // ===== Autocomplete abréviation =====
  private allAbbreviations: string[] = [];
  abbreviationSuggestions: string[] = [];
  showAbbreviationSuggestions = false;

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
    this.sectorApi.findAll().subscribe({ next: (x) => (this.sectors = (x ?? []).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))) });
    this.pilotCenterApi.findAll().subscribe({ next: (x) => (this.pilotCenters = (x ?? []).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))) });

    this.api.findAll().subscribe({
      next: (data: OrganismDto[]) => {
        const names = (data ?? []).map((x) => (x.name ?? '').trim()).filter(Boolean);
        this.allNames = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));

        const abbrs = (data ?? []).map((x) => (x.abbreviation ?? '').trim()).filter(Boolean);
        this.allAbbreviations = Array.from(new Set(abbrs)).sort((a, b) => a.localeCompare(b));
      },
      error: () => {
        this.allNames = [];
        this.allAbbreviations = [];
      },
    });

    const cloneIdRaw = this.route.snapshot.queryParamMap.get('cloneId');
    const cloneId = cloneIdRaw ? Number(cloneIdRaw) : null;

    if (cloneId && !Number.isNaN(cloneId)) {
      this.loading = true;
      this.api
        .get(cloneId)
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: (o: OrganismDto) => this.prefillFromClone(o),
          error: () => {
            this.error = 'Impossible de dupliquer : élément introuvable.';
          },
        });
    }
  }

  private newItemGroup() {
    return this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(180)]],
      abbreviation: ['', [Validators.maxLength(30)]],
      sectorIds: [[] as number[]],
      pilotCenterIds: [[] as number[]],
    });
  }

  private prefillFromClone(o: OrganismDto) {
    this.form.setControl('items', this.fb.array([this.newItemGroup()]));
    this.rowStates = [{ status: 'idle' }];
    this.items.at(0).patchValue({
      name: '',
      abbreviation: o.abbreviation ?? '',
      sectorIds: Array.isArray(o.sectorIds) ? o.sectorIds : [],
      pilotCenterIds: Array.isArray(o.pilotCenterIds) ? o.pilotCenterIds : [],
    });
    this.error = 'Organisme dupliqué : définis un nouveau nom puis enregistre.';
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
      next: (rows: OrganismImportRowDto[]) => {
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

  private prefillFromImport(items: OrganismImportRowDto[]) {
    const groups = items.map(() => this.newItemGroup());
    this.form.setControl('items', this.fb.array(groups));
    this.rowStates = items.map(() => ({ status: 'idle' as const }));
    items.forEach((item, i) => {
      this.items.at(i).patchValue({
        name: item.name ?? '',
        abbreviation: item.abbreviation ?? '',
        sectorIds: [],
        pilotCenterIds: [],
      });
    });
  }

  addItem(): void {
    this.items.push(this.newItemGroup());
    this.rowStates.push({ status: 'idle' });
    this.sectorSearch.push('');
    this.pilotCenterSearch.push('');
  }

  removeItem(index: number): void {
    if (this.items.length <= 1) return;
    this.items.removeAt(index);
    this.rowStates.splice(index, 1);
    this.sectorSearch.splice(index, 1);
    this.pilotCenterSearch.splice(index, 1);
  }

  toggleMultiItem(id: number, index: number, key: 'sectorIds' | 'pilotCenterIds') {
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

  // ===== Autocomplete : abréviation =====
  onAbbreviationChange(index: number) {
    this.activeRowIndex = index;
    const v = (this.items.at(index).get('abbreviation')?.value ?? '').toString();
    this.refreshAbbreviationSuggestions(v);
  }

  onAbbreviationFocus(index: number) {
    this.activeRowIndex = index;
    this.showAbbreviationSuggestions = true;
    const current = (this.items.at(index).get('abbreviation')?.value ?? '').toString();
    this.refreshAbbreviationSuggestions(current);
  }

  onAbbreviationBlur() {
    setTimeout(() => (this.showAbbreviationSuggestions = false), 150);
  }

  pickAbbreviation(v: string) {
    if (this.activeRowIndex === null) return;
    this.items.at(this.activeRowIndex).get('abbreviation')?.setValue(v);
    this.showAbbreviationSuggestions = false;
    this.abbreviationSuggestions = [];
  }

  private refreshAbbreviationSuggestions(raw: string) {
    const q = (raw ?? '').trim().toLowerCase();
    if (!q) { this.abbreviationSuggestions = []; return; }
    this.abbreviationSuggestions = this.allAbbreviations
      .filter((a) => a.toLowerCase().startsWith(q))
      .filter((a) => a.toLowerCase() !== q)
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
          abbreviation: (g.get('abbreviation')?.value ?? '').trim() || null,
          sectorIds: g.get('sectorIds')?.value ?? [],
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
          this.error = "Certains organismes n'ont pas pu être créés. Corrige les lignes en erreur.";
          return;
        }
        if (mode === 'back') {
          this.toast.success('Organisme(s) créé(s).');
          this.router.navigateByUrl('/organisms');
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
