import { Component, OnInit, ViewChild, ElementRef, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared/shared-imports';
import { StatsApi, StatsDto, MonthlyStatDto } from '../../api/stats.api';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  @ViewChild('dashboardContent') dashboardRef!: ElementRef<HTMLElement>;

  stats: StatsDto | null = null;
  loading = true;
  error: string | null = null;
  exporting = false;

  skeletonItems = [1, 2, 3, 4, 5];

  private toast = inject(ToastService);

  constructor(private api: StatsApi) {}

  ngOnInit(): void {
    this.api.get().subscribe({
      next: (s) => { this.stats = s; this.loading = false; },
      error: (err) => {
        console.error(err);
        this.error = 'Impossible de charger les statistiques.';
        this.loading = false;
      },
    });
  }

  get hasAlerts(): boolean {
    if (!this.stats) return false;
    return (
      this.stats.centerAccreditationsExpiringIn30Days > 0 ||
      this.stats.centerAccreditationsExpiringIn60Days > 0 ||
      this.stats.trainingAccreditationsExpiringIn30Days > 0 ||
      this.stats.trainingAccreditationsExpiringIn60Days > 0
    );
  }

  get chartMax(): number {
    if (!this.stats) return 1;
    return Math.max(1, ...this.stats.activitiesLast12Months.map(m => m.count));
  }

  barWidth(count: number): string {
    return `${Math.round((count / this.chartMax) * 100)}%`;
  }

  monthLabel(m: MonthlyStatDto): string {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
                    'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    return `${months[m.month - 1]} ${m.year}`;
  }

  isCurrentMonth(m: MonthlyStatDto): boolean {
    const now = new Date();
    return m.year === now.getFullYear() && m.month === now.getMonth() + 1;
  }

  shortMonth(m: MonthlyStatDto): string {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
                    'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    return months[m.month - 1];
  }

  caStatusPct(val: number): number {
    if (!this.stats) return 0;
    const total = this.stats.caAccepted + this.stats.caPending + this.stats.caReceived + this.stats.caRefused;
    return total === 0 ? 0 : Math.round((val / total) * 100);
  }

  exportStats(format: 'csv' | 'xlsx' | 'pdf'): void {
    this.exporting = true;
    this.api.export(format).subscribe({
      next: (blob) => {
        const today = new Date().toISOString().slice(0, 10);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tableau-de-bord-${today}.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.exporting = false;
      },
      error: (err) => {
        console.error(err);
        this.toast.error("Erreur lors de l'export.");
        this.exporting = false;
      },
    });
  }

  async exportDashboard(): Promise<void> {
    this.exporting = true;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const element = this.dashboardRef.nativeElement;

      // Temporarily expand the scrollable container so html2canvas captures full content
      const prevOverflow = element.style.overflow;
      const prevHeight   = element.style.height;
      element.style.overflow = 'visible';
      element.style.height   = 'auto';

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        scrollY: 0,
        width:        element.scrollWidth,
        height:       element.scrollHeight,
        windowWidth:  element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      element.style.overflow = prevOverflow;
      element.style.height   = prevHeight;

      const pdf  = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();   // 210 mm
      const pdfH = pdf.internal.pageSize.getHeight();  // 297 mm

      // How many canvas-px fit in one A4 page
      const pageHeightPx = Math.floor((pdfH * canvas.width) / pdfW);
      const totalPages   = Math.ceil(canvas.height / pageHeightPx);

      for (let i = 0; i < totalPages; i++) {
        if (i > 0) pdf.addPage();

        const srcY = i * pageHeightPx;
        const srcH = Math.min(pageHeightPx, canvas.height - srcY);

        // Slice this page out of the full canvas
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width  = canvas.width;
        pageCanvas.height = pageHeightPx;
        const ctx = pageCanvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

        pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pdfW, pdfH);
      }

      const today = new Date().toISOString().slice(0, 10);
      pdf.save(`tableau-de-bord-${today}.pdf`);
    } catch (err) {
      console.error(err);
      this.toast.error('Erreur lors de la capture PDF.');
    } finally {
      this.exporting = false;
    }
  }

  taStatusPct(val: number): number {
    if (!this.stats) return 0;
    const total = this.stats.taAccepted + this.stats.taPending + this.stats.taReceived + this.stats.taRefused;
    return total === 0 ? 0 : Math.round((val / total) * 100);
  }
}
