import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type LoginRequest = { email: string; password: string };
export type LoginResponse = { accessToken: string; email: string; role: string };

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/auth`;

  login(payload: LoginRequest) {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, payload);
  }
  changePassword(payload: { currentPassword: string; newPassword: string }) {
    return this.http.post<void>(`${this.baseUrl}/change-password`, payload);
  }
  
}
