import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

export interface GeocodeResult {
  displayName: string;
  zone: string;
}

interface NominatimResponse {
  display_name?: string;
  address?: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly http = inject(HttpClient);
  private readonly url = 'https://nominatim.openstreetmap.org/reverse';

  reverse(latitude: number, longitude: number): Observable<GeocodeResult | null> {
    const params = new HttpParams()
      .set('format', 'jsonv2')
      .set('lat', latitude.toFixed(6))
      .set('lon', longitude.toFixed(6))
      .set('zoom', '18')
      .set('addressdetails', '1')
      .set('accept-language', 'es');

    return this.http.get<NominatimResponse>(this.url, { params }).pipe(
      map((res) => {
        const a = res.address ?? {};
        const zone =
          a['neighbourhood'] ?? a['suburb'] ?? a['quarter'] ?? a['city_district'] ??
          a['village'] ?? a['town'] ?? a['city'] ?? '';
        const city = a['city'] ?? a['town'] ?? a['village'] ?? a['municipality'] ?? '';
        const parts = [a['road'], zone, city].filter(
          (p, i, arr): p is string => !!p && arr.indexOf(p) === i
        );
        return {
          displayName: parts.length ? parts.join(', ') : (res.display_name ?? ''),
          zone,
        };
      }),
      // Es información de ayuda: si falla, el usuario escribe el sector a mano
      catchError(() => of(null))
    );
  }
}
