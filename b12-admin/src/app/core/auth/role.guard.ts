import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const allowed = (route.data?.['roles'] ?? []) as Array<'ADMIN' | 'USER' | 'VISITOR'>;

  // si pas de roles => pas de restriction
  if (!allowed.length) return true;

  if (auth.hasAnyRole(...allowed)) return true;

  // interdit => retour accueil
  router.navigateByUrl('/license-types');
  return false;
};
