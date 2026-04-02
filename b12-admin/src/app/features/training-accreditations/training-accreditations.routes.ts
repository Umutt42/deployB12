import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';
import { forcePasswordChangeGuard } from '../../core/auth/force-password-change.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/list/training-accreditations').then(m => m.TrainingAccreditations),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Agréments formations' },
  },
  {
    path: 'stats',
    loadComponent: () => import('./pages/stats/training-accreditation-stats').then(m => m.TrainingAccreditationStats),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Statistiques agréments formation' },
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/create/training-accreditation-create').then(m => m.TrainingAccreditationCreate),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Ajouter un agrément formation' },
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/detail/training-accreditation-detail').then(m => m.TrainingAccreditationDetail),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Détail agrément formation' },
  },
];
