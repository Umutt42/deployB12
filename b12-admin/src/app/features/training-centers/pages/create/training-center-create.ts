import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { TrainingCenterApi, TrainingCenterDto } from '../../api/training-center.api';
import { getProvinceFromPostalCode } from '../../../../shared/utils/belgian-postal-code';
import { SectorApi, SectorDto } from '../../../sectors/api/sector.api';
import { PilotCenterApi, PilotCenterDto } from '../../../pilot-centers/api/pilot-center.api';
import { ToastService } from '../../../../shared/toast/toast.service';
import { ConfirmDialogService } from '../../../../shared/confirm-dialog/confirm-dialog.service';

type RowState = {
  status: 'idle' | 'saving' | 'success' | 'error';
  error?: string | null;
};

@Component({
  selector: 'app-training-center-create',
  standalone: true,
  imports: [...SHARED_IMPORTS, ReactiveFormsModule],
  templateUrl: './training-center-create.html',
  styleUrl: './training-center-create.css',
})
export class TrainingCenterCreate implements OnInit {
  private fb             = inject(FormBuilder);
  private api            = inject(TrainingCenterApi);
  private sectorApi      = inject(SectorApi);
  private pilotCenterApi = inject(PilotCenterApi);
  private router         = inject(Router);
  private route          = inject(ActivatedRoute);
  private toast          = inject(ToastService);
  private confirmDialog  = inject(ConfirmDialogService);

  sectors:      SectorDto[]      = [];
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
  error:   string | null = null;

  rowStates: RowState[]         = [{ status: 'idle' }];
  activeRowIndex: number | null = null;

  // ===== Données autocomplete =====
  private allNames:          string[] = [];
  private allCompanyNumbers: string[] = [];
  private allStreets:        string[] = [];
  private allHqNumbers:      string[] = [];
  private allPostalCodes:    string[] = [];
  private allCities:         string[] = [];

  nameSuggestions:          string[] = [];
  companyNumberSuggestions: string[] = [];
  streetSuggestions:        string[] = [];
  hqNumberSuggestions:      string[] = [];
  postalCodeSuggestions:    string[] = [];
  citySuggestions:          string[] = [];

  showNameSuggestions          = false;
  showCompanyNumberSuggestions = false;
  showStreetSuggestions        = false;
  showHqNumberSuggestions      = false;
  showPostalCodeSuggestions    = false;
  showCitySuggestions          = false;

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

  private newItemGroup() {
    return this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(180)]],
      companyNumber: [
        '',
        [
          Validators.required,
          Validators.maxLength(14),
          Validators.pattern(/^BE0\d{3}\.\d{3}\.\d{3}$/),
        ],
      ],
      hqStreet:      ['', [Validators.maxLength(180)]],
      hqNumber:      ['', [Validators.maxLength(30)]],
      hqPostalCode:  ['', [Validators.maxLength(20)]],
      hqCity:        ['', [Validators.maxLength(120)]],
      hqProvince:    ['', [Validators.maxLength(120)]],
      sectorIds:      [[] as number[]],
      pilotCenterIds: [[] as number[]],
    });
  }

  ngOnInit(): void {
    this.api.findAll().subscribe({
      next: (data: TrainingCenterDto[]) => {
        const uniq = (arr: string[]) =>
          Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));
        const vals = (fn: (x: TrainingCenterDto) => string | null | undefined) =>
          (data ?? []).map((x) => (fn(x) ?? '').trim()).filter(Boolean);

        this.allNames          = uniq(vals((x) => x.name));
        this.allCompanyNumbers = uniq(vals((x) => x.companyNumber));
        this.allStreets        = uniq(vals((x) => x.hqStreet));
        this.allHqNumbers      = uniq(vals((x) => x.hqNumber));
        this.allPostalCodes    = uniq(vals((x) => x.hqPostalCode));
        this.allCities         = uniq(vals((x) => x.hqCity));
      },
      error: () => {},
    });

    const cloneId = this.route.snapshot.queryParamMap.get('cloneId');

    if (cloneId) {
      this.loading = true;
      forkJoin({
        sectors:      this.sectorApi.findAll(),
        pilotCenters: this.pilotCenterApi.findAll(),
        source:       this.api.get(Number(cloneId)),
      }).subscribe({
        next: ({ sectors, pilotCenters, source }) => {
          this.sectors      = (sectors      ?? []).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
          this.pilotCenters = (pilotCenters ?? []).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
          this.items.at(0).patchValue({
            name:           source.name + ' (copie)',
            companyNumber:  '',
            hqStreet:       source.hqStreet ?? '',
            hqNumber:       source.hqNumber ?? '',
            hqPostalCode:   source.hqPostalCode ?? '',
            hqCity:         source.hqCity ?? '',
            hqProvince:     source.hqProvince ?? '',
            sectorIds:       source.sectorIds ?? [],
            pilotCenterIds:  source.pilotCenterIds ?? [],
          });
          this.loading = false;
        },
        error: (err) => {
          this.error   = err?.error?.message || 'Impossible de charger le centre à dupliquer.';
          this.loading = false;
        },
      });
    } else {
      forkJoin({
        sectors:      this.sectorApi.findAll(),
        pilotCenters: this.pilotCenterApi.findAll(),
      }).subscribe({
        next: ({ sectors, pilotCenters }) => {
          this.sectors      = (sectors      ?? []).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
          this.pilotCenters = (pilotCenters ?? []).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
        },
      });
    }
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

  // ===== Helpers =====

  private suggest(all: string[], raw: string): string[] {
    const q = (raw ?? '').trim().toLowerCase();
    if (!q) return [];
    return all
      .filter((n) => n.toLowerCase().startsWith(q) && n.toLowerCase() !== q)
      .slice(0, 8);
  }

  private getVal(index: number, field: string): string {
    return (this.items.at(index).get(field)?.value ?? '').toString();
  }

  // ===== Autocomplete : nom =====
  onNameInput(i: number) {
    this.activeRowIndex  = i;
    this.nameSuggestions = this.suggest(this.allNames, this.getVal(i, 'name'));
  }
  onNameFocus(i: number) {
    this.activeRowIndex      = i;
    this.showNameSuggestions = true;
    this.nameSuggestions     = this.suggest(this.allNames, this.getVal(i, 'name'));
  }
  onNameBlur() { setTimeout(() => (this.showNameSuggestions = false), 150); }
  pickName(v: string) {
    if (this.activeRowIndex === null) return;
    this.items.at(this.activeRowIndex).get('name')?.setValue(v);
    this.showNameSuggestions = false;
    this.nameSuggestions     = [];
  }

  // ===== Autocomplete : numéro d'entreprise =====
  onCompanyNumberInput(i: number) {
    this.activeRowIndex = i;
    const ctrl = this.items.at(i).get('companyNumber');
    if (!ctrl) return;
    const raw       = (ctrl.value ?? '').toString();
    const formatted = this.formatCompanyNumber(raw);
    if (raw !== formatted) ctrl.setValue(formatted, { emitEvent: false });
    this.companyNumberSuggestions = this.suggest(this.allCompanyNumbers, formatted);
  }
  onCompanyNumberFocus(i: number) {
    this.activeRowIndex               = i;
    this.showCompanyNumberSuggestions = true;
    const ctrl = this.items.at(i).get('companyNumber');
    if (ctrl && (!ctrl.value || ctrl.value.toString().trim() === '')) {
      ctrl.setValue('BE0', { emitEvent: false });
    }
    this.companyNumberSuggestions = this.suggest(this.allCompanyNumbers, this.getVal(i, 'companyNumber'));
  }
  onCompanyNumberBlur() { setTimeout(() => (this.showCompanyNumberSuggestions = false), 150); }
  pickCompanyNumber(v: string) {
    if (this.activeRowIndex === null) return;
    this.items.at(this.activeRowIndex).get('companyNumber')?.setValue(this.formatCompanyNumber(v));
    this.showCompanyNumberSuggestions = false;
    this.companyNumberSuggestions     = [];
  }

  private formatCompanyNumber(value: string): string {
    if (!value) return 'BE0';
    let v      = value.toUpperCase().replace(/^BE/, '');
    let digits = v.replace(/\D/g, '');
    if (digits.length === 0) return 'BE0';
    if (digits.length <= 9 && !digits.startsWith('0')) digits = '0' + digits;
    digits  = digits.slice(0, 10);
    const a = digits.slice(0, 4);
    const b = digits.slice(4, 7);
    const c = digits.slice(7, 10);
    let out = `BE${a}`;
    if (digits.length > 4) out += `.${b}`;
    if (digits.length > 7) out += `.${c}`;
    return out;
  }

  // ===== Autocomplete : rue =====
  onStreetInput(i: number) {
    this.activeRowIndex    = i;
    this.streetSuggestions = this.suggest(this.allStreets, this.getVal(i, 'hqStreet'));
  }
  onStreetFocus(i: number) {
    this.activeRowIndex        = i;
    this.showStreetSuggestions = true;
    this.streetSuggestions     = this.suggest(this.allStreets, this.getVal(i, 'hqStreet'));
  }
  onStreetBlur() { setTimeout(() => (this.showStreetSuggestions = false), 150); }
  pickStreet(v: string) {
    if (this.activeRowIndex === null) return;
    this.items.at(this.activeRowIndex).get('hqStreet')?.setValue(v);
    this.showStreetSuggestions = false;
    this.streetSuggestions     = [];
  }

  // ===== Autocomplete : numéro (hq) =====
  onHqNumberInput(i: number) {
    this.activeRowIndex      = i;
    this.hqNumberSuggestions = this.suggest(this.allHqNumbers, this.getVal(i, 'hqNumber'));
  }
  onHqNumberFocus(i: number) {
    this.activeRowIndex          = i;
    this.showHqNumberSuggestions = true;
    this.hqNumberSuggestions     = this.suggest(this.allHqNumbers, this.getVal(i, 'hqNumber'));
  }
  onHqNumberBlur() { setTimeout(() => (this.showHqNumberSuggestions = false), 150); }
  pickHqNumber(v: string) {
    if (this.activeRowIndex === null) return;
    this.items.at(this.activeRowIndex).get('hqNumber')?.setValue(v);
    this.showHqNumberSuggestions = false;
    this.hqNumberSuggestions     = [];
  }

  // ===== Autocomplete : code postal =====
  onPostalCodeInput(i: number) {
    this.activeRowIndex        = i;
    this.postalCodeSuggestions = this.suggest(this.allPostalCodes, this.getVal(i, 'hqPostalCode'));
    const province = getProvinceFromPostalCode(this.getVal(i, 'hqPostalCode'));
    if (province) this.items.at(i).get('hqProvince')?.setValue(province, { emitEvent: false });
  }
  onPostalCodeFocus(i: number) {
    this.activeRowIndex            = i;
    this.showPostalCodeSuggestions = true;
    this.postalCodeSuggestions     = this.suggest(this.allPostalCodes, this.getVal(i, 'hqPostalCode'));
  }
  onPostalCodeBlur() { setTimeout(() => (this.showPostalCodeSuggestions = false), 150); }
  pickPostalCode(v: string) {
    if (this.activeRowIndex === null) return;
    this.items.at(this.activeRowIndex).get('hqPostalCode')?.setValue(v);
    const province = getProvinceFromPostalCode(v);
    if (province) this.items.at(this.activeRowIndex).get('hqProvince')?.setValue(province, { emitEvent: false });
    this.showPostalCodeSuggestions = false;
    this.postalCodeSuggestions     = [];
  }

  // ===== Autocomplete : ville =====
  onCityInput(i: number) {
    this.activeRowIndex  = i;
    this.citySuggestions = this.suggest(this.allCities, this.getVal(i, 'hqCity'));
  }
  onCityFocus(i: number) {
    this.activeRowIndex      = i;
    this.showCitySuggestions = true;
    this.citySuggestions     = this.suggest(this.allCities, this.getVal(i, 'hqCity'));
  }
  onCityBlur() { setTimeout(() => (this.showCitySuggestions = false), 150); }
  pickCity(v: string) {
    if (this.activeRowIndex === null) return;
    this.items.at(this.activeRowIndex).get('hqCity')?.setValue(v);
    this.showCitySuggestions = false;
    this.citySuggestions     = [];
  }

  // ===== Submit =====

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

    let lastCreatedId: number | null = null;

    const run = async () => {
      for (let i = 0; i < this.items.length; i++) {
        if (this.rowStates[i]?.status === 'success') continue;
        const g = this.items.at(i);
        this.rowStates[i] = { status: 'saving' };

        const payload = {
          name:           (g.get('name')?.value ?? '').trim(),
          companyNumber:  (g.get('companyNumber')?.value ?? '').trim(),
          hqStreet:       this.trimOrNull(g.get('hqStreet')?.value),
          hqNumber:       this.trimOrNull(g.get('hqNumber')?.value),
          hqPostalCode:   this.trimOrNull(g.get('hqPostalCode')?.value),
          hqCity:         this.trimOrNull(g.get('hqCity')?.value),
          hqProvince:     this.trimOrNull(g.get('hqProvince')?.value),
          sectorIds:       g.get('sectorIds')?.value ?? [],
          pilotCenterIds:  g.get('pilotCenterIds')?.value ?? [],
        };

        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((resolve) => {
          this.api
            .create(payload as any)
            .pipe(finalize(() => resolve()))
            .subscribe({
              next:  (created) => { this.rowStates[i] = { status: 'success' }; lastCreatedId = created.id ?? null; },
              error: (err) => {
                const msg = err?.error?.message || err?.error?.error || 'Création impossible.';
                this.rowStates[i] = { status: 'error', error: msg };
              },
            });
        });
      }
    };

    run()
      .then(async () => {
        this.loading = false;
        const hasError = this.rowStates.some((s) => s.status === 'error');
        if (hasError) {
          this.error = "Certains centres n'ont pas pu être créés. Corrige les lignes en erreur.";
          return;
        }
        if (mode === 'back') {
          this.toast.success('Centre(s) de formation créé(s).');
          const goToAccreditation = lastCreatedId
            ? await this.confirmDialog.confirm('Voulez-vous créer un agrément centre pour ce centre de formation ?')
            : false;
          if (goToAccreditation) {
            this.router.navigate(['/center-accreditations/new'], {
              queryParams: { trainingCenterId: lastCreatedId },
            });
          } else {
            this.router.navigateByUrl('/training-centers');
          }
          return;
        }
        this.form.setControl('items', this.fb.array([this.newItemGroup()]));
        this.rowStates = [{ status: 'idle' }];
        this.error     = null;
      })
      .catch(() => {
        this.loading = false;
        this.error   = 'Une erreur inattendue est survenue.';
      });
  }

  private trimOrNull(v: unknown): string | null {
    const s = String(v ?? '').trim();
    return s.length ? s : null;
  }
}
