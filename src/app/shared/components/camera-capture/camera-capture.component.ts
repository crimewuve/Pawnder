import type { AfterViewInit, ElementRef, OnDestroy} from '@angular/core';
import { Component, inject, signal, viewChild } from '@angular/core';
import { IonButton, IonIcon, IonSpinner, ModalController } from '@ionic/angular';
import { cameraReverseOutline, close } from 'ionicons/icons';

@Component({
  selector: 'app-camera-capture',
  imports: [IonButton, IonIcon, IonSpinner],
  template: `
    <div class="cam">
      <video #video playsinline muted autoplay></video>

      @if (loading()) {
        <div class="overlay"><ion-spinner name="crescent" color="light"></ion-spinner><p>Abriendo cámara…</p></div>
      }
      @if (error()) {
        <div class="overlay">
          <p>{{ error() }}</p>
          <ion-button (click)="useSystemCamera()">Usar la cámara del teléfono</ion-button>
          <ion-button fill="outline" color="light" (click)="cancel()">Cancelar</ion-button>
        </div>
      }

      <div class="bar">
        <ion-button fill="clear" color="light" (click)="cancel()">
          <ion-icon slot="icon-only" [icon]="closeIcon"></ion-icon>
        </ion-button>
        <button class="shutter" type="button" aria-label="Tomar fotografía"
          [disabled]="!ready()" (click)="capture()"></button>
        <ion-button fill="clear" color="light" [disabled]="!ready()" (click)="flip()">
          <ion-icon slot="icon-only" [icon]="flipIcon"></ion-icon>
        </ion-button>
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; height: 100%; background: #000; }
      .cam { position: relative; width: 100%; height: 100%; background: #000; }
      video { width: 100%; height: 100%; object-fit: cover; }
      .overlay { position: absolute; inset: 0; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 10px; padding: 24px;
        text-align: center; color: #fff; background: rgba(0, 0, 0, 0.75); }
      .bar { position: absolute; left: 0; right: 0; bottom: 0; display: flex;
        align-items: center; justify-content: space-between;
        padding: 16px 24px calc(20px + env(safe-area-inset-bottom));
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.6)); }
      .shutter { width: 74px; height: 74px; border-radius: 50%; border: 5px solid #fff;
        background: #ffffffcc; }
      .shutter:disabled { opacity: 0.4; }
      .shutter:active { background: #fff; }
    `,
  ],
})
export class CameraCaptureComponent implements AfterViewInit, OnDestroy {
  private readonly modal = inject(ModalController);
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  protected readonly closeIcon = close;
  protected readonly flipIcon = cameraReverseOutline;
  protected readonly loading = signal(true);
  protected readonly ready = signal(false);
  protected readonly error = signal('');

  private stream?: MediaStream;
  private facing: 'environment' | 'user' = 'environment';

  async ngAfterViewInit(): Promise<void> {
    await this.start();
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private async start(): Promise<void> {
    this.stop();
    this.loading.set(true);
    this.ready.set(false);
    this.error.set('');

    if (!navigator.mediaDevices?.getUserMedia) {
      this.error.set('Este dispositivo no permite usar la cámara dentro de la app.');
      this.loading.set(false);
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: this.facing }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      const video = this.video().nativeElement;
      video.srcObject = this.stream;
      await video.play();
      this.ready.set(true);
    } catch (e) {
      this.error.set(this.describe(e));
    } finally {
      this.loading.set(false);
    }
  }

  private stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
  }

  private describe(e: unknown): string {
    const name = (e as { name?: string })?.name ?? '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'No hay permiso para usar la cámara. Actívalo en Ajustes > Aplicaciones > Pawnder > Permisos.';
    }
    if (name === 'NotFoundError') return 'No se encontró ninguna cámara en este dispositivo.';
    if (name === 'NotReadableError') return 'La cámara está siendo usada por otra aplicación.';
    return 'No se pudo abrir la cámara integrada.';
  }

  protected async flip(): Promise<void> {
    this.facing = this.facing === 'environment' ? 'user' : 'environment';
    await this.start();
  }

  protected async capture(): Promise<void> {
    const video = this.video().nativeElement;
    if (!video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    );
    if (!blob) {
      this.error.set('No se pudo capturar la imagen. Inténtalo de nuevo.');
      return;
    }
    this.stop();
    await this.modal.dismiss({ blob, webPath: URL.createObjectURL(blob) }, 'captured');
  }

  protected async useSystemCamera(): Promise<void> {
    this.stop();
    await this.modal.dismiss(null, 'fallback');
  }

  protected async cancel(): Promise<void> {
    this.stop();
    await this.modal.dismiss(null, 'cancel');
  }
}
