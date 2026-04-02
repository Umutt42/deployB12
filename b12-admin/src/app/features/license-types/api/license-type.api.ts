import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LicenseType } from '../models/license-type.model';
import { environment } from '../../../../environments/environment';

export interface ImportRowDto {
  code: string;
  label: string;
  description: string | null;
}

export interface ImportResultDto {
  total: number;
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

@Injectable({ providedIn: 'root' })
export class LicenseTypeApi {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/license-types`;

  // =========================
  // GET - liste (avec filtre archived optionnel)
  // =========================
  findAll(archived?: boolean): Observable<LicenseType[]> {
    let params = new HttpParams();

    if (archived !== undefined && archived !== null) {
      params = params.set('archived', String(archived));
    }

    return this.http.get<LicenseType[]>(this.baseUrl, { params });
  }

  // =========================
  // GET - détail
  // =========================
  get(id: number): Observable<LicenseType> {
    return this.http.get<LicenseType>(`${this.baseUrl}/${id}`);
  }

  // =========================
  // POST - création
  // =========================
  create(payload: {
    code: string;
    label: string;
    description?: string | null;
  }): Observable<LicenseType> {
    return this.http.post<LicenseType>(this.baseUrl, payload);
  }

  // =========================
  // PUT/PATCH - update (édition)
  // ⚠️ adapte si ton backend utilise PUT au lieu de PATCH
  // =========================
  update(
    id: number,
    payload: { label: string; description?: string | null; archived: boolean }
  ): Observable<LicenseType> {
    return this.http.put<LicenseType>(`${this.baseUrl}/${id}`, payload);
    // si ton backend fait un PATCH pour update:
    // return this.http.patch<LicenseType>(`${this.baseUrl}/${id}`, payload);
  }

  // =========================
  // PATCH - archive / désarchive
  // =========================
  archive(id: number, archived: boolean): Observable<LicenseType> {
    const params = new HttpParams().set('archived', String(archived));
    return this.http.patch<LicenseType>(`${this.baseUrl}/${id}/archive`, null, { params });
  }

  // =========================
  // DELETE - suppression définitive
  // =========================
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // =========================
  // EXPORT
  // =========================
  exportAll(format: 'csv' | 'xlsx' | 'pdf', includeArchived = false): Observable<Blob> {
    const params = new HttpParams().set('format', format).set('includeArchived', String(includeArchived));
    return this.http.get(`${this.baseUrl}/export`, { params, responseType: 'blob' });
  }

  exportSelected(format: 'csv' | 'xlsx' | 'pdf', ids: number[]): Observable<Blob> {
    const params = new HttpParams().set('format', format);
    return this.http.post(`${this.baseUrl}/export`, ids, { params, responseType: 'blob' });
  }

  // =========================
  // IMPORT
  // =========================
  previewImport(file: File): Observable<ImportRowDto[]> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ImportRowDto[]>(`${this.baseUrl}/import/preview`, form);
  }
}
