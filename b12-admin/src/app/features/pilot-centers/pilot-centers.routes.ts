import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';
import { forcePasswordChangeGuard } from '../../core/auth/force-password-change.guard';
import { roleGuard } from '../../core/auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/list/pilot-centers').then(m => m.PilotCenters),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Centres pilotes' },
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/create/pilot-center-create').then(m => m.PilotCenterCreate),
    canActivate: [authGuard, forcePasswordChangeGuard, roleGuard],
    data: { title: 'Ajouter un centre pilote', roles: ['ADMIN', 'USER'] },
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/detail/pilot-center-detail').then(m => m.PilotCenterDetail),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Détail centre pilote' },
  },
];
