import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Theme } from '../models/theme.model';

export type ThemePayload = {
  name: string;
  description?: string | null;
  archived?: boolean;
};

@Injectable({ providedIn: 'root' })
export class ThemeApi {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/themes`;

  findAll(): Observable<Theme[]> {
    return this.http.get<Theme[]>(this.baseUrl);
  }

  get(id: number): Observable<Theme> {
    return this.http.get<Theme>(`${this.baseUrl}/${id}`);
  }

  create(payload: ThemePayload): Observable<Theme> {
    return this.http.post<Theme>(this.baseUrl, { archived: false, ...payload });
  }

  // ✅ update "classique" (PUT)
  update(id: number, payload: ThemePayload): Observable<Theme> {
    return this.http.put<Theme>(`${this.baseUrl}/${id}`, payload);
  }

  // ✅ archive/désarchive via endpoint dédié (PATCH)
  archive(id: number, archived: boolean): Observable<Theme> {
    const params = new HttpParams().set('archived', String(archived));
    return this.http.patch<Theme>(`${this.baseUrl}/${id}/archive`, null, { params });
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
