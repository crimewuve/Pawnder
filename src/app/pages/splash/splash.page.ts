import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { paw } from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-splash',
  imports: [IonContent, IonIcon],
  template: `
    <ion-content [fullscreen]="true">
      <div class="splash">
        <div class="logo"><ion-icon [icon]="paw"></ion-icon></div>
        <h1>Pawnder</h1>
        <p>Cada huella cuenta</p>
      </div>
    </ion-content>
  `,
  styles: [
    `
      ion-content {
        --background: linear-gradient(160deg, #c9f3e4 0%, #fff8ee 65%);
      }
      .splash {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 6px;
      }
      .logo {
        width: 120px;
        height: 120px;
        border-radius: 36px;
        background: var(--ion-color-primary);
        color: var(--ion-color-primary-contrast);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 64px;
        box-shadow: 0 10px 30px rgba(60, 200, 161, 0.45);
        animation: pulse 1.6s ease-in-out infinite;
      }
      h1 {
        margin: 18px 0 0;
        font-size: 2.2rem;
        font-weight: 800;
        color: #1b6b53;
        letter-spacing: -0.5px;
      }
      p {
        margin: 0;
        color: #6b625b;
      }
      @keyframes pulse {
        0%,
        100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.07);
        }
      }
    `,
  ],
})
export class SplashPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly paw = paw;

  async ngOnInit(): Promise<void> {
    // Espera a recuperar la sesión guardada y a que se vea la animación
    await Promise.all([this.auth.whenReady(), new Promise((r) => setTimeout(r, 1800))]);
    await this.router.navigateByUrl(this.auth.isLoggedIn() ? '/menu' : '/menu', {
      replaceUrl: true,
    });
  }
}