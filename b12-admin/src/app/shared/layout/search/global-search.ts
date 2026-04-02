import {
  Component, OnInit, OnDestroy, inject, ElementRef, HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs/operators';

import { GlobalSearchApi, SearchResult } from './global-search.api';

@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './global-search.html',
  styleUrl: './global-search.css',
})
export class GlobalSearch implements OnInit, OnDestroy {
  private api    = inject(GlobalSearchApi);
  private router = inject(Router);
  private el     = inject(ElementRef);

  query   = '';
  results: SearchResult[] = [];
  loading = false;
  open    = false;

  // Position du dropdown (position: fixed → coords viewport)
  dropdownTop  = 0;
  dropdownLeft = 0;

  private input$ = new Subject<string>();
  private sub?: Subscription;

  // ─── Résultats groupés par type ───────────────────────────────────
  get grouped(): { type: string; items: SearchResult[] }[] {
    const map = new Map<string, SearchResult[]>();
    for (const r of this.results) {
      if (!map.has(r.type)) map.set(r.type, []);
      map.get(r.type)!.push(r);
    }
    return Array.from(map.entries()).map(([type, items]) => ({ type, items }));
  }

  get hasResults(): boolean { return this.results.length > 0; }

  // ─── Lifecycle ───────────────────────────────────────────────────

  ngOnInit(): void {
    this.sub = this.input$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(q => q.trim().length >= 2),
      switchMap(q => {
        this.loading = true;
        return this.api.search(q);
      }),
    ).subscribe({
      next: (results) => {
        this.results = results;
        this.loading = false;
        this.open    = true;
        this.updateDropdownPosition();
      },
      error: () => { this.loading = false; },
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  // ─── Événements ──────────────────────────────────────────────────

  onInput(): void {
    if (this.query.trim().length < 2) { this.close(); return; }
    this.input$.next(this.query);
  }

  navigate(result: SearchResult): void {
    this.router.navigateByUrl(result.route);
    this.close();
  }

  close(): void {
    this.open    = false;
    this.results = [];
  }

  // Ferme si clic en dehors du composant
  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.close(); this.query = ''; }

  // ─── Position du dropdown (fixed, hors stacking context topbar) ──

  private updateDropdownPosition(): void {
    const wrap = this.el.nativeElement.querySelector('.gs-input-wrap') as HTMLElement;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    this.dropdownTop  = rect.bottom + 8;
    this.dropdownLeft = rect.left + rect.width / 2; // centre horizontal
  }
}
