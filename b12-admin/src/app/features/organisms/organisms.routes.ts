import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';
import { forcePasswordChangeGuard } from '../../core/auth/force-password-change.guard';
import { roleGuard } from '../../core/auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/list/organisms').then(m => m.Organisms),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Organismes' },
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/create/organism-create').then(m => m.OrganismCreate),
    canActivate: [authGuard, forcePasswordChangeGuard, roleGuard],
    data: { title: 'Ajouter un organisme', roles: ['ADMIN', 'USER'] },
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/detail/organism-detail').then(m => m.OrganismDetail),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Détail organisme' },
  },
];
