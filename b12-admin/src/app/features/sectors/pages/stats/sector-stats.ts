import { Component, OnInit, ViewChild, ElementRef, inject } from '@angular/core';
import { SHARED_IMPORTS } from '../../../../shared/shared-imports';
import { StatsApi, NamedStatDto } from '../../../../api/stats.api';
import { ToastService } from '../../../../shared/toast/toast.service';

@Component({
  selector: 'app-sector-stats',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './sector-stats.html',
  styleUrl: './sector-stats.css',
})
export class SectorStats implements OnInit {
  @ViewChild('statsContent') statsRef!: ElementRef<HTMLElement>;

  loading = true;
  error: string | null = null;
  exporting = false;

  data: NamedStatDto[] = [];

  readonly COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
    '#6366f1', '#a855f7', '#eab308', '#22c55e', '#0ea5e9',
    '#d946ef', '#fb923c', '#a3e635', '#38bdf8', '#34d399',
  ];

  private toast = inject(ToastService);

  constructor(private api: StatsApi) {}

  ngOnInit(): void {
    this.api.get().subscribe({
      next: (stats) => {
        this.data = (stats.activitiesBySector ?? [])
          .filter(d => d.count > 0)
          .sort((a, b) => b.count - a.count);
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger les statistiques.';
        this.loading = false;
      },
    });
  }

  get total(): number {
    return this.data.reduce((s, d) => s + d.count, 0);
  }

  get barMax(): number {
    return Math.max(1, ...this.data.map(d => d.count));
  }

  barWidth(count: number): string {
    return `${Math.round((count / this.barMax) * 100)}%`;
  }

  pct(count: number): string {
    if (this.total === 0) return '0.0';
    return (count / this.total * 100).toFixed(1);
  }

  colorOf(i: number): string {
    return this.COLORS[i % this.COLORS.length];
  }

  get topSector(): NamedStatDto | null {
    return this.data.length > 0 ? this.data[0] : null;
  }

  /** Top 10 pour le graphique en barres */
  get topData(): NamedStatDto[] {
    return this.data.slice(0, 10);
  }

  /** Top 7 + "Autres" pour le donut */
  get donutData(): Array<{ name: string; count: number; color: string }> {
    if (this.data.length === 0) return [];
    const limit = 7;
    if (this.data.length <= limit) {
      return this.data.map((d, i) => ({ name: d.name, count: d.count, color: this.colorOf(i) }));
    }
    const top = this.data.slice(0, limit).map((d, i) => ({
      name: d.name, count: d.count, color: this.colorOf(i),
    }));
    const rest = this.data.slice(limit).reduce((s, d) => s + d.count, 0);
    return [...top, { name: 'Autres', count: rest, color: '#94a3b8' }];
  }

  get donutGradient(): string {
    const items = this.donutData;
    if (items.length === 0) return 'conic-gradient(#e5e7eb 0% 100%)';
    let current = 0;
    const parts: string[] = [];
    for (const item of items) {
      const p = (item.count / this.total) * 100;
      parts.push(`${item.color} ${current.toFixed(2)}% ${(current + p).toFixed(2)}%`);
      current += p;
    }
    return `conic-gradient(${parts.join(', ')})`;
  }

  exportExcel(): void {
    const today = new Date().toISOString().slice(0, 10);

    const border = (color = '#e2e8f0', w = 1) =>
      `<Borders>` +
      ['Top','Bottom','Left','Right'].map(p =>
        `<Border ss:Position="${p}" ss:LineStyle="Continuous" ss:Weight="${w}" ss:Color="${color}"/>`
      ).join('') +
      `</Borders>`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Styles>

    <Style ss:ID="title">
      <Font ss:Bold="1" ss:Size="14" ss:Color="#1e293b" ss:FontName="Arial"/>
      <Alignment ss:Vertical="Center"/>
    </Style>

    <Style ss:ID="subtitle">
      <Font ss:Size="10" ss:Color="#64748b" ss:FontName="Arial"/>
      <Alignment ss:Vertical="Center"/>
    </Style>

    <Style ss:ID="hdr">
      <Font ss:Bold="1" ss:Size="10" ss:Color="#FFFFFF" ss:FontName="Arial"/>
      <Interior ss:Color="#2563EB" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      ${border('#1d4ed8')}
    </Style>

    <Style ss:ID="rank">
      <Font ss:Size="10" ss:Color="#94a3b8" ss:FontName="Arial"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      ${border()}
    </Style>

    <Style ss:ID="name">
      <Font ss:Size="10" ss:Color="#1e293b" ss:FontName="Arial"/>
      <Alignment ss:Vertical="Center"/>
      ${border()}
    </Style>

    <Style ss:ID="num">
      <Font ss:Size="10" ss:Color="#1e293b" ss:FontName="Arial"/>
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      ${border()}
    </Style>

    <Style ss:ID="rankZ">
      <Font ss:Size="10" ss:Color="#94a3b8" ss:FontName="Arial"/>
      <Interior ss:Color="#f8fafc" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      ${border()}
    </Style>

    <Style ss:ID="nameZ">
      <Font ss:Size="10" ss:Color="#1e293b" ss:FontName="Arial"/>
      <Interior ss:Color="#f8fafc" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Center"/>
      ${border()}
    </Style>

    <Style ss:ID="numZ">
      <Font ss:Size="10" ss:Color="#1e293b" ss:FontName="Arial"/>
      <Interior ss:Color="#f8fafc" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      ${border()}
    </Style>

    <Style ss:ID="totalLabel">
      <Font ss:Bold="1" ss:Size="10" ss:Color="#1e293b" ss:FontName="Arial"/>
      <Interior ss:Color="#dbeafe" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Center"/>
      ${border('#93c5fd', 2)}
    </Style>

    <Style ss:ID="totalNum">
      <Font ss:Bold="1" ss:Size="10" ss:Color="#1e293b" ss:FontName="Arial"/>
      <Interior ss:Color="#dbeafe" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      ${border('#93c5fd', 2)}
    </Style>

  </Styles>

  <Worksheet ss:Name="Secteurs - Statistiques">
    <Table ss:DefaultRowHeight="18">
      <Column ss:Width="40"/>
      <Column ss:Width="210"/>
      <Column ss:Width="130"/>
      <Column ss:Width="80"/>

      <!-- Titre -->
      <Row ss:Height="28">
        <Cell ss:StyleID="title" ss:MergeAcross="3">
          <Data ss:Type="String">Répartition des activités de formation par secteur</Data>
        </Cell>
      </Row>
      <Row ss:Height="18">
        <Cell ss:StyleID="subtitle" ss:MergeAcross="3">
          <Data ss:Type="String">Exporté le ${today} — ${this.data.length} secteur(s) actif(s) — ${this.total} activité(s) au total</Data>
        </Cell>
      </Row>
      <!-- Ligne vide -->
      <Row ss:Height="8"><Cell/></Row>

      <!-- En-têtes -->
      <Row ss:Height="22">
        <Cell ss:StyleID="hdr"><Data ss:Type="String">#</Data></Cell>
        <Cell ss:StyleID="hdr"><Data ss:Type="String">Secteur</Data></Cell>
        <Cell ss:StyleID="hdr"><Data ss:Type="String">Activités de formation</Data></Cell>
        <Cell ss:StyleID="hdr"><Data ss:Type="String">Part (%)</Data></Cell>
      </Row>

      ${this.data.map((d, i) => {
        const z = i % 2 === 1;
        return `<Row ss:Height="18">
        <Cell ss:StyleID="${z ? 'rankZ' : 'rank'}"><Data ss:Type="Number">${i + 1}</Data></Cell>
        <Cell ss:StyleID="${z ? 'nameZ' : 'name'}"><Data ss:Type="String">${this.escapeXml(d.name)}</Data></Cell>
        <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${d.count}</Data></Cell>
        <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="String">${this.pct(d.count)}%</Data></Cell>
      </Row>`;
      }).join('\n')}

      <!-- Total -->
      <Row ss:Height="20">
        <Cell ss:StyleID="totalLabel"/>
        <Cell ss:StyleID="totalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
        <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${this.total}</Data></Cell>
        <Cell ss:StyleID="totalNum"><Data ss:Type="String">100%</Data></Cell>
      </Row>
    </Table>
  </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    this.triggerDownload(blob, `secteurs-statistiques-${today}.xls`);
  }

  async exportPdf(): Promise<void> {
    this.exporting = true;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const element = this.statsRef.nativeElement;
      const prevOverflow = element.style.overflow;
      const prevHeight = element.style.height;
      element.style.overflow = 'visible';
      element.style.height = 'auto';

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        scrollY: 0,
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      element.style.overflow = prevOverflow;
      element.style.height = prevHeight;

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const pageHeightPx = Math.floor((pdfH * canvas.width) / pdfW);
      const totalPages = Math.ceil(canvas.height / pageHeightPx);

      for (let i = 0; i < totalPages; i++) {
        if (i > 0) pdf.addPage();
        const srcY = i * pageHeightPx;
        const srcH = Math.min(pageHeightPx, canvas.height - srcY);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = pageHeightPx;
        const ctx = pageCanvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pdfW, pdfH);
      }

      const today = new Date().toISOString().slice(0, 10);
      pdf.save(`secteurs-statistiques-${today}.pdf`);
    } catch (err) {
      console.error(err);
      this.toast.error('Erreur lors de la génération du PDF.');
    } finally {
      this.exporting = false;
    }
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
