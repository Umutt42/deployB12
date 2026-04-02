import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';
import { forcePasswordChangeGuard } from '../../core/auth/force-password-change.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/list/sub-modules').then(m => m.SubModules),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Sous-modules' },
  },
  {
    path: 'stats',
    loadComponent: () => import('./pages/stats/sub-module-stats').then(m => m.SubModuleStats),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Statistiques sous-modules' },
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/create/sub-module-create').then(m => m.SubModuleCreate),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Ajouter un sous-module' },
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/detail/sub-module-detail').then(m => m.SubModuleDetail),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Détail sous-module' },
  },
];
