import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';
import { forcePasswordChangeGuard } from '../../core/auth/force-password-change.guard';
import { roleGuard } from '../../core/auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/list/users').then(m => m.Users),
    canActivate: [authGuard, forcePasswordChangeGuard, roleGuard],
    data: { title: 'Utilisateurs', roles: ['ADMIN'] },
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/create/user-create').then(m => m.UserCreate),
    canActivate: [authGuard, forcePasswordChangeGuard, roleGuard],
    data: { title: 'Créer un utilisateur', roles: ['ADMIN'] },
  },
];
