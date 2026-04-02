import { inject, Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { StatsApi, StatsDto } from '../../../api/stats.api';

@Injectable({ providedIn: 'root' })
export class SidebarCountsService {
  counts: StatsDto | null = null;

  private api = inject(StatsApi);
  private router = inject(Router);
  private auth = inject(AuthService);

  constructor() {
    this.refresh();
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.refresh());
  }

  refresh(): void {
    if (!this.auth.isLoggedIn()) return;
    this.api.get().subscribe({
      next: (data) => { this.counts = data; },
      error: () => {},
    });
  }
}
