import { Component, OnInit, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../../../shared/shared-imports';

import { TrainingActivityApi, TrainingActivityDto } from '../../api/training-activity.api';

interface CalendarDay {
  date: Date;
  iso: string;
  inMonth: boolean;
  isToday: boolean;
  activities: TrainingActivityDto[];
}

@Component({
  selector: 'app-training-activity-calendar',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './training-activity-calendar.html',
  styleUrl: './training-activity-calendar.css',
})
export class TrainingActivityCalendar implements OnInit {
  private api = inject(TrainingActivityApi);

  today = new Date();
  currentYear  = this.today.getFullYear();
  currentMonth = this.today.getMonth();

  weeks: CalendarDay[][] = [];
  loading = false;
  error: string | null = null;

  readonly WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // ─── Modal détail ────────────────────────────────────────────────
  selectedActivity: TrainingActivityDto | null = null;

  ngOnInit(): void { this.loadMonth(); }

  get monthLabel(): string {
    return new Date(this.currentYear, this.currentMonth, 1)
      .toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' });
  }

  prevMonth(): void {
    if (this.currentMonth === 0) { this.currentMonth = 11; this.currentYear--; }
    else { this.currentMonth--; }
    this.loadMonth();
  }

  nextMonth(): void {
    if (this.currentMonth === 11) { this.currentMonth = 0; this.currentYear++; }
    else { this.currentMonth++; }
    this.loadMonth();
  }

  goToToday(): void {
    this.currentYear  = this.today.getFullYear();
    this.currentMonth = this.today.getMonth();
    this.loadMonth();
  }

  private loadMonth(): void {
    this.selectedActivity = null;
    this.loading = true;
    this.error   = null;

    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay  = new Date(this.currentYear, this.currentMonth + 1, 0);

    this.api.findByDateRange(this.toIso(firstDay), this.toIso(lastDay)).subscribe({
      next: (activities) => { this.buildWeeks(activities); this.loading = false; },
      error: () => { this.error = 'Impossible de charger les activités.'; this.loading = false; this.weeks = []; },
    });
  }

  private buildWeeks(activities: TrainingActivityDto[]): void {
    const byDate = new Map<string, TrainingActivityDto[]>();
    for (const a of activities) {
      if (!a.startDate) continue;
      if (!byDate.has(a.startDate)) byDate.set(a.startDate, []);
      byDate.get(a.startDate)!.push(a);
    }

    const todayIso = this.toIso(this.today);
    const firstOfMonth = new Date(this.currentYear, this.currentMonth, 1);
    const dow    = firstOfMonth.getDay();
    const offset = dow === 0 ? 6 : dow - 1;
    const cursor = new Date(firstOfMonth);
    cursor.setDate(cursor.getDate() - offset);

    this.weeks = [];
    for (let w = 0; w < 6; w++) {
      const week: CalendarDay[] = [];
      for (let d = 0; d < 7; d++) {
        const iso = this.toIso(cursor);
        week.push({
          date:       new Date(cursor),
          iso,
          inMonth:    cursor.getMonth() === this.currentMonth,
          isToday:    iso === todayIso,
          activities: byDate.get(iso) ?? [],
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      this.weeks.push(week);
      if (cursor.getMonth() !== this.currentMonth && w >= 4) break;
    }
  }

  // ─── Modal ──────────────────────────────────────────────────────

  openModal(activity: TrainingActivityDto): void  { this.selectedActivity = activity; }
  closeModal(): void                              { this.selectedActivity = null; }

  // ─── Helpers ────────────────────────────────────────────────────

  private toIso(d: Date): string {
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  chipLabel(a: TrainingActivityDto): string {
    return a.trainingAccreditationLabel ?? `#${a.id}`;
  }

  formatLocalDate(iso?: string | null): string {
    if (!iso) return '-';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  addressLine(a: TrainingActivityDto): string {
    const parts: string[] = [];
    if (a.street)     parts.push(`${a.street}${a.number ? ' ' + a.number : ''}`);
    if (a.postalCode) parts.push(a.postalCode);
    if (a.ville)      parts.push(a.ville);
    return parts.join(', ') || '-';
  }
}
