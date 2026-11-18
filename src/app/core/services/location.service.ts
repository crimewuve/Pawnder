import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { HardwareError } from '../utils/hardware-error';

export interface GpsFix {
  latitude: number;
  longitude: number;
  accuracy: number;
}

const DENIED_MSG =
  'Sin permiso de ubicación. Actívalo en Ajustes > Aplicaciones > Pawnder > Permisos ' +
  'y vuelve a intentarlo.';

@Injectable({ providedIn: 'root' })
export class LocationService {
  async getCurrentFix(): Promise<GpsFix> {
    try {
      if (Capacitor.isNativePlatform()) {
        let status = await Geolocation.checkPermissions();
        if (status.location !== 'granted' && status.coarseLocation !== 'granted') {
          status = await Geolocation.requestPermissions({ permissions: ['location'] });
        }
        if (status.location !== 'granted' && status.coarseLocation !== 'granted') {
          throw new HardwareError('denied', DENIED_MSG);
        }
      }
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } catch (e) {
      throw this.mapError(e);
    }
  }

  private mapError(e: unknown): HardwareError {
    if (e instanceof HardwareError) return e;
    const err = e as { code?: string | number; message?: string };
    const code = String(err?.code ?? '');
    const message = (err?.message ?? String(e ?? '')).toLowerCase();

    if (code === 'OS-PLUG-GLOC-0003' || code === '1' || message.includes('denied')) {
      return new HardwareError('denied', DENIED_MSG);
    }
    if (
      ['OS-PLUG-GLOC-0007', 'OS-PLUG-GLOC-0009', 'OS-PLUG-GLOC-0016', 'OS-PLUG-GLOC-0017'].includes(code) ||
      code === '2' ||
      message.includes('not enabled') ||
      message.includes('unavailable')
    ) {
      return new HardwareError(
        'unavailable',
        'El GPS está desactivado. Actívalo en los ajustes del teléfono y vuelve a intentarlo.'
      );
    }
    if (code === 'OS-PLUG-GLOC-0010' || code === '3' || message.includes('time')) {
      return new HardwareError(
        'timeout',
        'No se pudo obtener la ubicación a tiempo. Sal a un lugar abierto e inténtalo de nuevo.'
      );
    }
    if (code === 'OS-PLUG-GLOC-0018') {
      return new HardwareError(
        'unknown',
        'La app no tiene declarados los permisos de ubicación en AndroidManifest.xml.'
      );
    }
    return new HardwareError('unknown', 'No se pudo obtener la ubicación. Inténtalo de nuevo.');
  }
}