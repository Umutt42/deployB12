import { Component, OnInit, ViewChild, ElementRef, inject } from '@angular/core';
import { forkJoin } from 'rxjs';

import { SHARED_IMPORTS } from '../../../../shared/shared-imports';
import { ToastService } from '../../../../shared/toast/toast.service';
import {
  CenterAccreditationApi,
  CenterAccreditationDto,
  AccreditationRequestStatus,
} from '../../api/center-accreditation.api';
import { TrainingCenterApi, TrainingCenterDto } from '../../../training-centers/api/training-center.api';
import { SectorApi, SectorDto } from '../../../sectors/api/sector.api';
import { PilotCenterApi, PilotCenterDto } from '../../../pilot-centers/api/pilot-center.api';

type CaRow = CenterAccreditationDto & {
  tcName: string;
  tcSectorIds: number[];
  tcPilotCenterIds: number[];
};

interface CaFilter {
  yearFrom: string;
  yearTo: string;
  status: AccreditationRequestStatus | '';
  centerId: number | null;
}

interface StatusRow {
  label: string;
  total: number;
  accepted: number;
  refused: number;
  received: number;
  pending: number;
}

interface EvolutionRow {
  year: string;
  total: number;
  accepted: number;
  deltaTotal: number | null;
  deltaTotalPct: string | null;
  deltaAccepted: number | null;
  deltaAcceptedPct: string | null;
  centersCount: number;
  renewedCount: number;
  renewalRate: string;
}

function emptyFilter(): CaFilter {
  return { yearFrom: '', yearTo: '', status: '', centerId: null };
}

@Component({
  selector: 'app-center-accreditation-stats',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './center-accreditation-stats.html',
  styleUrl: './center-accreditation-stats.css',
})
export class CenterAccreditationStats implements OnInit {
  @ViewChild('statsContent') statsRef!: ElementRef<HTMLElement>;

  loading = true;
  error: string | null = null;
  exporting = false;

  private toast = inject(ToastService);

  private allRows: CaRow[] = [];

  filterArchived: 'active' | 'archived' | 'all' = 'active';
  private sectorNameById = new Map<number, string>();
  private pilotCenterNameById = new Map<number, string>();

  availableTrainingCenters: { id: number; name: string }[] = [];

  // T1 : centerId + formationType (year = groupement)
  f1: { centerId: number | null; formationType: 'initial' | 'continuous' | '' } = { centerId: null, formationType: '' };
  // T2 : yearFrom + yearTo + status (center = groupement)
  f2: Pick<CaFilter, 'yearFrom' | 'yearTo' | 'status'> = { yearFrom: '', yearTo: '', status: '' };
  // T3 : year + status + centerId (pilotCenter = groupement)
  f3: CaFilter = emptyFilter();
  // T4 : year + status + centerId (sector = groupement)
  f4: CaFilter = emptyFilter();

  constructor(
    private api: CenterAccreditationApi,
    private tcApi: TrainingCenterApi,
    private sectorApi: SectorApi,
    private pilotCenterApi: PilotCenterApi,
  ) {}

  ngOnInit(): void {
    forkJoin({
      accreditations: this.api.findAll(),
      centers: this.tcApi.findAll(),
      sectors: this.sectorApi.findAll(),
      pilotCenters: this.pilotCenterApi.findAll(),
    }).subscribe({
      next: ({ accreditations, centers, sectors, pilotCenters }) => {
        this.sectorNameById.clear();
        (sectors ?? []).forEach((s: SectorDto) => {
          if (s.id != null) this.sectorNameById.set(s.id, s.name);
        });

        this.pilotCenterNameById.clear();
        (pilotCenters ?? []).forEach((pc: PilotCenterDto) => {
          if (pc.id != null) this.pilotCenterNameById.set(pc.id, pc.name);
        });

        const centerById = new Map<number, TrainingCenterDto>();
        (centers ?? []).forEach((c: TrainingCenterDto) => {
          if (c.id != null) centerById.set(c.id, c);
        });

        this.allRows = (accreditations ?? [])
          .map(a => {
            const tc = a.trainingCenterId ? centerById.get(a.trainingCenterId) : undefined;
            return {
              ...a,
              tcName: tc?.name ?? '-',
              tcSectorIds: tc?.sectorIds ?? [],
              tcPilotCenterIds: tc?.pilotCenterIds ?? [],
            } as CaRow;
          });

        const seen = new Map<number, string>();
        for (const r of this.allRows) {
          if (r.trainingCenterId != null && !seen.has(r.trainingCenterId)) {
            seen.set(r.trainingCenterId, r.tcName);
          }
        }
        this.availableTrainingCenters = Array.from(seen.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name));

        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger les agréments centres.';
        this.loading = false;
      },
    });
  }

  // ─────────────────────────────────────────────
  // Base filtrée selon le filtre actif/archivé global
  // ─────────────────────────────────────────────
  get filteredBase(): CaRow[] {
    if (this.filterArchived === 'active')   return this.allRows.filter(r => !r.archived);
    if (this.filterArchived === 'archived') return this.allRows.filter(r => !!r.archived);
    return this.allRows;
  }

  // ─────────────────────────────────────────────
  // Available years
  // ─────────────────────────────────────────────
  get availableYears(): string[] {
    const s = new Set<string>();
    for (const r of this.filteredBase) {
      const y = this.yearOf(r);
      if (y) s.add(y);
    }
    return Array.from(s).sort();
  }

  // ─────────────────────────────────────────────
  // KPIs
  // ─────────────────────────────────────────────
  get kpiTotal(): number    { return this.filteredBase.length; }
  get kpiAccepted(): number { return this.filteredBase.filter(r => r.requestStatus === 'ACCEPTED').length; }
  get kpiRefused(): number  { return this.filteredBase.filter(r => r.requestStatus === 'REFUSED').length; }
  get kpiReceived(): number { return this.filteredBase.filter(r => r.requestStatus === 'RECEIVED').length; }
  get kpiPending(): number  { return this.filteredBase.filter(r => r.requestStatus === 'PENDING').length; }

  get kpiAcceptedPct(): string {
    if (!this.kpiTotal) return '—';
    return ((this.kpiAccepted / this.kpiTotal) * 100).toFixed(0) + '%';
  }

  // ─────────────────────────────────────────────
  // T1 — par année
  // ─────────────────────────────────────────────
  get t1List(): CaRow[] {
    return this.filteredBase.filter(r => {
      if (this.f1.centerId != null && r.trainingCenterId !== this.f1.centerId) return false;
      if (this.f1.formationType === 'initial'    && !r.initial)    return false;
      if (this.f1.formationType === 'continuous' && !r.continuous) return false;
      return true;
    });
  }

  get t1Rows(): StatusRow[] { return this.groupByLabel(this.t1List, r => this.yearOf(r) || '—'); }
  get t1Total(): StatusRow  { return this.sumRows(this.t1Rows, 'TOTAL'); }

  get hasActiveF1(): boolean { return this.f1.centerId != null || !!this.f1.formationType; }
  resetF1(): void { this.f1 = { centerId: null, formationType: '' }; }

  t1SegW(count: number, rowTotal: number): string {
    if (!rowTotal) return '0%';
    return ((count / rowTotal) * 100).toFixed(1) + '%';
  }

  // ─────────────────────────────────────────────
  // T2 — par centre de formation
  // ─────────────────────────────────────────────
  get t2List(): CaRow[] {
    return this.filteredBase.filter(r => {
      if (this.f2.yearFrom && this.yearOf(r) < this.f2.yearFrom) return false;
      if (this.f2.yearTo   && this.yearOf(r) > this.f2.yearTo)   return false;
      if (this.f2.status && r.requestStatus !== this.f2.status)  return false;
      return true;
    });
  }

  get t2Rows(): StatusRow[] { return this.groupByLabel(this.t2List, r => r.tcName); }
  get t2Total(): StatusRow  { return this.sumRows(this.t2Rows, 'TOTAL'); }

  get hasActiveF2(): boolean { return !!(this.f2.yearFrom || this.f2.yearTo || this.f2.status); }
  resetF2(): void { this.f2 = { yearFrom: '', yearTo: '', status: '' }; }

  get t2MaxTotal(): number {
    const vals = this.t2Rows.map(r => r.total);
    return vals.length ? Math.max(...vals, 1) : 1;
  }

  t2BarW(count: number): string {
    return Math.round((count / this.t2MaxTotal) * 100) + '%';
  }

  // ─────────────────────────────────────────────
  // T3 — par centre pilote
  // ─────────────────────────────────────────────
  get t3List(): CaRow[] { return this.applyFilter(this.filteredBase, this.f3); }

  get t3Rows(): StatusRow[] {
    const map = new Map<string, StatusRow>();
    for (const r of this.t3List) {
      const pcIds = r.tcPilotCenterIds?.length ? r.tcPilotCenterIds : [];
      const labels = pcIds.length
        ? pcIds.map(id => this.pilotCenterNameById.get(id) ?? `#${id}`)
        : ['Sans centre pilote'];
      for (const label of labels) {
        if (!map.has(label)) map.set(label, { label, total: 0, accepted: 0, refused: 0, received: 0, pending: 0 });
        const row = map.get(label)!;
        row.total++;
        this.addStatus(row, r.requestStatus);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }

  get t3Total(): StatusRow { return this.sumRows(this.t3Rows, 'TOTAL'); }

  get hasActiveF3(): boolean { return !!(this.f3.yearFrom || this.f3.yearTo || this.f3.status || this.f3.centerId != null); }
  resetF3(): void { this.f3 = emptyFilter(); }

  get t3MaxTotal(): number {
    const vals = this.t3Rows.map(r => r.total);
    return vals.length ? Math.max(...vals, 1) : 1;
  }

  t3BarW(count: number): string {
    return Math.round((count / this.t3MaxTotal) * 100) + '%';
  }

  // ─────────────────────────────────────────────
  // T4 — par secteur
  // ─────────────────────────────────────────────
  get t4List(): CaRow[] { return this.applyFilter(this.filteredBase, this.f4); }

  get t4Rows(): StatusRow[] {
    const map = new Map<string, StatusRow>();
    for (const r of this.t4List) {
      const sIds = r.tcSectorIds?.length ? r.tcSectorIds : [];
      const labels = sIds.length
        ? sIds.map(id => this.sectorNameById.get(id) ?? `#${id}`)
        : ['Sans secteur'];
      for (const label of labels) {
        if (!map.has(label)) map.set(label, { label, total: 0, accepted: 0, refused: 0, received: 0, pending: 0 });
        const row = map.get(label)!;
        row.total++;
        this.addStatus(row, r.requestStatus);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }

  get t4Total(): StatusRow { return this.sumRows(this.t4Rows, 'TOTAL'); }

  get hasActiveF4(): boolean { return !!(this.f4.yearFrom || this.f4.yearTo || this.f4.status || this.f4.centerId != null); }
  resetF4(): void { this.f4 = emptyFilter(); }

  get t4MaxTotal(): number {
    const vals = this.t4Rows.map(r => r.total);
    return vals.length ? Math.max(...vals, 1) : 1;
  }

  t4BarW(count: number): string {
    return Math.round((count / this.t4MaxTotal) * 100) + '%';
  }

  // ─────────────────────────────────────────────
  // T5 — Évolution & taux de renouvellement
  // ─────────────────────────────────────────────
  get t5Rows(): EvolutionRow[] {
    const years = this.availableYears;
    const byYear = new Map<string, { total: number; accepted: number; centers: Set<number> }>();

    for (const r of this.filteredBase) {
      const y = this.yearOf(r);
      if (!y) continue;
      if (!byYear.has(y)) byYear.set(y, { total: 0, accepted: 0, centers: new Set<number>() });
      const entry = byYear.get(y)!;
      entry.total++;
      if (r.requestStatus === 'ACCEPTED') entry.accepted++;
      if (r.trainingCenterId != null) entry.centers.add(r.trainingCenterId);
    }

    return years.map((y, i) => {
      const curr = byYear.get(y) ?? { total: 0, accepted: 0, centers: new Set<number>() };
      const prev = i > 0 ? byYear.get(years[i - 1]) : null;

      let deltaTotal: number | null = null;
      let deltaTotalPct: string | null = null;
      let deltaAccepted: number | null = null;
      let deltaAcceptedPct: string | null = null;
      let renewedCount = 0;

      if (prev) {
        deltaTotal = curr.total - prev.total;
        deltaTotalPct = prev.total ? ((deltaTotal / prev.total) * 100).toFixed(1) : null;
        deltaAccepted = curr.accepted - prev.accepted;
        deltaAcceptedPct = prev.accepted ? ((deltaAccepted / prev.accepted) * 100).toFixed(1) : null;
        renewedCount = Array.from(curr.centers).filter(id => prev!.centers.has(id)).length;
      }

      return {
        year: y,
        total: curr.total,
        accepted: curr.accepted,
        deltaTotal,
        deltaTotalPct,
        deltaAccepted,
        deltaAcceptedPct,
        centersCount: curr.centers.size,
        renewedCount,
        renewalRate: curr.centers.size > 0
          ? ((renewedCount / curr.centers.size) * 100).toFixed(0) + '%'
          : '—',
      };
    });
  }

  deltaLabel(delta: number | null, pct: string | null): string {
    if (delta === null) return '—';
    const sign = delta > 0 ? '+' : '';
    return pct != null ? `${sign}${delta} (${sign}${pct}%)` : `${sign}${delta}`;
  }

  renewalClass(r: EvolutionRow): string {
    if (r.deltaTotal === null || r.centersCount === 0) return 'col-zero';
    const rate = r.renewedCount / r.centersCount;
    if (rate >= 0.7) return 'renewal-high';
    if (rate >= 0.4) return 'renewal-mid';
    return 'renewal-low';
  }

  // ─────────────────────────────────────────────
  // Utilitaires
  // ─────────────────────────────────────────────
  pct(count: number, total: number): string {
    if (!total) return '0%';
    return ((count / total) * 100).toFixed(0) + '%';
  }

  private applyFilter(list: CaRow[], f: CaFilter): CaRow[] {
    return list.filter(r => {
      if (f.yearFrom && this.yearOf(r) < f.yearFrom) return false;
      if (f.yearTo   && this.yearOf(r) > f.yearTo)   return false;
      if (f.status   && r.requestStatus !== f.status)            return false;
      if (f.centerId != null && r.trainingCenterId !== f.centerId) return false;
      return true;
    });
  }

  private groupByLabel(list: CaRow[], labelFn: (r: CaRow) => string): StatusRow[] {
    const map = new Map<string, StatusRow>();
    for (const r of list) {
      const label = labelFn(r);
      if (!map.has(label)) map.set(label, { label, total: 0, accepted: 0, refused: 0, received: 0, pending: 0 });
      const row = map.get(label)!;
      row.total++;
      this.addStatus(row, r.requestStatus);
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }

  private addStatus(row: StatusRow, status?: AccreditationRequestStatus | null): void {
    if      (status === 'ACCEPTED') row.accepted++;
    else if (status === 'REFUSED')  row.refused++;
    else if (status === 'RECEIVED') row.received++;
    else if (status === 'PENDING')  row.pending++;
  }

  private sumRows(rows: StatusRow[], label: string): StatusRow {
    return {
      label,
      total:    rows.reduce((s, r) => s + r.total,    0),
      accepted: rows.reduce((s, r) => s + r.accepted, 0),
      refused:  rows.reduce((s, r) => s + r.refused,  0),
      received: rows.reduce((s, r) => s + r.received, 0),
      pending:  rows.reduce((s, r) => s + r.pending,  0),
    };
  }

  private yearOf(r: CenterAccreditationDto): string {
    const d = r.receivedDate || r.startDate;
    if (!d) return '';
    return String(new Date(d).getFullYear());
  }

  // ─────────────────────────────────────────────
  // Export
  // ─────────────────────────────────────────────

  exportExcel(): void {
    const today = new Date().toISOString().slice(0, 10);

    const border = (color = '#e2e8f0', w = 1) =>
      `<Borders>` +
      ['Top', 'Bottom', 'Left', 'Right'].map(p =>
        `<Border ss:Position="${p}" ss:LineStyle="Continuous" ss:Weight="${w}" ss:Color="${color}"/>`
      ).join('') + `</Borders>`;

    const styles = `
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
        <Interior ss:Color="#0e7a75" ss:Pattern="Solid"/>
        <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
        ${border('#065f5a')}
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
        <Interior ss:Color="#cce8e7" ss:Pattern="Solid"/>
        <Alignment ss:Vertical="Center"/>
        ${border('#99d5d3', 2)}
      </Style>
      <Style ss:ID="totalNum">
        <Font ss:Bold="1" ss:Size="10" ss:Color="#1e293b" ss:FontName="Arial"/>
        <Interior ss:Color="#cce8e7" ss:Pattern="Solid"/>
        <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
        ${border('#99d5d3', 2)}
      </Style>`;

    const buildSheet = (sheetName: string, title: string, labelHeader: string, rows: StatusRow[]): string => {
      const total = this.sumRows(rows, 'TOTAL');
      const dataRows = rows.map((r, i) => {
        const z = i % 2 === 1;
        return `<Row ss:Height="18">
          <Cell ss:StyleID="${z ? 'nameZ' : 'name'}"><Data ss:Type="String">${this.escapeXml(r.label)}</Data></Cell>
          <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.accepted}</Data></Cell>
          <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.refused}</Data></Cell>
          <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.received}</Data></Cell>
          <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.pending}</Data></Cell>
          <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.total}</Data></Cell>
        </Row>`;
      }).join('\n');
      return `<Worksheet ss:Name="${this.escapeXml(sheetName)}">
        <Table ss:DefaultRowHeight="18">
          <Column ss:Width="220"/><Column ss:Width="80"/><Column ss:Width="80"/><Column ss:Width="80"/><Column ss:Width="80"/><Column ss:Width="80"/>
          <Row ss:Height="28">
            <Cell ss:StyleID="title" ss:MergeAcross="5"><Data ss:Type="String">${this.escapeXml(title)}</Data></Cell>
          </Row>
          <Row ss:Height="18">
            <Cell ss:StyleID="subtitle" ss:MergeAcross="5">
              <Data ss:Type="String">Exporté le ${today} — ${rows.length} ligne(s) — ${total.total} agrément(s)</Data>
            </Cell>
          </Row>
          <Row ss:Height="8"><Cell/></Row>
          <Row ss:Height="22">
            <Cell ss:StyleID="hdr"><Data ss:Type="String">${this.escapeXml(labelHeader)}</Data></Cell>
            <Cell ss:StyleID="hdr"><Data ss:Type="String">Accepté</Data></Cell>
            <Cell ss:StyleID="hdr"><Data ss:Type="String">Refusé</Data></Cell>
            <Cell ss:StyleID="hdr"><Data ss:Type="String">En cours</Data></Cell>
            <Cell ss:StyleID="hdr"><Data ss:Type="String">En attente</Data></Cell>
            <Cell ss:StyleID="hdr"><Data ss:Type="String">Total</Data></Cell>
          </Row>
          ${dataRows}
          <Row ss:Height="20">
            <Cell ss:StyleID="totalLabel"><Data ss:Type="String">TOTAL</Data></Cell>
            <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${total.accepted}</Data></Cell>
            <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${total.refused}</Data></Cell>
            <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${total.received}</Data></Cell>
            <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${total.pending}</Data></Cell>
            <Cell ss:StyleID="totalNum"><Data ss:Type="Number">${total.total}</Data></Cell>
          </Row>
        </Table>
      </Worksheet>`;
    };

    const byYear = this.groupByLabel(this.filteredBase, r => this.yearOf(r) || '—');
    const byCenter = this.groupByLabel(this.filteredBase, r => r.tcName);

    const pcMap = new Map<string, StatusRow>();
    for (const r of this.filteredBase) {
      const labels = r.tcPilotCenterIds?.length
        ? r.tcPilotCenterIds.map(id => this.pilotCenterNameById.get(id) ?? `#${id}`)
        : ['Sans centre pilote'];
      for (const label of labels) {
        if (!pcMap.has(label)) pcMap.set(label, { label, total: 0, accepted: 0, refused: 0, received: 0, pending: 0 });
        const row = pcMap.get(label)!;
        row.total++;
        this.addStatus(row, r.requestStatus);
      }
    }
    const byPilotCenter = Array.from(pcMap.values()).sort((a, b) => b.total - a.total);

    const sMap = new Map<string, StatusRow>();
    for (const r of this.filteredBase) {
      const labels = r.tcSectorIds?.length
        ? r.tcSectorIds.map(id => this.sectorNameById.get(id) ?? `#${id}`)
        : ['Sans secteur'];
      for (const label of labels) {
        if (!sMap.has(label)) sMap.set(label, { label, total: 0, accepted: 0, refused: 0, received: 0, pending: 0 });
        const row = sMap.get(label)!;
        row.total++;
        this.addStatus(row, r.requestStatus);
      }
    }
    const bySector = Array.from(sMap.values()).sort((a, b) => b.total - a.total);

    const evolutionRows = this.t5Rows;
    const evolutionDataRows = evolutionRows.map((r, i) => {
      const z = i % 2 === 1;
      const deltaT = r.deltaTotal === null ? '—' : this.deltaLabel(r.deltaTotal, r.deltaTotalPct);
      const deltaA = r.deltaAccepted === null ? '—' : this.deltaLabel(r.deltaAccepted, r.deltaAcceptedPct);
      return `<Row ss:Height="18">
            <Cell ss:StyleID="${z ? 'nameZ' : 'name'}"><Data ss:Type="String">${this.escapeXml(r.year)}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.total}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.accepted}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="String">${this.escapeXml(deltaT)}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="String">${this.escapeXml(deltaA)}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.centersCount}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="Number">${r.renewedCount}</Data></Cell>
            <Cell ss:StyleID="${z ? 'numZ' : 'num'}"><Data ss:Type="String">${this.escapeXml(r.renewalRate)}</Data></Cell>
          </Row>`;
    }).join('\n');

    const evolutionSheet = `<Worksheet ss:Name="Évolution">
      <Table ss:DefaultRowHeight="18">
        <Column ss:Width="80"/><Column ss:Width="80"/><Column ss:Width="80"/>
        <Column ss:Width="120"/><Column ss:Width="120"/>
        <Column ss:Width="90"/><Column ss:Width="100"/><Column ss:Width="110"/>
        <Row ss:Height="28">
          <Cell ss:StyleID="title" ss:MergeAcross="7">
            <Data ss:Type="String">Agréments centres — Évolution et taux de renouvellement</Data>
          </Cell>
        </Row>
        <Row ss:Height="18">
          <Cell ss:StyleID="subtitle" ss:MergeAcross="7">
            <Data ss:Type="String">Exporté le ${today} — ${evolutionRows.length} année(s)</Data>
          </Cell>
        </Row>
        <Row ss:Height="8"><Cell/></Row>
        <Row ss:Height="22">
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Année</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Total</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Acceptés</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Δ Total</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Δ Acceptés</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Centres actifs</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Renouvellements</Data></Cell>
          <Cell ss:StyleID="hdr"><Data ss:Type="String">Taux renouvellement</Data></Cell>
        </Row>
        ${evolutionDataRows}
      </Table>
    </Worksheet>`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Styles>${styles}</Styles>
  ${buildSheet('Par année', 'Agréments centres — par année', 'Année', byYear)}
  ${buildSheet('Par centre', 'Agréments centres — par centre de formation', 'Centre de formation', byCenter)}
  ${buildSheet('Par centre pilote', 'Agréments centres — par centre pilote', 'Centre pilote', byPilotCenter)}
  ${buildSheet('Par secteur', 'Agréments centres — par secteur', 'Secteur', bySector)}
  ${evolutionSheet}
</Workbook>`;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    this.triggerDownload(blob, `agréments-centres-statistiques-${today}.xls`);
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
        scale: 2, useCORS: true, scrollY: 0,
        width: element.scrollWidth, height: element.scrollHeight,
        windowWidth: element.scrollWidth, windowHeight: element.scrollHeight,
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
      pdf.save(`agréments-centres-statistiques-${today}.pdf`);
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
