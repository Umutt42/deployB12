import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';
import { forcePasswordChangeGuard } from '../../core/auth/force-password-change.guard';
import { roleGuard } from '../../core/auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/list/sectors').then(m => m.Sectors),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Secteurs' },
  },
  {
    path: 'stats',
    loadComponent: () => import('./pages/stats/sector-stats').then(m => m.SectorStats),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Statistiques — Secteurs' },
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/create/sector-create').then(m => m.SectorCreate),
    canActivate: [authGuard, forcePasswordChangeGuard, roleGuard],
    data: { title: 'Ajouter un secteur', roles: ['ADMIN', 'USER'] },
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/detail/sector-detail').then(m => m.SectorDetail),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Détail secteur' },
  },
];
