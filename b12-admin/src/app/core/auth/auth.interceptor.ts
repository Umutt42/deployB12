import { Injectable, inject } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { ToastService } from '../../shared/toast/toast.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {

    const token = this.auth.getToken();

    // login = jamais de token
    if (req.url.includes('/api/auth/login')) {
      return next.handle(req);
    }

    // pas connecté → pas de token
    if (!token) {
      return next.handle(req);
    }

    // connecté → on ajoute le Bearer token
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {

        if (error.status === 401 || error.status === 403) {
          this.auth.logout();
          this.router.navigateByUrl('/login');

        } else if (error.status === 0) {
          this.toast.error('Connexion impossible. Vérifiez votre réseau.');

        } else if (error.status >= 500) {
          this.toast.error('Erreur serveur. Veuillez réessayer.');

        } else if (error.status === 404) {
          this.toast.warning('Ressource introuvable.');

        } else if (error.status === 400) {
          const msg = error.error?.message || 'Données invalides.';
          this.toast.warning(msg);
        }

        return throwError(() => error);
      })
    );
  }
}
