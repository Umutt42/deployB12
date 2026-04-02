import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ContactPersonDto {
  id?: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  fonction?: string | null;
  archived?: boolean;
}

export interface TrainingSiteAddressDto {
  id?: number;
  street?: string | null;
  number?: string | null;
  city?: string | null;
  postalCode?: string | null;
  province?: string | null;
  archived?: boolean;
}

export type AccreditationRequestStatus = 'RECEIVED' | 'ACCEPTED' | 'REFUSED' | 'PENDING';

export interface CenterAccreditationDto {
  id?: number;
  trainingCenterId?: number;
  receivedDate?: string | null;
  requestStatus?: AccreditationRequestStatus | null;
  accreditationNumber?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  initial?: boolean;
  continuous?: boolean;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string | null;
  createdBy?: string | null;
  trainingSiteAddresses?: TrainingSiteAddressDto[];
  contactPeople?: ContactPersonDto[];
}

@Injectable({ providedIn: 'root' })
export class CenterAccreditationApi {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/center-accreditations`;

  findAll(): Observable<CenterAccreditationDto[]> {
    return this.http.get<CenterAccreditationDto[]>(this.baseUrl);
  }

  findActiveAt(date: string): Observable<CenterAccreditationDto[]> {
    const params = new HttpParams().set('date', date);
    return this.http.get<CenterAccreditationDto[]>(`${this.baseUrl}/active-at`, { params });
  }

  get(id: number): Observable<CenterAccreditationDto> {
    return this.http.get<CenterAccreditationDto>(`${this.baseUrl}/${id}`);
  }

  byTrainingCenter(trainingCenterId: number): Observable<CenterAccreditationDto[]> {
    return this.http.get<CenterAccreditationDto[]>(`${this.baseUrl}/by-training-center/${trainingCenterId}`);
  }

  create(payload: CenterAccreditationDto): Observable<CenterAccreditationDto> {
    return this.http.post<CenterAccreditationDto>(this.baseUrl, payload);
  }

  update(id: number, payload: CenterAccreditationDto): Observable<CenterAccreditationDto> {
    return this.http.put<CenterAccreditationDto>(`${this.baseUrl}/${id}`, payload);
  }

  archive(id: number, archived: boolean): Observable<CenterAccreditationDto> {
    const params = new HttpParams().set('archived', String(archived));
    return this.http.patch<CenterAccreditationDto>(`${this.baseUrl}/${id}/archive`, null, { params });
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
