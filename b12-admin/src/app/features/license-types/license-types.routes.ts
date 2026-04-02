import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';
import { forcePasswordChangeGuard } from '../../core/auth/force-password-change.guard';
import { roleGuard } from '../../core/auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/list/license-types').then(m => m.LicenseTypes),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Types de phytolicences' },
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/create/license-type-create').then(m => m.LicenseTypeCreate),
    canActivate: [authGuard, forcePasswordChangeGuard, roleGuard],
    data: { title: 'Ajouter un type de phytolicence', roles: ['ADMIN', 'USER'] },
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/detail/license-type-detail').then(m => m.LicenseTypeDetail),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Détail type de phytolicence' },
  },
];
