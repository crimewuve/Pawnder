import type {
  AfterViewInit, ElementRef, OnDestroy} from '@angular/core';
import { Component, effect, inject, input, output, viewChild,
} from '@angular/core';
import * as L from 'leaflet';

import { MapService } from '../../../core/services/map.service';

@Component({
  selector: 'app-mini-map',
  template: `<div #host class="mini-map"></div>`,
  styles: [
    `
      :host { display: block; }
      .mini-map { height: 240px; border-radius: 16px; overflow: hidden;
        isolation: isolate; border: 1px solid #d9d2c8; }
    `,
  ],
})
export class MiniMapComponent implements AfterViewInit, OnDestroy {
  readonly lat = input.required<number>();
  readonly lon = input.required<number>();
  readonly editable = input(true);
  readonly isApproximate = input(false);
  readonly moved = output<{ latitude: number; longitude: number }>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly maps = inject(MapService);
  private map?: L.Map;
  private marker?: L.Marker;
  private circle?: L.Circle;

  constructor() {
    effect(() => {
      const lat = this.lat();
      const lon = this.lon();
      const approx = this.isApproximate();
      if (!this.map) return;
      const position = L.latLng(lat, lon);
      this.updateDisplay(position, approx);
      this.map.setView(position, this.map.getZoom());
    });
  }

  ngAfterViewInit(): void {
    const center: L.LatLngExpression = [this.lat(), this.lon()];
    this.map = this.maps.createMap(this.host().nativeElement, center, 16);

    this.updateDisplay(L.latLng(this.lat(), this.lon()), this.isApproximate());

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (!this.editable()) return;
      this.moved.emit({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    });

    setTimeout(() => this.map?.invalidateSize(), 300);
  }

  private updateDisplay(position: L.LatLng, approx: boolean): void {
    if (!this.map) return;

    if (approx) {
      if (this.marker) {
        this.map.removeLayer(this.marker);
        this.marker = undefined;
      }
      if (!this.circle) {
        this.circle = L.circle(position, {
          radius: 350,
          color: '#3cc8a1',
          fillColor: '#3cc8a1',
          fillOpacity: 0.25,
          weight: 2,
        }).addTo(this.map);
      } else {
        this.circle.setLatLng(position);
      }
    } else {
      if (this.circle) {
        this.map.removeLayer(this.circle);
        this.circle = undefined;
      }
      if (!this.marker) {
        this.marker = L.marker(position, {
          icon: this.maps.pinIcon('🐶', '#3cc8a1'),
          draggable: this.editable(),
        }).addTo(this.map);

        this.marker.on('dragend', () => {
          const p = this.marker!.getLatLng();
          this.moved.emit({ latitude: p.lat, longitude: p.lng });
        });
      } else {
        this.marker.setLatLng(position);
      }
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
