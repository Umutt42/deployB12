import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: ImportError[];
}

export interface PreviewResult {
  total: number;
  valid: number;
  withErrors: number;
  errors: ImportError[];
}

export type ImportEntity =
  | 'training-centers'
  | 'center-accreditations'
  | 'training-accreditations'
  | 'training-activities';

@Injectable({ providedIn: 'root' })
export class ImportApi {
  private http    = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/import`;

  // ─── Templates ────────────────────────────────────────────────────────────

  downloadTemplate(entity: ImportEntity): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/template/${entity}.xlsx`, { responseType: 'blob' });
  }

  // ─── Preview ──────────────────────────────────────────────────────────────

  preview(entity: ImportEntity, file: File): Observable<PreviewResult> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<PreviewResult>(`${this.baseUrl}/${entity}/preview`, form);
  }

  // ─── Import ───────────────────────────────────────────────────────────────

  import(entity: ImportEntity, file: File): Observable<ImportResult> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ImportResult>(`${this.baseUrl}/${entity}`, form);
  }
}
