import type { OnInit } from '@angular/core';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-splash',
  imports: [IonContent],
  template: `
    <ion-content [fullscreen]="true">
      <div class="splash">
        <img class="brand-logo" src="assets/icon/favicon.png" alt="PAWNDER" />
        <h1>PAWNDER</h1>
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
      .brand-logo {
        width: 120px;
        height: 120px;
        border-radius: 30px;
        object-fit: contain;
        animation: pulse 1.6s ease-in-out infinite;
      }
      h1 {
        margin: 18px 0 0;
        font-size: 2rem;
        font-weight: 800;
        color: #1b6b53;
        letter-spacing: 0.16em;
        text-shadow: 0 2px 0 rgba(255, 255, 255, 0.7);
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

  async ngOnInit(): Promise<void> {
    // Espera a recuperar la sesión guardada y a que se vea la animación
    await Promise.all([this.auth.whenReady(), new Promise((r) => setTimeout(r, 1800))]);
    await this.router.navigateByUrl(this.auth.isLoggedIn() ? '/menu' : '/menu', {
      replaceUrl: true,
    });
  }
}
