import { Component, OnInit, inject, ElementRef, HostListener } from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { GlobalSearch } from '../search/global-search';

type BreadcrumbItem = { label: string; url?: string };

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink, GlobalSearch],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css',
})
export class Topbar implements OnInit {

  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private elRef = inject(ElementRef);

  // =========================
  // UI state
  // =========================

  pageTitle = 'Gestion des agréments centres';
  breadcrumb: BreadcrumbItem[] = [];
  showUserMenu = false;

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: EventTarget | null): void {
    if (!this.elRef.nativeElement.contains(target)) {
      this.showUserMenu = false;
    }
  }

  // =========================
  // Lifecycle
  // =========================

  ngOnInit(): void {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.refreshFromRoute());

    this.refreshFromRoute();
  }

  // =========================
  // Auth
  // =========================

  get userEmail(): string {
    return this.auth.getEmail() ?? '—';
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  get initials(): string {
    const email = this.auth.getEmail() ?? '';
    const local = email.split('@')[0] ?? '';
    const parts = local.split(/[.\-_]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return local.slice(0, 2).toUpperCase();
  }

  // =========================
  // Route → title / breadcrumb
  // =========================

  private refreshFromRoute(): void {
    const deepest = this.getDeepestRoute(this.route.root);

    this.pageTitle =
      deepest.snapshot.data?.['title'] ??
      'Gestion des agréments centres';

    const items = deepest.snapshot.data?.['breadcrumb'] as
      | BreadcrumbItem[]
      | undefined;

    this.breadcrumb = Array.isArray(items) ? items : [];
  }

  private getDeepestRoute(route: ActivatedRoute): ActivatedRoute {
    let current = route;
    while (current.firstChild) {
      current = current.firstChild;
    }
    return current;
  }

  isClickable(item: BreadcrumbItem): boolean {
    return !!item.url && item.url !== '';
  }
}
