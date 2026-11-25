import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable} from 'rxjs';
import { catchError, map, throwError } from 'rxjs';

import type { OpenMeteoResponse, WeatherSnapshot } from '../../models/weather.model';
import { describeHttpError } from '../utils/http-error';

export interface WeatherInterpretation {
  emoji: string;
  label: string;
}

export function interpretWeather(
  code: number,
  temperature: number,
  precipitation: number
): WeatherInterpretation {
  if (code >= 95) return { emoji: '🐶⛈️🆘', label: 'Tormenta eléctrica' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { emoji: '🐶❄️🥶', label: 'Nieve' };
  }
  if (temperature >= 33) return { emoji: '🐶🥵🌡️', label: 'Calor intenso' };
  if (temperature <= 8) return { emoji: '🐶🥶🌡️', label: 'Frío intenso' };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || precipitation > 0.2) {
    return { emoji: '🐶🌧️🥺', label: code >= 51 && code <= 57 ? 'Llovizna' : 'Lluvia' };
  }
  if (code === 45 || code === 48) return { emoji: '🐶🌫️😶', label: 'Niebla' };
  if (code === 2) return { emoji: '🐶☁️😟', label: 'Parcialmente nublado' };
  if (code === 3) return { emoji: '🐶☁️😟', label: 'Nublado' };
  return { emoji: '🐶☀️😊', label: 'Despejado' };
}


export function weatherSummary(w: {
  weather_description: string | null;
  temperature: number | null;
  humidity: number | null;
  wind_speed: number | null;
  precipitation: number | null;
}): string {
  if (w.temperature === null || !w.weather_description) {
    return 'Clima no registrado';
  }
  return (
    `${w.weather_description} · ${Number(w.temperature).toFixed(1)} °C` +
    ` · humedad ${Math.round(Number(w.humidity ?? 0))}%` +
    ` · viento ${Number(w.wind_speed ?? 0).toFixed(1)} km/h` +
    ` · lluvia ${Number(w.precipitation ?? 0).toFixed(1)} mm`
  );
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private readonly http = inject(HttpClient);
  private readonly url = 'https://api.open-meteo.com/v1/forecast';

  getCurrent(latitude: number, longitude: number): Observable<WeatherSnapshot> {
    const params = new HttpParams()
      .set('latitude', latitude.toFixed(5))
      .set('longitude', longitude.toFixed(5))
      .set(
        'current',
        'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m'
      )
      .set('timezone', 'auto');

    return this.http.get<OpenMeteoResponse>(this.url, { params }).pipe(
      map((res) => {
        const c = res.current;
        const info = interpretWeather(c.weather_code, c.temperature_2m, c.precipitation);
        const snapshot: WeatherSnapshot = {
          weather_code: c.weather_code,
          weather_description: info.label,
          weather_emoji: info.emoji,
          temperature: c.temperature_2m,
          humidity: c.relative_humidity_2m,
          precipitation: c.precipitation,
          wind_speed: c.wind_speed_10m,
        };
        return snapshot;
      }),
      catchError((err) => throwError(() => new Error(describeHttpError(err, 'el servicio del clima'))))
    );
  }
}