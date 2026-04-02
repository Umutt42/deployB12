import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { forcePasswordChangeGuard } from './core/auth/force-password-change.guard';
import { roleGuard } from './core/auth/role.guard';







export const routes: Routes = [

  // =========================
  // Auth (public)
  // =========================
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.Login),
    data: { title: 'Connexion' },
  },

  // =========================
  // Root
  // =========================
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Tableau de bord' },
  },
  {
    path: 'chart-export',
    loadComponent: () => import('./pages/chart-export/chart-export').then(m => m.ChartExport),
    canActivate: [authGuard, forcePasswordChangeGuard],
    data: { title: 'Rapport graphique' },
  },
  {
    path: 'import',
    loadComponent: () => import('./pages/data-import/data-import').then(m => m.DataImport),
    canActivate: [authGuard, forcePasswordChangeGuard, roleGuard],
    data: { title: 'Importation de données', roles: ['ADMIN'] },
  },

  // =========================
  // License types
  // =========================
  {
    path: 'license-types',
    loadChildren: () => import('./features/license-types/license-types.routes').then(m => m.routes),
  },

  // =========================
  // Themes
  // =========================
  {
    path: 'thematics',
    loadChildren: () => import('./features/themes/themes.routes').then(m => m.routes),
  },

  // =========================
  // Admin (users)
  // =========================
  {
    path: 'users',
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.routes),
  },

  // =========================
  // 🔐 Change password
  // =========================
  {
    path: 'change-password',
    loadComponent: () => import('./pages/change-password/change-password').then(m => m.ChangePassword),
    canActivate: [authGuard],
    data: { title: 'Modifier le mot de passe' },
  },
  // =========================
  // Sectors
  // =========================
  {
    path: 'sectors',
    loadChildren: () => import('./features/sectors/sectors.routes').then(m => m.routes),
  },

  // =========================
  // Organisms
  // =========================
  {
    path: 'organisms',
    loadChildren: () => import('./features/organisms/organisms.routes').then(m => m.routes),
  },

  // =========================
  // Pilot centers
  // =========================
  {
    path: 'pilot-centers',
    loadChildren: () => import('./features/pilot-centers/pilot-centers.routes').then(m => m.routes),
  },

  // =========================
  // Training centers
  // =========================
  {
    path: 'training-centers',
    loadChildren: () => import('./features/training-centers/training-centers.routes').then(m => m.routes),
  },


  // =========================
  // Center accreditations
  // =========================
  {
    path: 'center-accreditations',
    loadChildren: () => import('./features/center-accreditations/center-accreditations.routes').then(m => m.routes),
  },

  // =========================
  // Training accreditations
  // =========================
  {
    path: 'training-accreditations',
    loadChildren: () => import('./features/training-accreditations/training-accreditations.routes').then(m => m.routes),
  },

  // =========================
  // Trainers (Formateur·trices)
  // =========================
  {
    path: 'trainers',
    loadChildren: () => import('./features/trainers/trainers.routes').then(m => m.routes),
  },

  // =========================
  // Training activities
  // =========================
  {
    path: 'training-activities',
    loadChildren: () => import('./features/training-activities/training-activities.routes').then(m => m.routes),
  },

  // =========================
  // Sub-modules
  // =========================
  {
    path: 'sub-modules',
    loadChildren: () => import('./features/sub-modules/sub-modules.routes').then(m => m.routes),
  },

  // =========================
  // Fallback
  // =========================
  { path: '**', redirectTo: 'dashboard' },
];
