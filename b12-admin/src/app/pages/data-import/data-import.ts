import { Component, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { ToastService } from '../../shared/toast/toast.service';
import {
  ImportApi,
  ImportEntity,
  ImportResult,
  PreviewResult,
  ImportError,
} from '../../api/import.api';

interface StepConfig {
  entity: ImportEntity;
  label: string;
  description: string;
  templateFilename: string;
  multiSheet: boolean;
  sheetInfo: string;
}

@Component({
  selector: 'app-data-import',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './data-import.html',
  styleUrl: './data-import.css',
})
export class DataImport {

  private api   = inject(ImportApi);
  private toast = inject(ToastService);

  // ─── Stepper ──────────────────────────────────────────────────────────────

  currentStep = 0;

  steps: StepConfig[] = [
    {
      entity:           'training-centers',
      label:            'Centres de formation',
      description:      'Nom, numéro BCE, adresse du siège, secteurs et centres pilotes associés.',
      templateFilename: 'template_centres_de_formation.xlsx',
      multiSheet:       false,
      sheetInfo:        '1 feuille : centres_de_formation',
    },
    {
      entity:           'center-accreditations',
      label:            'Agréments centres',
      description:      'Agréments liés aux centres, avec leurs adresses de sites et contacts.',
      templateFilename: 'template_agrements_centres.xlsx',
      multiSheet:       true,
      sheetInfo:        '3 feuilles : agrements · adresses_sites · contacts',
    },
    {
      entity:           'training-accreditations',
      label:            'Agréments formations',
      description:      'Formations agréées avec leurs thèmes, types de phytolicences et formateurs.',
      templateFilename: 'template_agrements_formations.xlsx',
      multiSheet:       true,
      sheetInfo:        '2 feuilles : agrements_formations · formateurs_lies',
    },
    {
      entity:           'training-activities',
      label:            'Activités de formation',
      description:      'Séances de formation passées ou planifiées (participants, lieu, prix).',
      templateFilename: 'template_activites_formations.xlsx',
      multiSheet:       false,
      sheetInfo:        '1 feuille : activites_formations',
    },
  ];

  // ─── État par étape ───────────────────────────────────────────────────────

  selectedFile:   File | null    = null;
  previewResult:  PreviewResult | null = null;
  importResult:   ImportResult  | null = null;
  loading     = false;
  downloading = false;
  importing   = false;
  error: string | null = null;

  get step(): StepConfig {
    return this.steps[this.currentStep];
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  goToStep(index: number): void {
    this.currentStep  = index;
    this.resetState();
  }

  prevStep(): void {
    if (this.currentStep > 0) this.goToStep(this.currentStep - 1);
  }

  nextStep(): void {
    if (this.currentStep < this.steps.length - 1) this.goToStep(this.currentStep + 1);
  }

  resetState(): void {
    this.selectedFile  = null;
    this.previewResult = null;
    this.importResult  = null;
    this.error         = null;
  }

  // ─── Template ─────────────────────────────────────────────────────────────

  downloadTemplate(): void {
    this.downloading = true;
    this.api.downloadTemplate(this.step.entity).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href    = url;
        a.download = this.step.templateFilename;
        a.click();
        window.URL.revokeObjectURL(url);
        this.downloading = false;
      },
      error: () => {
        this.toast.error('Erreur lors du téléchargement du template.');
        this.downloading = false;
      },
    });
  }

  // ─── Upload ───────────────────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.selectedFile  = input.files[0];
    this.previewResult = null;
    this.importResult  = null;
    this.error         = null;
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    if (!this.isValidExtension(file.name)) {
      this.error = 'Format non supporté. Utilisez .xlsx, .xls ou .csv';
      return;
    }
    this.selectedFile  = file;
    this.previewResult = null;
    this.importResult  = null;
    this.error         = null;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  private isValidExtension(name: string): boolean {
    return /\.(xlsx|xls|csv)$/i.test(name);
  }

  // ─── Prévisualisation ─────────────────────────────────────────────────────

  preview(): void {
    if (!this.selectedFile) return;
    this.loading       = true;
    this.previewResult = null;
    this.importResult  = null;
    this.error         = null;

    this.api.preview(this.step.entity, this.selectedFile).subscribe({
      next: (result) => {
        this.previewResult = result;
        this.loading = false;
      },
      error: (err) => {
        this.error   = err?.error?.message ?? 'Erreur lors de la prévisualisation.';
        this.loading = false;
      },
    });
  }

  // ─── Import ───────────────────────────────────────────────────────────────

  confirmImport(): void {
    if (!this.selectedFile) return;
    this.importing    = true;
    this.importResult = null;
    this.error        = null;

    this.api.import(this.step.entity, this.selectedFile).subscribe({
      next: (result) => {
        this.importResult  = result;
        this.previewResult = null;
        this.importing     = false;
        if (result.errors.length === 0) {
          this.toast.success(`Import terminé : ${result.created} créé(s), ${result.skipped} ignoré(s).`);
        } else {
          this.toast.error(`Import terminé avec ${result.errors.length} erreur(s).`);
        }
      },
      error: (err) => {
        this.error     = err?.error?.message ?? "Erreur lors de l'import.";
        this.importing = false;
      },
    });
  }

  // ─── Helpers affichage ────────────────────────────────────────────────────

  errorsByRow(errors: ImportError[]): { row: number; messages: string[] }[] {
    const map = new Map<number, string[]>();
    for (const e of errors) {
      if (!map.has(e.row)) map.set(e.row, []);
      map.get(e.row)!.push(`[${e.field}] ${e.message}`);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([row, messages]) => ({ row, messages }));
  }

  trackByRow(_: number, item: { row: number }): number {
    return item.row;
  }
}
