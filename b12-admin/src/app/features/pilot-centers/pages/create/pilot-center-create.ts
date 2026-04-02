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

import { PilotCenterApi, PilotCenterDto, PilotCenterImportRowDto } from '../../api/pilot-center.api';
import { SectorApi, SectorDto } from '../../../sectors/api/sector.api';
import { OrganismApi, OrganismDto } from '../../../organisms/api/organism.api';
import { ToastService } from '../../../../shared/toast/toast.service';

type RowState = {
  status: 'idle' | 'saving' | 'success' | 'error';
  error?: string | null;
};

@Component({
  selector: 'app-pilot-center-create',
  standalone: true,
  imports: [...SHARED_IMPORTS, ReactiveFormsModule],
  templateUrl: './pilot-center-create.html',
  styleUrl: './pilot-center-create.css',
})
export class PilotCenterCreate implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(PilotCenterApi);
  private sectorApi = inject(SectorApi);
  private organismApi = inject(OrganismApi);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  sectors: SectorDto[] = [];
  organisms: OrganismDto[] = [];

  sectorSearch:   string[] = [''];
  organismSearch: string[] = [''];

  filteredSectorsFor(i: number): SectorDto[] {
    const q = (this.sectorSearch[i] ?? '').toLowerCase().trim();
    if (!q) return this.sectors;
    return this.sectors.filter(s => (s.name ?? '').toLowerCase().includes(q));
  }

  filteredOrganismsFor(i: number): OrganismDto[] {
    const q = (this.organismSearch[i] ?? '').toLowerCase().trim();
    if (!q) return this.organisms;
    return this.organisms.filter(o => (o.name ?? '').toLowerCase().includes(q));
  }

  loading = false;
  error: string | null = null;

  rowStates: RowState[] = [{ status: 'idle' }];

  // ===== Autocomplete nom =====
  private allNames: string[] = [];
  nameSuggestions: string[] = [];
  showNameSuggestions = false;

  // ===== Autocomplete groupe =====
  private allGroups: string[] = [];
  groupSuggestions: string[] = [];
  showGroupSuggestions = false;

  activeRowIndex: number | null = null;
  activeField: 'name' | 'cpGroup' | null = null;

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
    this.organismApi.findAll().subscribe({ next: (x) => (this.organisms = (x ?? []).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))) });

    this.api.findAll().subscribe({
      next: (data: PilotCenterDto[]) => {
        const names = (data ?? []).map((x) => (x.name ?? '').trim()).filter(Boolean);
        this.allNames = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));

        const groups = (data ?? []).map((x) => (x.cpGroup ?? '').trim()).filter(Boolean);
        this.allGroups = Array.from(new Set(groups)).sort((a, b) => a.localeCompare(b));
      },
      error: () => {
        this.allNames = [];
        this.allGroups = [];
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
          next: (pc: PilotCenterDto) => this.prefillFromClone(pc),
          error: () => {
            this.error = 'Impossible de dupliquer : élément introuvable.';
          },
        });
    }
  }

  private newItemGroup() {
    return this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(180)]],
      cpGroup: ['', [Validators.maxLength(120)]],
      description: ['', [Validators.maxLength(500)]],
      sectorIds: [[] as number[]],
      organismIds: [[] as number[]],
    });
  }

  private prefillFromClone(pc: PilotCenterDto) {
    this.form.setControl('items', this.fb.array([this.newItemGroup()]));
    this.rowStates = [{ status: 'idle' }];
    this.items.at(0).patchValue({
      name: '',
      cpGroup: pc.cpGroup ?? '',
      description: pc.description ?? '',
      sectorIds: Array.isArray(pc.sectorIds) ? pc.sectorIds : [],
      organismIds: Array.isArray(pc.organismIds) ? pc.organismIds : [],
    });
    this.error = 'Centre pilote dupliqué : définis un nouveau nom puis enregistre.';
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
      next: (rows: PilotCenterImportRowDto[]) => {
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

  private prefillFromImport(items: PilotCenterImportRowDto[]) {
    const groups = items.map(() => this.newItemGroup());
    this.form.setControl('items', this.fb.array(groups));
    this.rowStates = items.map(() => ({ status: 'idle' as const }));
    items.forEach((item, i) => {
      this.items.at(i).patchValue({
        name: item.name ?? '',
        cpGroup: item.cpGroup ?? '',
        description: item.description ?? '',
        sectorIds: [],
        organismIds: [],
      });
    });
  }

  addItem(): void {
    this.items.push(this.newItemGroup());
    this.rowStates.push({ status: 'idle' });
    this.sectorSearch.push('');
    this.organismSearch.push('');
  }

  removeItem(index: number): void {
    if (this.items.length <= 1) return;
    this.items.removeAt(index);
    this.rowStates.splice(index, 1);
    this.sectorSearch.splice(index, 1);
    this.organismSearch.splice(index, 1);
  }

  toggleMultiItem(id: number, index: number, key: 'sectorIds' | 'organismIds') {
    const ctrl = this.items.at(index).get(key);
    const current: number[] = ctrl?.value ?? [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    ctrl?.setValue(next);
  }

  // ===== Autocomplete : nom =====
  onNameChange(index: number) {
    this.activeRowIndex = index;
    this.activeField = 'name';
    const v = (this.items.at(index).get('name')?.value ?? '').toString();
    this.refreshNameSuggestions(v);
  }

  onNameFocus(index: number) {
    this.activeRowIndex = index;
    this.activeField = 'name';
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

  // ===== Autocomplete : groupe =====
  onGroupChange(index: number) {
    this.activeRowIndex = index;
    this.activeField = 'cpGroup';
    const v = (this.items.at(index).get('cpGroup')?.value ?? '').toString();
    this.refreshGroupSuggestions(v);
  }

  onGroupFocus(index: number) {
    this.activeRowIndex = index;
    this.activeField = 'cpGroup';
    this.showGroupSuggestions = true;
    const current = (this.items.at(index).get('cpGroup')?.value ?? '').toString();
    this.refreshGroupSuggestions(current);
  }

  onGroupBlur() {
    setTimeout(() => (this.showGroupSuggestions = false), 150);
  }

  pickGroup(v: string) {
    if (this.activeRowIndex === null) return;
    this.items.at(this.activeRowIndex).get('cpGroup')?.setValue(v);
    this.showGroupSuggestions = false;
    this.groupSuggestions = [];
  }

  private refreshGroupSuggestions(raw: string) {
    const q = (raw ?? '').trim().toLowerCase();
    if (!q) { this.groupSuggestions = []; return; }
    this.groupSuggestions = this.allGroups
      .filter((g) => g.toLowerCase().startsWith(q))
      .filter((g) => g.toLowerCase() !== q)
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
          cpGroup: (g.get('cpGroup')?.value ?? '').trim() || null,
          description: (g.get('description')?.value ?? '').trim() || null,
          sectorIds: g.get('sectorIds')?.value ?? [],
          organismIds: g.get('organismIds')?.value ?? [],
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
          this.error = "Certains centres n'ont pas pu être créés. Corrige les lignes en erreur.";
          return;
        }
        if (mode === 'back') {
          this.toast.success('Centre(s) pilote(s) créé(s).');
          this.router.navigateByUrl('/pilot-centers');
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
