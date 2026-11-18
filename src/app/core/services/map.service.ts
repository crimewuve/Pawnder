import { Injectable } from '@angular/core';
import * as L from 'leaflet';

export const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

@Injectable({ providedIn: 'root' })
export class MapService {
  createMap(element: HTMLElement, center: L.LatLngExpression, zoom = 16): L.Map {
    const map = L.map(element).setView(center, zoom);
    L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map);
    return map;
  }

  /** Pin con emoji y color (los estilos están en global.scss) */
  pinIcon(emoji: string, color: string, isAlert = false): L.DivIcon {
    return L.divIcon({
      className: `pawn-pin ${isAlert ? 'alert-pin' : ''}`,
      html: `<div class="pin" style="background:${color}"><span>${emoji}</span></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 38],
      popupAnchor: [0, -34],
    });
  }
}
