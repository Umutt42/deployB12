import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface TrainingCenterDto {
  id?: number;
  name: string;
  companyNumber: string;
  archived?: boolean;

  // ✅ HQ (Option A1)
  hqStreet?: string | null;
  hqNumber?: string | null;
  hqPostalCode?: string | null;
  hqCity?: string | null;
  hqProvince?: string | null;

  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string | null;
  createdBy?: string | null;

  sectorIds?: number[];
  pilotCenterIds?: number[];
}

export type TrainingCenterPayload = {
  name: string;
  companyNumber: string;
  archived?: boolean;

  // ✅ HQ (Option A1)
  hqStreet?: string | null;
  hqNumber?: string | null;
  hqPostalCode?: string | null;
  hqCity?: string | null;
  hqProvince?: string | null;

  sectorIds?: number[];
  pilotCenterIds?: number[];
};

@Injectable({ providedIn: 'root' })
export class TrainingCenterApi {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/training-centers`;

  findAll(): Observable<TrainingCenterDto[]> {
    return this.http.get<TrainingCenterDto[]>(this.baseUrl);
  }

  get(id: number): Observable<TrainingCenterDto> {
    return this.http.get<TrainingCenterDto>(`${this.baseUrl}/${id}`);
  }

  create(payload: TrainingCenterPayload): Observable<TrainingCenterDto> {
    return this.http.post<TrainingCenterDto>(this.baseUrl, { archived: false, ...payload });
  }

  update(id: number, payload: TrainingCenterPayload): Observable<TrainingCenterDto> {
    return this.http.put<TrainingCenterDto>(`${this.baseUrl}/${id}`, payload);
  }

  archive(id: number, archived: boolean): Observable<TrainingCenterDto> {
    const params = new HttpParams().set('archived', String(archived));
    return this.http.patch<TrainingCenterDto>(`${this.baseUrl}/${id}/archive`, null, { params });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // OPTIONNEL (uniquement si backend a /export)
  exportAll(format: 'csv' | 'xlsx' | 'pdf', includeArchived = false): Observable<Blob> {
    const params = new HttpParams().set('format', format).set('includeArchived', String(includeArchived));
    return this.http.get(`${this.baseUrl}/export`, { params, responseType: 'blob' });
  }

  exportSelected(format: 'csv' | 'xlsx' | 'pdf', ids: number[]): Observable<Blob> {
    const params = new HttpParams().set('format', format);
    return this.http.post(`${this.baseUrl}/export`, ids, { params, responseType: 'blob' });
  }
}
