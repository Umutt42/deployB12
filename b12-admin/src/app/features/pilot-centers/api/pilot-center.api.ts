import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface PilotCenterDto {
  id?: number;
  name: string;
  cpGroup?: string | null;
  description?: string | null;
  archived?: boolean;

  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string | null;
  createdBy?: string | null;

  sectorIds?: number[];
  organismIds?: number[];
}

export interface PilotCenterImportRowDto {
  name: string;
  cpGroup: string | null;
  description: string | null;
}

export type PilotCenterPayload = {
  name: string;
  cpGroup?: string | null;
  description?: string | null;
  archived?: boolean;

  sectorIds?: number[];
  organismIds?: number[];
};

@Injectable({ providedIn: 'root' })
export class PilotCenterApi {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/pilot-centers`;

  findAll(): Observable<PilotCenterDto[]> {
    return this.http.get<PilotCenterDto[]>(this.baseUrl);
  }

  get(id: number): Observable<PilotCenterDto> {
    return this.http.get<PilotCenterDto>(`${this.baseUrl}/${id}`);
  }

  create(payload: PilotCenterPayload): Observable<PilotCenterDto> {
    return this.http.post<PilotCenterDto>(this.baseUrl, { archived: false, ...payload });
  }

  update(id: number, payload: PilotCenterPayload): Observable<PilotCenterDto> {
    return this.http.put<PilotCenterDto>(`${this.baseUrl}/${id}`, payload);
  }

  archive(id: number, archived: boolean): Observable<PilotCenterDto> {
    const params = new HttpParams().set('archived', String(archived));
    return this.http.patch<PilotCenterDto>(`${this.baseUrl}/${id}/archive`, null, { params });
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

  previewImport(file: File): Observable<PilotCenterImportRowDto[]> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<PilotCenterImportRowDto[]>(`${this.baseUrl}/import/preview`, form);
  }
}
