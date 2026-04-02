import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  email = 'admin@b12.local';
  password = '';

  loading = false;
  error: string | null = null;

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  submit(): void {
    this.error = null;

    const email = this.email.trim();
    const password = this.password;

    if (!email || !password) {
      this.error = 'Email et mot de passe obligatoires.';
      return;
    }

    this.loading = true;

    this.auth.login(email, password).subscribe({
      next: (res) => {
        this.loading = false;

        // ✅ Si le backend indique que le mot de passe doit être changé
        if (res?.forcePasswordChange) {
          this.router.navigateByUrl('/change-password');
          return;
        }

        // ✅ Sinon redirection normale
        this.router.navigateByUrl('/dashboard');
      },
      error: (err) => {
        console.error(err);
        this.loading = false;

        this.error =
          err?.error?.message ||
          'Identifiants invalides ou erreur serveur.';
      },
    });
  }
}
