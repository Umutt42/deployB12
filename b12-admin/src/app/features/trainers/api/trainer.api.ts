import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface TrainerImportRowDto {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  phytolicenceNumber: string | null;
}

export interface TrainerDto {
  id?: number;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  phytolicenceNumber?: string | null;
  comment?: string | null;
  archived?: boolean;

  trainingAccreditationId?: number | null;
  trainingAccreditationLabel?: string | null;

  // Agréments formation liés (lecture seule, pour la liste — FK + ManyToMany)
  trainingAccreditationIds?: number[];
  trainingAccreditationLabels?: string[];

  partnerOrganismIds?: number[];
  partnerOrganismLabels?: string[];

  trainingCenterIds?: number[];
  trainingCenterLabels?: string[];

  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TrainerApi {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/trainers`;

  findAll(): Observable<TrainerDto[]> {
    return this.http.get<TrainerDto[]>(this.baseUrl);
  }

  get(id: number): Observable<TrainerDto> {
    return this.http.get<TrainerDto>(`${this.baseUrl}/${id}`);
  }

  create(payload: TrainerDto): Observable<TrainerDto> {
    return this.http.post<TrainerDto>(this.baseUrl, payload);
  }

  update(id: number, payload: TrainerDto): Observable<TrainerDto> {
    return this.http.put<TrainerDto>(`${this.baseUrl}/${id}`, payload);
  }

  archive(id: number, archived: boolean): Observable<TrainerDto> {
    const params = new HttpParams().set('archived', String(archived));
    return this.http.patch<TrainerDto>(`${this.baseUrl}/${id}/archive`, null, { params });
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

  byCenterAccreditation(centerAccreditationId: number): Observable<TrainerDto[]> {
    return this.http.get<TrainerDto[]>(`${this.baseUrl}/by-center-accreditation/${centerAccreditationId}`);
  }

  previewImport(file: File): Observable<TrainerImportRowDto[]> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<TrainerImportRowDto[]>(`${this.baseUrl}/import/preview`, form);
  }
}
