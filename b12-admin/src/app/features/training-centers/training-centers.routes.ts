import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';
import { forcePasswordChangeGuard } from '../../core/auth/force-password-change.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/list/training-centers').then(m => m.TrainingCenters),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Centres de formation' },
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/create/training-center-create').then(m => m.TrainingCenterCreate),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Ajouter un centre de formation' },
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/detail/training-center-detail').then(m => m.TrainingCenterDetail),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Détail centre de formation' },
  },
];
