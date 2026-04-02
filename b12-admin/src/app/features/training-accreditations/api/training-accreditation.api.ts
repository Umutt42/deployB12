import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type AccreditationRequestStatus = 'RECEIVED' | 'ACCEPTED' | 'REFUSED' | 'PENDING';

export interface TrainingAccreditationDto {
  id?: number;

  // Agrément centre principal
  centerAccreditationId?: number;
  centerAccreditationLabel?: string | null;

  // Organismes partenaires
  partnerAccreditationIds?: number[];
  partnerAccreditationLabels?: string[];

  // Centre de formation (lecture seule)
  sectorLabels?: string[];
  pilotCenterLabels?: string[];

  // Champs principaux
  title?: string | null;
  durationHours?: number | null;
  price?: number | null;
  trainingPoints?: number | null;
  receivedDate?: string | null;
  requestStatus?: AccreditationRequestStatus | null;
  accreditationNumber?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  initial?: boolean;
  continuous?: boolean;
  subsidized?: boolean;
  comment?: string | null;
  publicCible?: string | null;
  archived?: boolean;

  // Type d'agrément
  type?: 'COMPLETE' | 'SUB_MODULES';

  // Sous-modules (type SUB_MODULES)
  subModuleIds?: number[];
  subModuleLabels?: string[];
  subModuleCenterIds?: number[];
  subModuleCenterLabels?: string[];

  // Relations
  licenseTypeIds?: number[];
  licenseTypeLabels?: string[];
  themeIds?: number[];
  themeLabels?: string[];
  subThemeIds?: number[];
  subThemeLabels?: string[];
  trainerIds?: number[];
  trainerLabels?: string[];

  // Audit
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TrainingAccreditationApi {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/training-accreditations`;

  findAll(): Observable<TrainingAccreditationDto[]> {
    return this.http.get<TrainingAccreditationDto[]>(this.baseUrl);
  }

  get(id: number): Observable<TrainingAccreditationDto> {
    return this.http.get<TrainingAccreditationDto>(`${this.baseUrl}/${id}`);
  }

  byCenterAccreditation(centerAccreditationId: number): Observable<TrainingAccreditationDto[]> {
    return this.http.get<TrainingAccreditationDto[]>(
      `${this.baseUrl}/by-center-accreditation/${centerAccreditationId}`
    );
  }

  create(payload: TrainingAccreditationDto): Observable<TrainingAccreditationDto> {
    return this.http.post<TrainingAccreditationDto>(this.baseUrl, payload);
  }

  update(id: number, payload: TrainingAccreditationDto): Observable<TrainingAccreditationDto> {
    return this.http.put<TrainingAccreditationDto>(`${this.baseUrl}/${id}`, payload);
  }

  archive(id: number, archived: boolean): Observable<TrainingAccreditationDto> {
    const params = new HttpParams().set('archived', String(archived));
    return this.http.patch<TrainingAccreditationDto>(
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
