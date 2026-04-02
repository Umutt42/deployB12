import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type LoginResponse = {
  accessToken: string;
  email?: string;
  role?: string;
  forcePasswordChange?: boolean;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  private tokenKey = 'b12_token';
  private emailKey = 'b12_email';
  private roleKey = 'b12_role';
  private forceKey = 'b12_force_password_change'; // ✅ nouveau

  private baseUrl = `${environment.apiUrl}/api/auth`;

  /**
   * POST /api/auth/login
   */
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.baseUrl}/login`, { email, password })
      .pipe(
        tap((res) => {
          const token = res?.accessToken;
          if (!token) return;

          const savedEmail = res.email ?? email;
          const savedRole = res.role ?? 'USER';
          const mustChange = !!res.forcePasswordChange;

          this.setSession(token, savedEmail, savedRole);
          this.setForcePasswordChange(mustChange); // ✅ stockage du flag
        })
      );
  }

  setSession(token: string, email: string, role: string) {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.emailKey, email);
    localStorage.setItem(this.roleKey, role);
  }

  setForcePasswordChange(value: boolean): void {
    localStorage.setItem(this.forceKey, value ? 'true' : 'false');
  }

  mustChangePassword(): boolean {
    return localStorage.getItem(this.forceKey) === 'true';
  }

  clearForcePasswordChange(): void {
    localStorage.removeItem(this.forceKey);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getEmail(): string | null {
    return localStorage.getItem(this.emailKey);
  }

  getRole(): string | null {
    return localStorage.getItem(this.roleKey);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.emailKey);
    localStorage.removeItem(this.roleKey);
    localStorage.removeItem(this.forceKey); // ✅ nettoyage complet
  }
  isAdmin(): boolean {
    return this.getRole() === 'ADMIN';
  }
  
  isUser(): boolean {
    return this.getRole() === 'USER';
  }
  
  isVisitor(): boolean {
    return this.getRole() === 'VISITOR';
  }
  
  hasAnyRole(...roles: Array<'ADMIN' | 'USER' | 'VISITOR'>): boolean {
    const r = this.getRole();
    return !!r && roles.includes(r as any);
  }
  
  canWrite(): boolean {
    // ✅ USER + ADMIN peuvent écrire
    return this.hasAnyRole('ADMIN', 'USER');
  }
  
  canDelete(): boolean {
    return this.hasAnyRole('ADMIN', 'USER');
  }
  
}
