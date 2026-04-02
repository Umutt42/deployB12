import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy } from '@angular/core';

/**
 * ScrollMirrorDirective
 *
 * 1. Scrollbar fantôme en bas du viewport : visible quand la scrollbar native
 *    est hors écran (table trop haute → utilisateur au milieu du tableau).
 *
 * 2. En-tête fantôme en haut du viewport : visible quand le vrai thead est
 *    remonté hors écran. Résout l'impossibilité de position:sticky;top:0 sur
 *    les th quand l'ancêtre overflow-x:auto crée un scroll-container.
 *
 * Usage : attribut `scrollMirror` sur le div.table-wrapper.
 */

// Styles globaux injectés une seule fois pour les clones (hors ViewEncapsulation).
let _stylesInjected = false;
function injectGlobalStyles(): void {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    .sm-sticky-hdr {
      position: fixed;
      top: 0;
      overflow: hidden;
      background: #fff;
      border-bottom: 2px solid #d7dfe6;
      box-sizing: border-box;
      z-index: 9998;
      display: none;
    }
    .sm-sticky-hdr table {
      border-collapse: separate;
      border-spacing: 0;
      table-layout: fixed;
    }
    .sm-sticky-hdr th {
      padding: 10px;
      font-weight: 700;
      font-size: 14px;
      color: #2a3b47;
      background: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-sizing: border-box;
      text-align: left;
      vertical-align: middle;
      border-bottom: 1px solid #eef2f6;
    }
    .sm-sticky-hdr th.check {
      text-align: center;
      padding-left: 6px;
      padding-right: 6px;
    }
    .sm-sticky-hdr .sort-indicator {
      margin-left: 8px;
      font-size: 0.8em;
      opacity: 0.7;
    }
  `;
  document.head.appendChild(s);
}

@Directive({
  selector: '[scrollMirror]',
  standalone: true,
})
export class ScrollMirrorDirective implements AfterViewInit, OnDestroy {
  private wrapper: HTMLElement;
  private track!: HTMLDivElement;
  /** Empêche les boucles de feedback entre wrapper et track. */
  private syncing = false;
  private rafId: number | null = null;
  private ro!: ResizeObserver;

  // En-tête fantôme
  private stickyHdr: HTMLDivElement | null = null;
  private stickyHdrTable: HTMLTableElement | null = null;

  constructor(ref: ElementRef<HTMLElement>, private zone: NgZone) {
    this.wrapper = ref.nativeElement;
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      injectGlobalStyles();
      this.createTrack();
      this.createStickyHeader();
      this.update();

      this.ro = new ResizeObserver(() => this.update());
      this.ro.observe(this.wrapper);
      const table = this.wrapper.querySelector('table');
      if (table) this.ro.observe(table);

      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onScroll, { passive: true });
    });
  }

  private createTrack(): void {
    this.track = document.createElement('div');
    Object.assign(this.track.style, {
      position: 'fixed',
      bottom: '0',
      overflowX: 'auto',
      overflowY: 'hidden',
      height: '14px',
      zIndex: '9999',
      background: '#f0f4f7',
      borderTop: '1px solid #cfd9e2',
      display: 'none',
    });

    const inner = document.createElement('div');
    inner.style.height = '1px';
    this.track.appendChild(inner);

    document.body.appendChild(this.track);

    // wrapper → track
    this.wrapper.addEventListener('scroll', () => {
      if (this.syncing) return;
      this.syncing = true;
      this.track.scrollLeft = this.wrapper.scrollLeft;
      this.syncing = false;
    }, { passive: true });

    // track → wrapper
    this.track.addEventListener('scroll', () => {
      if (this.syncing) return;
      this.syncing = true;
      this.wrapper.scrollLeft = this.track.scrollLeft;
      this.syncing = false;
    }, { passive: true });
  }

  private createStickyHeader(): void {
    this.stickyHdr = document.createElement('div');
    this.stickyHdr.className = 'sm-sticky-hdr';
    document.body.appendChild(this.stickyHdr);

    // Sync scroll : wrapper → en-tête fantôme
    this.wrapper.addEventListener('scroll', () => {
      if (this.stickyHdrTable && this.stickyHdr!.style.display !== 'none') {
        this.stickyHdrTable.style.transform = `translateX(-${this.wrapper.scrollLeft}px)`;
      }
    }, { passive: true });
  }

  private readonly onScroll = (): void => {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.update();
    });
  };

  private update(): void {
    this.updateTrack();
    this.updateStickyHeader();
  }

  private updateTrack(): void {
    const rect        = this.wrapper.getBoundingClientRect();
    const vh          = window.innerHeight;
    const hasOverflow = this.wrapper.scrollWidth > this.wrapper.clientWidth + 2;

    const show = hasOverflow && rect.top < vh && rect.bottom > vh;

    if (show) {
      const inner = this.track.firstElementChild as HTMLElement;
      inner.style.width = this.wrapper.scrollWidth + 'px';

      Object.assign(this.track.style, {
        display: 'block',
        left:    rect.left + 'px',
        width:   rect.width + 'px',
      });

      if (!this.syncing) {
        this.track.scrollLeft = this.wrapper.scrollLeft;
      }
    } else {
      this.track.style.display = 'none';
    }
  }

  private updateStickyHeader(): void {
    if (!this.stickyHdr) return;

    const table = this.wrapper.querySelector('table');
    const thead = table?.querySelector('thead') as HTMLElement | null;
    if (!table || !thead) {
      this.stickyHdr.style.display = 'none';
      return;
    }

    const wrapperRect = this.wrapper.getBoundingClientRect();
    const theadRect   = thead.getBoundingClientRect();

    // Afficher quand le bas du thead a disparu au-dessus du viewport
    // ET que le tableau est encore partiellement visible
    const show = theadRect.bottom <= 0 && wrapperRect.bottom > 10;

    if (show) {
      this.buildOrRefreshStickyHeader(table, thead);

      Object.assign(this.stickyHdr.style, {
        display: 'block',
        left:  wrapperRect.left + 'px',
        width: wrapperRect.width + 'px',
      });

      if (this.stickyHdrTable) {
        this.stickyHdrTable.style.width     = `${table.scrollWidth}px`;
        this.stickyHdrTable.style.transform = `translateX(-${this.wrapper.scrollLeft}px)`;
      }
    } else {
      this.stickyHdr.style.display = 'none';
      // Invalider le clone pour le reconstruire à la prochaine apparition
      // (colonnes affichées/masquées peuvent avoir changé)
      if (theadRect.top > 10) {
        this.stickyHdrTable = null;
        this.stickyHdr.innerHTML = '';
      }
    }
  }

  private buildOrRefreshStickyHeader(table: HTMLElement, thead: HTMLElement): void {
    const realThs = Array.from(thead.querySelectorAll('th'));

    if (!this.stickyHdrTable) {
      // Première construction
      const cloneTable = document.createElement('table') as HTMLTableElement;
      cloneTable.className = table.className;

      const cloneThead = document.createElement('thead');
      const cloneTr    = document.createElement('tr');

      realThs.forEach(th => {
        const cloneTh = document.createElement('th');
        cloneTh.className  = th.className;
        cloneTh.innerHTML  = th.innerHTML;
        const w = th.getBoundingClientRect().width;
        cloneTh.style.width    = `${w}px`;
        cloneTh.style.minWidth = `${w}px`;
        cloneTr.appendChild(cloneTh);
      });

      cloneThead.appendChild(cloneTr);
      cloneTable.appendChild(cloneThead);
      this.stickyHdr!.appendChild(cloneTable);
      this.stickyHdrTable = cloneTable;
    } else {
      // Mise à jour des largeurs (colonnes peuvent avoir changé)
      const cloneThs = Array.from(this.stickyHdrTable.querySelectorAll('th'));
      if (cloneThs.length !== realThs.length) {
        // Nombre de colonnes différent → reconstruire
        this.stickyHdrTable = null;
        this.stickyHdr!.innerHTML = '';
        this.buildOrRefreshStickyHeader(table, thead);
        return;
      }
      realThs.forEach((th, i) => {
        const w = th.getBoundingClientRect().width;
        (cloneThs[i] as HTMLElement).style.width    = `${w}px`;
        (cloneThs[i] as HTMLElement).style.minWidth = `${w}px`;
      });
    }
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.track?.remove();
    this.stickyHdr?.remove();
    this.ro?.disconnect();
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onScroll);
  }
}
