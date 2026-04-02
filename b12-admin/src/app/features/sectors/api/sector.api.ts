import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface SectorImportRowDto {
  name: string;
  description: string | null;
}

export interface SectorDto {
  id?: number;
  name: string;
  description?: string | null;
  archived?: boolean;

  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string | null;
  createdBy?: string | null;

  organismIds?: number[];
  pilotCenterIds?: number[];
}

export type SectorPayload = {
  name: string;
  description?: string | null;
  archived?: boolean;

  organismIds?: number[];
  pilotCenterIds?: number[];
};

@Injectable({ providedIn: 'root' })
export class SectorApi {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/sectors`;

  findAll(): Observable<SectorDto[]> {
    return this.http.get<SectorDto[]>(this.baseUrl);
  }

  get(id: number): Observable<SectorDto> {
    return this.http.get<SectorDto>(`${this.baseUrl}/${id}`);
  }

  create(payload: SectorPayload): Observable<SectorDto> {
    return this.http.post<SectorDto>(this.baseUrl, { archived: false, ...payload });
  }

  update(id: number, payload: SectorPayload): Observable<SectorDto> {
    return this.http.put<SectorDto>(`${this.baseUrl}/${id}`, payload);
  }

  archive(id: number, archived: boolean): Observable<SectorDto> {
    const params = new HttpParams().set('archived', String(archived));
    return this.http.patch<SectorDto>(`${this.baseUrl}/${id}/archive`, null, { params });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  exportAll(format: 'csv' | 'xlsx' | 'pdf', includeArchived = false): Observable<Blob> {
    const params = new HttpParams().set('format', format).set('includeArchived', String(includeArchived));
    return this.http.get(`${this.baseUrl}/export`, { params, responseType: 'blob' });
  }

  exportSelected(format: 'csv' | 'xlsx' | 'pdf', ids: number[]): Observable<Blob> {
    const params = new HttpParams().set('format', format);
    return this.http.post(`${this.baseUrl}/export`, ids, { params, responseType: 'blob' });
  }

  previewImport(file: File): Observable<SectorImportRowDto[]> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<SectorImportRowDto[]>(`${this.baseUrl}/import/preview`, form);
  }
}
