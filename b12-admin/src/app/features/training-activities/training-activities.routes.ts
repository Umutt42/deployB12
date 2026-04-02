import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';
import { forcePasswordChangeGuard } from '../../core/auth/force-password-change.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/list/training-activities').then(m => m.TrainingActivities),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Activités de formation' },
  },
  {
    path: 'stats',
    loadComponent: () => import('./pages/stats/training-activity-stats').then(m => m.TrainingActivityStats),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Statistiques — Activités de formation' },
  },
  {
    path: 'calendar',
    loadComponent: () => import('./pages/calendar/training-activity-calendar').then(m => m.TrainingActivityCalendar),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Calendrier des activités de formation' },
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/create/training-activity-create').then(m => m.TrainingActivityCreate),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Ajouter une activité de formation' },
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/detail/training-activity-detail').then(m => m.TrainingActivityDetail),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Détail activité de formation' },
  },
];
