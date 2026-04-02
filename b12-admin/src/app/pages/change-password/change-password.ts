import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { SHARED_IMPORTS } from '../../shared/shared-imports';

import { AuthApi } from '../../api/auth.api';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './change-password.html',
  styleUrl: './change-password.css',
})
export class ChangePassword {
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  showCurrent = false;
  showNew = false;
  showConfirm = false;

  loading = false;
  error: string | null = null;
  success: string | null = null;

  constructor(
    private api: AuthApi,
    private auth: AuthService,
    private router: Router
  ) {}

  // 🔎 Validation live
  get isNewPasswordValid(): boolean {
    return this.newPassword.length >= 8;
  }

  get passwordsMatch(): boolean {
    return (
      this.newPassword === this.confirmPassword &&
      this.confirmPassword.length > 0
    );
  }

  toggle(field: 'current' | 'new' | 'confirm'): void {
    if (field === 'current') this.showCurrent = !this.showCurrent;
    if (field === 'new') this.showNew = !this.showNew;
    if (field === 'confirm') this.showConfirm = !this.showConfirm;
  }

  submit(): void {
    if (this.loading) return;

    this.error = null;
    this.success = null;

    if (!this.currentPassword || !this.isNewPasswordValid || !this.passwordsMatch) {
      this.error = 'Veuillez corriger les erreurs du formulaire.';
      return;
    }

    this.loading = true;

    this.api
      .changePassword({
        currentPassword: this.currentPassword,
        newPassword: this.newPassword,
      })
      .subscribe({
        next: () => {
          this.loading = false;

          // ✅ Débloque l'app (forcePasswordChange=false côté front)
          this.auth.clearForcePasswordChange();

          this.success = 'Mot de passe modifié avec succès.';

          setTimeout(() => {
            this.router.navigateByUrl('/license-types');
          }, 700);
        },
        error: (err) => {
          this.loading = false;
          this.error =
            err?.error?.message || 'Impossible de modifier le mot de passe.';
        },
      });
  }
}
