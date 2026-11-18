import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem } from '@capacitor/filesystem';
import { ModalController } from '@ionic/angular';
import { CameraCaptureComponent } from '../../shared/components/camera-capture/camera-capture.component';
import { HardwareError } from '../utils/hardware-error';

export interface CapturedPhoto {
  webPath: string;
  blob: Blob;
}

const DENIED_MSG =
  'Pawnder necesita permiso de cámara para fotografiar al perro. ' +
  'Actívalo en Ajustes > Aplicaciones > Pawnder > Permisos.';

@Injectable({ providedIn: 'root' })
export class CameraService {
  private readonly modalCtrl = inject(ModalController);

  /** Cámara integrada en la app (vista previa dentro de un modal) */
  async takePhoto(): Promise<CapturedPhoto> {
    await this.ensurePermission();

    const modal = await this.modalCtrl.create({
      component: CameraCaptureComponent,
      backdropDismiss: false,
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<CapturedPhoto | null>();

    if (role === 'captured' && data) return data;
    if (role === 'fallback') return this.fromPlugin(CameraSource.Camera);
    throw new HardwareError('cancelled', 'Captura cancelada.');
  }

  /** Selector de fotos del teléfono (Capacitor Camera) */
  pickFromGallery(): Promise<CapturedPhoto> {
    return this.fromPlugin(CameraSource.Photos);
  }

  private async fromPlugin(source: CameraSource): Promise<CapturedPhoto> {
    let photo: Photo;
    try {
      photo = await Camera.getPhoto({
        quality: 80,
        width: 1280,
        allowEditing: false,
        correctOrientation: true,
        resultType: CameraResultType.Uri,
        source,
        webUseInput: true, // solo afecta al navegador
      });
    } catch (e) {
      throw this.mapError(e);
    }
    if (!photo.webPath) {
      throw new HardwareError('unknown', 'No se recibió ninguna imagen.');
    }
    return { webPath: photo.webPath, blob: await this.toBlob(photo) };
  }

  private async ensurePermission(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      let status = await Camera.checkPermissions();
      if (status.camera !== 'granted') {
        status = await Camera.requestPermissions({ permissions: ['camera'] });
      }
      if (status.camera !== 'granted') {
        throw new HardwareError('denied', DENIED_MSG);
      }
    } catch (e) {
      throw this.mapError(e);
    }
  }

  private async toBlob(photo: Photo): Promise<Blob> {
    if (Capacitor.isNativePlatform() && photo.path) {
      try {
        const file = await Filesystem.readFile({ path: photo.path });
        if (typeof file.data === 'string') {
          return this.base64ToBlob(file.data, 'image/jpeg');
        }
        return file.data;
      } catch {
        // si falla, se intenta con fetch
      }
    }
    const response = await fetch(photo.webPath as string);
    return await response.blob();
  }

  private base64ToBlob(base64: string, type: string): Blob {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type });
  }

  private mapError(e: unknown): HardwareError {
    if (e instanceof HardwareError) return e;
    const message = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase();
    if (message.includes('cancel')) return new HardwareError('cancelled', 'Captura cancelada.');
    if (message.includes('denied') || message.includes('permission')) {
      return new HardwareError('denied', DENIED_MSG);
    }
    return new HardwareError('unknown', 'No se pudo obtener la fotografía. Inténtalo de nuevo.');
  }
}
