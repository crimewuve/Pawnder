import { Injectable, inject } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';

type ToastColor = 'success' | 'danger' | 'warning' | 'medium';

/** Mensajes, alertas y confirmaciones reutilizables en toda la app */
@Injectable({ providedIn: 'root' })
export class UiService {
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);

  async toast(message: string, color: ToastColor = 'medium', duration = 2800): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration,
      color,
      position: 'top',
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await toast.present();
  }

  async notice(header: string, message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['Entendido'],
    });
    await alert.present();
    await alert.onDidDismiss();
  }

  /** Devuelve true si el usuario confirma */
  async confirm(header: string, message: string, confirmText = 'Aceptar'): Promise<boolean> {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: confirmText, role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }
}