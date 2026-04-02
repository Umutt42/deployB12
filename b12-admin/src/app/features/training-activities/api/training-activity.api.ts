import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface TrainingActivityDto {
  id?: number;

  // Agrément formation lié
  trainingAccreditationId?: number;
  trainingAccreditationLabel?: string | null;

  // Agrément centre (via agrément formation)
  centerAccreditationId?: number;
  centerAccreditationLabel?: string | null;

  // Données issues de l'agrément formation (lecture seule)
  initial?: boolean;
  continuous?: boolean;
  durationHours?: number | null;
  themeLabels?: string[] | null;
  subThemeLabels?: string[] | null;
  licenseTypeLabels?: string[] | null;
  partnerAccreditationLabels?: string[] | null;

  // Données issues du centre de formation (lecture seule)
  pilotCenterLabels?: string[] | null;
  sectorLabels?: string[] | null;

  // Champs principaux
  startDate?: string | null;
  endDate?: string | null;
  numberOfParticipants?: number | null;
  online?: boolean;
  memberPrice?: number;
  nonMemberPrice?: number;
  phytodama?: boolean;
  street?: string | null;
  number?: string | null;
  postalCode?: string | null;
  ville?: string | null;
  province?: string | null;
  archived?: boolean;

  // Audit
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TrainingActivityApi {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/training-activities`;

  findAll(): Observable<TrainingActivityDto[]> {
    return this.http.get<TrainingActivityDto[]>(this.baseUrl);
  }

  get(id: number): Observable<TrainingActivityDto> {
    return this.http.get<TrainingActivityDto>(`${this.baseUrl}/${id}`);
  }

  byTrainingAccreditation(trainingAccreditationId: number): Observable<TrainingActivityDto[]> {
    return this.http.get<TrainingActivityDto[]>(
      `${this.baseUrl}/by-training-accreditation/${trainingAccreditationId}`
    );
  }

  findEligible(date: string): Observable<TrainingActivityDto[]> {
    const params = new HttpParams().set('date', date);
    return this.http.get<TrainingActivityDto[]>(`${this.baseUrl}/eligible`, { params });
  }

  findByDateRange(from: string, to: string): Observable<TrainingActivityDto[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<TrainingActivityDto[]>(`${this.baseUrl}/calendar`, { params });
  }

  create(payload: TrainingActivityDto): Observable<TrainingActivityDto> {
    return this.http.post<TrainingActivityDto>(this.baseUrl, payload);
  }

  update(id: number, payload: TrainingActivityDto): Observable<TrainingActivityDto> {
    return this.http.put<TrainingActivityDto>(`${this.baseUrl}/${id}`, payload);
  }

  archive(id: number, archived: boolean): Observable<TrainingActivityDto> {
    const params = new HttpParams().set('archived', String(archived));
    return this.http.patch<TrainingActivityDto>(
      `${this.baseUrl}/${id}/archive`, null, { params }
    );
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
}
