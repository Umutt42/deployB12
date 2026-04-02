import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface OrganismImportRowDto {
  name: string;
  abbreviation: string | null;
}

export type OrganismPayload = {
  name: string;
  abbreviation?: string | null;
  archived?: boolean;

  sectorIds?: number[];
  pilotCenterIds?: number[];
};

export interface OrganismDto {
  id?: number;
  name: string;
  abbreviation?: string | null;
  archived?: boolean;

  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string | null;
  createdBy?: string | null;

  sectorIds?: number[];
  pilotCenterIds?: number[];
}

@Injectable({ providedIn: 'root' })
export class OrganismApi {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/organisms`;

  findAll(): Observable<OrganismDto[]> {
    return this.http.get<OrganismDto[]>(this.baseUrl);
  }

  get(id: number): Observable<OrganismDto> {
    return this.http.get<OrganismDto>(`${this.baseUrl}/${id}`);
  }

  create(payload: OrganismPayload): Observable<OrganismDto> {
    return this.http.post<OrganismDto>(this.baseUrl, { archived: false, ...payload });
  }

  update(id: number, payload: OrganismPayload): Observable<OrganismDto> {
    return this.http.put<OrganismDto>(`${this.baseUrl}/${id}`, payload);
  }

  archive(id: number, archived: boolean): Observable<OrganismDto> {
    const params = new HttpParams().set('archived', String(archived));
    return this.http.patch<OrganismDto>(`${this.baseUrl}/${id}/archive`, null, { params });
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

  previewImport(file: File): Observable<OrganismImportRowDto[]> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<OrganismImportRowDto[]>(`${this.baseUrl}/import/preview`, form);
  }
}
