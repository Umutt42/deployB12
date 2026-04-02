import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';
import { forcePasswordChangeGuard } from '../../core/auth/force-password-change.guard';
import { roleGuard } from '../../core/auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/list/themes').then(m => m.Themes),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Thématiques' },
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/create/theme-create').then(m => m.ThemeCreate),
    canActivate: [authGuard, forcePasswordChangeGuard, roleGuard],
    data: { title: 'Ajouter une thématique', roles: ['ADMIN', 'USER'] },
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./pages/edit/theme-edit').then(m => m.ThemeEdit),
    canActivate: [authGuard, forcePasswordChangeGuard, roleGuard],
    data: { title: 'Modifier une thématique', roles: ['ADMIN', 'USER'] },
  },
  {
    path: ':themeId/sub-themes/new',
    loadComponent: () => import('./pages/sub-theme-create/sub-theme-create').then(m => m.SubThemeCreate),
    canActivate: [authGuard, forcePasswordChangeGuard, roleGuard],
    data: { title: 'Ajouter un sous-thème', roles: ['ADMIN', 'USER'] },
  },
  {
    path: ':themeId/sub-themes/:subId',
    loadComponent: () => import('./pages/sub-theme-detail/sub-theme-detail').then(m => m.SubThemeDetail),
    canActivate: [authGuard, forcePasswordChangeGuard, roleGuard],
    data: { title: 'Modifier un sous-thème', roles: ['ADMIN', 'USER'] },
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/detail/theme-detail').then(m => m.ThemeDetail),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Détail thématique' },
  },
];
