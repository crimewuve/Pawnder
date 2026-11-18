import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { MapService } from '../../../core/services/map.service';
import { DogReport } from '../../../models/dog-report.model';

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
      :host ::ng-deep .popup-card {
        padding: 4px;
        max-width: 200px;
      }
      :host ::ng-deep .popup-card img {
        width: 100%;
        height: 110px;
        object-fit: cover;
        border-radius: 8px;
        margin-bottom: 6px;
      }
      :host ::ng-deep .popup-card h4 {
        margin: 2px 0 4px;
        font-size: 0.95rem;
        font-weight: 700;
        color: #1b6b53;
      }
      :host ::ng-deep .popup-card .urgency-tag {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.72rem;
        font-weight: bold;
        color: #fff;
        margin-bottom: 4px;
      }
      :host ::ng-deep .popup-card .urgency-tag.critica {
        background: #e5383b;
      }
      :host ::ng-deep .popup-card .urgency-tag.alta {
        background: #ff7a59;
      }
      :host ::ng-deep .popup-card .urgency-tag.normal {
        background: #3cc8a1;
      }
      :host ::ng-deep .popup-card p {
        margin: 2px 0;
        font-size: 0.8rem;
        color: #555;
      }
      :host ::ng-deep .popup-card button {
        margin-top: 6px;
        width: 100%;
        padding: 5px 8px;
        background: #1b8a6b;
        color: #fff;
        border: none;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
      }
    `,
  ],
})
export class CityMapComponent implements AfterViewInit, OnDestroy {
  readonly reports = input.required<DogReport[]>();
  readonly userLat = input<number | null>(null);
  readonly userLng = input<number | null>(null);
  readonly selectReport = output<string>();

  private readonly mapHost = viewChild.required<ElementRef<HTMLDivElement>>('mapHost');
  private readonly maps = inject(MapService);
  private map?: L.Map;
  private clusterGroup?: L.MarkerClusterGroup;
  private userMarker?: L.Marker;

  constructor() {
    effect(() => {
      const reps = this.reports();
      if (!this.map) return;
      this.updateMarkers(reps);
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
      this.userLat() ?? 4.711, // Bogotá por defecto
      this.userLng() ?? -74.0721,
    ];

    this.map = this.maps.createMap(this.mapHost().nativeElement, initialCenter, 13);

    // Inicializar agrupación de marcadores (MarkerCluster)
    const LAny = L as unknown as { markerClusterGroup: () => L.MarkerClusterGroup };
    if (typeof LAny.markerClusterGroup === 'function') {
      this.clusterGroup = LAny.markerClusterGroup();
      this.map.addLayer(this.clusterGroup);
    }

    this.updateMarkers(this.reports());
    setTimeout(() => this.map?.invalidateSize(), 300);
  }

  private updateMarkers(reports: DogReport[]): void {
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

    for (const r of reports) {
      if (!r.latitude || !r.longitude) continue;

      const isAlert = r.urgency_level === 'critica' || r.urgency_level === 'alta';
      const emoji = r.urgency_level === 'critica' ? '🚨' : r.urgency_level === 'alta' ? '⚠️' : '🐶';
      const color =
        r.urgency_level === 'critica'
          ? '#e5383b'
          : r.urgency_level === 'alta'
          ? '#ff7a59'
          : '#3cc8a1';

      const icon = this.maps.pinIcon(emoji, color, isAlert);
      const marker = L.marker([r.latitude, r.longitude], { icon });

      const approxText = r.is_approximate_location
        ? '<div style="font-size:0.75rem; color:#6b625b; margin-top:2px;">🛡️ Zona aproximada (Mascota protegida)</div>'
        : '';

      const popupHtml = `
        <div class="popup-card">
          <img src="${r.photo_url}" alt="${r.title}" />
          <span class="urgency-tag ${r.urgency_level}">${r.urgency_level === 'critica' ? '🚨 Alerta Crítica' : r.urgency_level === 'alta' ? '⚠️ Necesita Ayuda' : '🐾 Mascota / Amigable'}</span>
          <h4>${r.title}</h4>
          <p><b>Raza:</b> ${r.breed}</p>
          <p>📍 ${r.zone || 'Sin sector'}</p>
          ${approxText}
          <button id="btn-popup-${r.id}">Ver detalles</button>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-popup-${r.id}`);
        if (btn) {
          btn.onclick = () => this.selectReport.emit(r.id);
        }
      });

      if (this.clusterGroup) {
        this.clusterGroup.addLayer(marker);
      } else {
        marker.addTo(this.map);
      }

      bounds.push([r.latitude, r.longitude]);
    }

    if (bounds.length > 0 && !this.userLat()) {
      this.map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 15 });
    }
  }

  recenter(lat: number, lon: number): void {
    this.map?.setView([lat, lon], 16);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
