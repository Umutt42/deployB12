import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';
import { forcePasswordChangeGuard } from '../../core/auth/force-password-change.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/list/center-accreditations').then(m => m.CenterAccreditations),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Agréments centres' },
  },
  {
    path: 'stats',
    loadComponent: () => import('./pages/stats/center-accreditation-stats').then(m => m.CenterAccreditationStats),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Statistiques agréments centres' },
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/create/center-accreditation-create').then(m => m.CenterAccreditationCreate),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Ajouter un agrément centre' },
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/detail/center-accreditation-detail').then(m => m.CenterAccreditationDetail),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Détail agrément centre' },
  },
];
