import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const forcePasswordChangeGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // si l’utilisateur doit changer son mot de passe
  if (auth.mustChangePassword()) {
    // autoriser uniquement la page /change-password
    if (state.url.startsWith('/change-password')) return true;

    router.navigateByUrl('/change-password');
    return false;
  }

  return true;
};
