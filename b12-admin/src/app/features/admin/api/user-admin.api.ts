import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

import {
  User,
  CreateUserRequest,
  ResetUserPasswordRequest,
} from '../models/user.models';

@Injectable({ providedIn: 'root' })
export class UserAdminApi {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/admin/users`;

  list(): Observable<User[]> {
    return this.http.get<User[]>(this.baseUrl);
  }

  create(payload: CreateUserRequest): Observable<User> {
    return this.http.post<User>(this.baseUrl, payload);
  }

  setActive(id: number, active: boolean): Observable<User> {
    const params = new HttpParams().set('active', String(active));
    return this.http.patch<User>(`${this.baseUrl}/${id}/active`, null, { params });
  }

  resetPassword(id: number, payload: ResetUserPasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/reset-password`, payload);
  }
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
  setRole(id: number, role: 'ADMIN' | 'USER' | 'VISITOR') {
    return this.http.patch<User>(`${this.baseUrl}/${id}/role`, null, {
      params: { role }
    });
  }
  
}
