import type { AfterViewInit, ElementRef, OnDestroy } from '@angular/core';
import { Component, effect, inject, input, output, viewChild } from '@angular/core';
import * as L from 'leaflet';

import 'leaflet.markercluster';
import { MapService } from '../../../core/services/map.service';
import { formatDateTime } from '../../../core/utils/format';
import { escapeHtml, groupReportsByDog, type ReportGroup } from '../../../core/utils/report-groups';
import { labelOf, SIZE_OPTIONS, STATUS_OPTIONS, type DogReport } from '../../../models/dog-report.model';

type MapFilter = 'all' | 'alerts' | 'community';

@Component({
  selector: 'app-city-map',
  template: `<div #mapHost class="city-map"></div>`,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .city-map {
        width: 100%;
        height: 100%;
        min-height: 400px;
        z-index: 1;
      }
      :host ::ng-deep .leaflet-popup-content-wrapper {
        border-radius: 16px;
        background: #f7fffb;
        box-shadow: 0 10px 30px rgba(27, 107, 83, 0.2);
      }
      :host ::ng-deep .leaflet-popup-tip {
        background: #f7fffb;
      }
      :host ::ng-deep .leaflet-popup-content {
        margin: 10px;
        width: 300px !important;
        max-width: 82vw;
        font-family: inherit;
      }
      :host ::ng-deep .paw-popup {
        color: #2f2a26;
      }
      :host ::ng-deep .popup-cover,
      :host ::ng-deep .popup-no-photo {
        width: 100%;
        height: 128px;
        object-fit: cover;
        border-radius: 12px;
        margin-bottom: 8px;
      }
      :host ::ng-deep .popup-no-photo {
        display: grid;
        place-items: center;
        background: #dff5eb;
        font-size: 2.5rem;
      }
      :host ::ng-deep .popup-head h4 {
        margin: 0 0 2px;
        font-size: 1rem;
        font-weight: 800;
        color: #1b6b53;
      }
      :host ::ng-deep .popup-head p {
        margin: 0;
        font-size: 0.76rem;
        color: #6b625b;
      }
      :host ::ng-deep .popup-meta {
        margin: 6px 0;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      :host ::ng-deep .popup-chip {
        background: #e4f6ee;
        color: #1b6b53;
        border-radius: 999px;
        padding: 3px 8px;
        font-size: 0.72rem;
        font-weight: 700;
      }
      :host ::ng-deep .popup-summary {
        margin: 4px 0 8px;
        font-size: 0.78rem;
        line-height: 1.35;
        color: #5c554e;
      }
      :host ::ng-deep .popup-section {
        margin: 8px 0 6px;
        font-size: 0.78rem;
        font-weight: 800;
        color: #1b6b53;
      }
      :host ::ng-deep .popup-cards {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 230px;
        overflow-y: auto;
        padding-right: 2px;
      }
      :host ::ng-deep .report-card {
        background: #fff;
        border: 1px solid #d8efe5;
        border-radius: 12px;
        padding: 8px;
      }
      :host ::ng-deep .card-photos {
        display: flex;
        gap: 4px;
        margin-bottom: 6px;
      }
      :host ::ng-deep .card-photos img {
        width: 33%;
        height: 58px;
        object-fit: cover;
        border-radius: 8px;
      }
      :host ::ng-deep .card-photo-more {
        display: grid;
        place-items: center;
        width: 33%;
        height: 58px;
        border-radius: 8px;
        background: #e4f6ee;
        color: #1b6b53;
        font-size: 0.78rem;
        font-weight: 700;
      }
      :host ::ng-deep .card-head {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      :host ::ng-deep .avatar,
      :host ::ng-deep .avatar-fallback {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
      }
      :host ::ng-deep .avatar-fallback {
        display: grid;
        place-items: center;
        background: #1b8a6b;
        color: #fff;
        font-size: 0.75rem;
        font-weight: 800;
      }
      :host ::ng-deep .card-author {
        font-size: 0.76rem;
        font-weight: 700;
      }
      :host ::ng-deep .card-date {
        font-size: 0.7rem;
        color: #8a827a;
      }
      :host ::ng-deep .card-title {
        margin: 6px 0 2px;
        font-size: 0.82rem;
        font-weight: 800;
        line-height: 1.25;
        color: #245e4c;
      }
      :host ::ng-deep .card-desc {
        margin: 6px 0;
        font-size: 0.76rem;
        line-height: 1.35;
        color: #5c554e;
      }
      :host ::ng-deep .card-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
      }
      :host ::ng-deep .status-pill {
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 0.7rem;
        font-weight: 700;
        background: #e4f6ee;
        color: #1b6b53;
      }
      :host ::ng-deep .status-pill.resuelto {
        background: #d7f3e4;
        color: #146b45;
      }
      :host ::ng-deep .open-report {
        border: 0;
        border-radius: 8px;
        background: #1b8a6b;
        color: #fff;
        padding: 5px 10px;
        font-size: 0.74rem;
        font-weight: 700;
        cursor: pointer;
      }
      :host ::ng-deep .open-report:hover {
        background: #167357;
      }
    `,
  ],
})
export class CityMapComponent implements AfterViewInit, OnDestroy {
  readonly reports = input.required<DogReport[]>();
  readonly filter = input<MapFilter>('all');
  readonly userLat = input<number | null>(null);
  readonly userLng = input<number | null>(null);
  readonly selectReport = output<string>();

  private readonly mapHost = viewChild.required<ElementRef<HTMLDivElement>>('mapHost');
  private readonly maps = inject(MapService);
  private readonly boundPopups = new WeakSet<HTMLElement>();
  private map?: L.Map;
  private clusterGroup?: L.MarkerClusterGroup;
  private userMarker?: L.Marker;

  constructor() {
    effect(() => {
      const reps = this.reports();
      const filter = this.filter();
      if (!this.map) return;
      this.updateMarkers(reps, filter);
    });

    effect(() => {
      const ulat = this.userLat();
      const ulng = this.userLng();
      if (ulat && ulng && this.map) {
        if (!this.userMarker) {
          const userIcon = L.divIcon({
            className: 'user-location-pin',
            html: '<div style="background:#1b8a6b; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow:0 0 6px rgba(0,0,0,0.4);"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
          this.userMarker = L.marker([ulat, ulng], { icon: userIcon }).addTo(this.map);
        } else {
          this.userMarker.setLatLng([ulat, ulng]);
        }
      }
    });
  }

  ngAfterViewInit(): void {
    const initialCenter: L.LatLngExpression = [
      this.userLat() ?? 4.711, 
      this.userLng() ?? -74.0721,
    ];

    this.map = this.maps.createMap(this.mapHost().nativeElement, initialCenter, 13);

    const LAny = L as unknown as { markerClusterGroup: () => L.MarkerClusterGroup };
    if (typeof LAny.markerClusterGroup === 'function') {
      this.clusterGroup = LAny.markerClusterGroup();
      this.map.addLayer(this.clusterGroup);
    }

    this.updateMarkers(this.reports(), this.filter());
    setTimeout(() => this.map?.invalidateSize(), 300);
  }

  private updateMarkers(reports: DogReport[], filter: MapFilter): void {
    if (!this.map) return;

    if (this.clusterGroup) {
      this.clusterGroup.clearLayers();
    } else {
      this.map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer !== this.userMarker) {
          this.map?.removeLayer(layer);
        }
      });
    }

    const bounds: L.LatLngExpression[] = [];
    const groups = groupReportsByDog(reports).filter((group) =>
      group.reports.some((report) => this.matchesFilter(report, filter)),
    );

    for (const group of groups) {
      
      const representative = group.initial.latitude && group.initial.longitude ? group.initial : group.latest;
      if (!representative.latitude || !representative.longitude) continue;

      const urgency = this.groupUrgency(group);
      const isAlert = urgency === 'critica' || urgency === 'alta';
      const emoji = urgency === 'critica' ? '🚨' : urgency === 'alta' ? '⚠️' : '🐶';
      const color = urgency === 'critica' ? '#e5383b' : urgency === 'alta' ? '#ff7a59' : '#3cc8a1';

      const marker = L.marker([representative.latitude, representative.longitude], {
        icon: this.maps.pinIcon(emoji, color, isAlert),
      });
      marker.bindPopup(this.popupHtml(group));
      marker.on('popupopen', (event: L.PopupEvent) => this.bindPopupActions(event.popup));

      if (this.clusterGroup) {
        this.clusterGroup.addLayer(marker);
      } else {
        marker.addTo(this.map);
      }

      bounds.push([representative.latitude, representative.longitude]);
    }

    if (bounds.length > 0 && !this.userLat()) {
      this.map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 15 });
    }
  }

  private matchesFilter(report: DogReport, filter: MapFilter): boolean {
    if (filter === 'alerts') return report.urgency_level === 'critica' || report.urgency_level === 'alta';
    if (filter === 'community') return report.urgency_level === 'normal';
    return true;
  }

  private groupUrgency(group: ReportGroup): DogReport['urgency_level'] {
    if (group.reports.some((report) => report.urgency_level === 'critica')) return 'critica';
    if (group.reports.some((report) => report.urgency_level === 'alta')) return 'alta';
    return 'normal';
  }

  private bindPopupActions(popup: L.Popup): void {
    const element = popup.getElement();
    if (!element || this.boundPopups.has(element)) return;
    this.boundPopups.add(element);
    element.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-report-id]');
      const reportId = button?.dataset['reportId'];
      if (reportId) this.selectReport.emit(reportId);
    });
  }

  private popupHtml(group: ReportGroup): string {
    const { initial, reports, dogId } = group;
    
    const title = initial.title?.trim() || 'Publicación sin título';
    const dog = initial.dogs;
    const dogName = dog?.name?.trim();
    const dogMeta = [dogName, dogId ? `ID ${dogId.slice(0, 8)}` : ''].filter(Boolean).join(' · ');
    const cover = initial.photo_url || dog?.photo_url || '';
    const coverHtml = cover
      ? `<img class="popup-cover" src="${escapeHtml(cover)}" alt="${escapeHtml(initial.title)}" />`
      : '<div class="popup-no-photo">🐶</div>';
    const countLabel = `${reports.length} ${reports.length === 1 ? 'publicación' : 'publicaciones'}`;

    return `
      <div class="paw-popup">
        ${coverHtml}
        <div class="popup-head">
          <h4>${escapeHtml(title)}</h4>
          ${dogMeta ? `<p class="popup-dog">🐶 ${escapeHtml(dogMeta)}</p>` : ''}
        </div>
        <div class="popup-meta">
          <span class="popup-chip">📍 ${escapeHtml(initial.zone || 'Sin sector')}</span>
          <span class="popup-chip">🗓️ ${escapeHtml(formatDateTime(initial.found_at))}</span>
        </div>
        <div class="popup-meta" style="margin-top: -2px;">
          <span class="popup-chip" style="background:#d7f3e4; color:#146b45;">${escapeHtml(countLabel)}</span>
        </div>
        <p class="popup-summary">
          <b>${escapeHtml(initial.breed)}</b> · ${escapeHtml(labelOf(SIZE_OPTIONS, initial.size))}<br />
          ${escapeHtml(this.short(initial.description))}
        </p>
        <div class="popup-section">Historial de esta alerta</div>
        <div class="popup-cards">
          ${reports.map((report) => this.reportCardHtml(report)).join('')}
        </div>
      </div>
    `;
  }

  private reportCardHtml(report: DogReport): string {
    const urls = report.photos?.map((photo) => photo.photo_url).filter(Boolean) ?? [];
    const photos = urls.length ? urls : [report.photo_url].filter(Boolean);
    const shown = photos.slice(0, 3);
    const photosHtml = shown.length
      ? `<div class="card-photos">${shown
          .map((url) => `<img src="${escapeHtml(url)}" alt="${escapeHtml(report.title)}" />`)
          .join('')}${
          photos.length > shown.length ? `<span class="card-photo-more">+${photos.length - shown.length}</span>` : ''
        }</div>`
      : '';

    const author = report.profiles?.display_name?.trim() || 'Usuario';
    const avatar = report.profiles?.avatar_url;
    const avatarHtml = avatar
      ? `<img class="avatar" src="${escapeHtml(avatar)}" alt="${escapeHtml(author)}" />`
      : `<span class="avatar-fallback">${escapeHtml(author.charAt(0).toUpperCase())}</span>`;

    return `
      <article class="report-card">
        ${photosHtml}
        <div class="card-head">
          ${avatarHtml}
          <div>
            <div class="card-author">${escapeHtml(author)}</div>
            <div class="card-date">${escapeHtml(formatDateTime(report.found_at))}</div>
          </div>
        </div>
        <h5 class="card-title">${escapeHtml(report.title?.trim() || 'Publicación sin título')}</h5>
        <p class="card-desc">${escapeHtml(this.short(report.description))}</p>
        <div class="card-foot">
          <span class="status-pill status-${escapeHtml(report.report_status)}">${escapeHtml(
            labelOf(STATUS_OPTIONS, report.report_status),
          )}</span>
          <button type="button" class="open-report" data-report-id="${escapeHtml(report.id)}">
            Ver reporte
          </button>
        </div>
      </article>
    `;
  }

  private short(value: string | null | undefined, max = 150): string {
    const text = (value ?? '').trim();
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  recenter(lat: number, lon: number): void {
    this.map?.setView([lat, lon], 16);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
