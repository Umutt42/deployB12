import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';
import { forcePasswordChangeGuard } from '../../core/auth/force-password-change.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/list/trainers').then(m => m.Trainers),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Formateur·trices' },
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/create/trainer-create').then(m => m.TrainerCreate),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Ajouter un·e formateur·trice' },
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/detail/trainer-detail').then(m => m.TrainerDetail),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Détail formateur·trice' },
  },
];
