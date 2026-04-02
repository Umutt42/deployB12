import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SubTheme } from '../models/sub-theme.model';

export interface SubThemeImportRowDto {
  name: string;
  description: string | null;
  hours: number | null;
}

export type SubThemePayload = {
  name: string;
  description?: string | null;
  hours?: number | null;
  themeId: number;
  archived?: boolean; // ✅ important
};

@Injectable({ providedIn: 'root' })
export class SubThemeApi {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/sub-themes`;

  findByTheme(themeId: number): Observable<SubTheme[]> {
    const params = new HttpParams().set('themeId', String(themeId));
    return this.http.get<SubTheme[]>(this.baseUrl, { params });
  }

  get(id: number): Observable<SubTheme> {
    return this.http.get<SubTheme>(`${this.baseUrl}/${id}`);
  }

  create(payload: SubThemePayload): Observable<SubTheme> {
    // ✅ on force archived à false si pas fourni
    return this.http.post<SubTheme>(this.baseUrl, { archived: false, ...payload });
  }

  update(id: number, payload: Partial<SubThemePayload>): Observable<SubTheme> {
    return this.http.put<SubTheme>(`${this.baseUrl}/${id}`, payload);
  }

  archive(id: number, archived: boolean): Observable<SubTheme> {
    const params = new HttpParams().set('archived', String(archived));
    return this.http.patch<SubTheme>(`${this.baseUrl}/${id}/archive`, null, { params });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  previewImport(file: File): Observable<SubThemeImportRowDto[]> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<SubThemeImportRowDto[]>(`${this.baseUrl}/import/preview`, form);
  }
}
