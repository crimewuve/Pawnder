import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonIcon, IonToolbar } from '@ionic/angular';
import {
  addCircleOutline,
  bookOutline,
  chevronForwardOutline,
  heart,
  logInOutline,
  logOutOutline,
  mapOutline,
  personOutline,
  sparkles,
} from 'ionicons/icons';

import { AuthService } from '../../core/services/auth.service';
import { UiService } from '../../core/services/ui.service';

@Component({
  selector: 'app-main-menu',
  imports: [IonHeader, IonToolbar, IonContent, IonButton, IonIcon],
  template: `
    <ion-header class="ion-no-border header-transparent">
      <ion-toolbar>
        <div slot="start" class="brand-badge">
          <img class="brand-mini-logo" src="assets/icon/favicon.png" alt="" />
          <span class="brand-title">PAWNDER</span>
        </div>
        <div slot="end" class="auth-btn">
          @if (auth.isLoggedIn()) {
            <ion-button fill="clear" color="dark" class="user-chip" (click)="goTo('/profile')">
              <div class="user-avatar">{{ auth.displayName().charAt(0).toUpperCase() }}</div>
            </ion-button>
            <ion-button fill="clear" color="dark" class="logout-chip" aria-label="Cerrar sesión" (click)="logout()">
              <ion-icon slot="icon-only" [icon]="logOutOutline"></ion-icon>
            </ion-button>
          } @else {
            <ion-button fill="outline" color="primary" class="login-pill" (click)="goLogin()">
              <ion-icon slot="start" [icon]="logInOutline"></ion-icon> Entrar
            </ion-button>
          }
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true" class="menu-content">
      <div class="menu-container">
        
        <div class="hero-section">
          <div class="hero-visual">
            <div class="paw-badge-glow"></div>
            <div class="paw-badge">
              <img src="assets/icon/favicon.png" alt="" />
            </div>
            <div class="sparkle-tag">
              <ion-icon [icon]="sparkles"></ion-icon>
              <span>Comunidad Canina</span>
            </div>
          </div>
          <h1>Descubre & Rescata</h1>
          <p class="tagline">Cada huella tiene una historia 🐶</p>
          <p class="welcome-user">
            @if (auth.isLoggedIn()) {
              ¡Hola, <b>{{ auth.displayName() }}</b>! Explora los perros de la comunidad o ayuda a un perro en
              necesidad.
            } @else {
              Únete a la red donde descubres, compartes y rescatas perritos en tu ciudad.
            }
          </p>
        </div>

        
        <div class="options-grid">
          
          <div
            class="menu-card map-card"
            role="button"
            tabindex="0"
            (click)="goTo('/map-view')"
            (keydown.enter)="goTo('/map-view')"
            (keydown.space)="goTo('/map-view')"
          >
            <div class="card-icon map-icon">
              <ion-icon [icon]="mapOutline"></ion-icon>
            </div>
            <div class="card-info">
              <div class="card-header-row">
                <h3>Mapa & Explorar</h3>
                <span class="badge-accent green-accent">En vivo</span>
              </div>
              <p>Ubica perritos en tu zona geográfica y monitorea alertas de rescate con GPS.</p>
            </div>
            <ion-icon [icon]="chevronForwardOutline" class="arrow-icon"></ion-icon>
          </div>

          
          <div
            class="menu-card share-card"
            role="button"
            tabindex="0"
            (click)="goCreate()"
            (keydown.enter)="goCreate()"
            (keydown.space)="goCreate()"
          >
            <div class="card-icon share-icon">
              <ion-icon [icon]="addCircleOutline"></ion-icon>
            </div>
            <div class="card-info">
              <div class="card-header-row">
                <h3>Compartir</h3>
                <span class="badge-accent coral-accent">+ Registro</span>
              </div>
              <p>Publica a tu mascota con ubicación protegida o reporta un caso de rescate.</p>
            </div>
            <ion-icon [icon]="chevronForwardOutline" class="arrow-icon"></ion-icon>
          </div>

          
          <div
            class="menu-card library-card"
            role="button"
            tabindex="0"
            (click)="goTo('/home')"
            (keydown.enter)="goTo('/home')"
            (keydown.space)="goTo('/home')"
          >
            <div class="card-icon library-icon">
              <ion-icon [icon]="bookOutline"></ion-icon>
            </div>
            <div class="card-info">
              <div class="card-header-row">
                <h3>Directorio Canino</h3>
                <span class="badge-accent amber-accent">Directorio</span>
              </div>
              <p>Explora perritos clasificados por raza con IA, fotografías y fichas de salud.</p>
            </div>
            <ion-icon [icon]="chevronForwardOutline" class="arrow-icon"></ion-icon>
          </div>

          
          @if (auth.isLoggedIn()) {
            <div
              class="menu-card profile-card"
              role="button"
              tabindex="0"
              (click)="goTo('/profile')"
              (keydown.enter)="goTo('/profile')"
              (keydown.space)="goTo('/profile')"
            >
              <div class="card-icon profile-icon">
                <ion-icon [icon]="personOutline"></ion-icon>
              </div>
              <div class="card-info">
                <div class="card-header-row">
                  <h3>Mi perfil</h3>
                  <span class="badge-accent green-accent">Tu espacio</span>
                </div>
                <p>Tu foto, tu biografía y todas tus publicaciones en un solo lugar.</p>
              </div>
              <ion-icon [icon]="chevronForwardOutline" class="arrow-icon"></ion-icon>
            </div>
          }
        </div>

        
        <div class="menu-footer">
          <span>Hecho con amor canino</span>
          <ion-icon [icon]="heart" class="heart-icon"></ion-icon>
          <span>para la comunidad</span>
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .header-transparent {
        --background: #faf6f0;
        padding-top: 4px;
      }
      .brand-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-left: 16px;
      }
      .brand-mini-logo {
        width: 32px;
        height: 32px;
        border-radius: 10px;
        object-fit: contain;
      }
      .brand-title {
        font-size: 1.2rem;
        font-weight: 800;
        color: #065f46;
        letter-spacing: -0.02em;
      }
      .login-pill {
        --border-radius: 999px;
        font-weight: 700;
        font-size: 0.85rem;
        height: 34px;
      }
      .user-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #e0e7ff;
        color: #3730a3;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 6px;
      }
      .logout-chip {
        --padding-start: 0;
        --padding-end: 10px;
        font-size: 1.05rem;
      }

      .menu-content {
        --background: linear-gradient(180deg, #faf6f0 0%, #f3ede2 100%);
      }
      .menu-container {
        padding: 10px 20px 40px;
        max-width: 520px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-height: 100%;
      }
      .hero-section {
        text-align: center;
        margin-bottom: 30px;
      }
      .hero-visual {
        position: relative;
        width: 104px;
        height: 104px;
        margin: 0 auto 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .paw-badge-glow {
        position: absolute;
        inset: -8px;
        border-radius: 36px;
        background: radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, rgba(16, 185, 129, 0) 70%);
        animation: pulse-glow 2.4s infinite ease-in-out;
      }
      @keyframes pulse-glow {
        0%,
        100% {
          opacity: 0.6;
          transform: scale(0.96);
        }
        50% {
          opacity: 1;
          transform: scale(1.08);
        }
      }
      .paw-badge {
        position: relative;
        width: 90px;
        height: 90px;
        border-radius: 30px;
        background: #ffffff;
        overflow: hidden;
        box-shadow: 0 12px 28px rgba(16, 185, 129, 0.2);
      }
      .paw-badge img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .sparkle-tag {
        position: absolute;
        bottom: -6px;
        background: #111827;
        color: #ffffff;
        font-size: 0.68rem;
        font-weight: 800;
        padding: 3px 10px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        gap: 4px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
      }
      .sparkle-tag ion-icon {
        color: #fbbf24;
      }

      h1 {
        margin: 0;
        font-size: 2.3rem;
        font-weight: 800;
        color: #064e3b;
        letter-spacing: -0.03em;
      }
      .tagline {
        margin: 4px 0 10px;
        color: #f97316;
        font-weight: 700;
        font-size: 1.05rem;
      }
      .welcome-user {
        margin: 0 auto;
        max-width: 360px;
        color: #6b7280;
        font-size: 0.92rem;
        line-height: 1.45;
      }

      .options-grid {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .menu-card {
        background: #ffffff;
        border-radius: 24px;
        padding: 18px 20px;
        display: flex;
        align-items: center;
        gap: 18px;
        box-shadow: var(--pw-shadow-soft);
        border: 1px solid rgba(229, 231, 235, 0.8);
        cursor: pointer;
        transition:
          transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
          box-shadow 0.2s ease;
      }
      .menu-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--pw-shadow-hover);
      }
      .menu-card:active {
        transform: scale(0.98);
      }

      .card-icon {
        width: 60px;
        height: 60px;
        border-radius: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 30px;
        flex-shrink: 0;
      }
      .map-icon {
        background: #ecfdf5;
        color: #059669;
      }
      .share-icon {
        background: #fff7ed;
        color: #ea580c;
      }
      .library-icon {
        background: #eff6ff;
        color: #2563eb;
      }
      .profile-icon {
        background: #fdf4ff;
        color: #a21caf;
      }

      .card-info {
        flex: 1;
      }
      .card-header-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }
      .card-info h3 {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 800;
        color: #111827;
      }
      .badge-accent {
        font-size: 0.65rem;
        font-weight: 800;
        padding: 2px 7px;
        border-radius: 6px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .green-accent {
        background: #d1fae5;
        color: #065f46;
      }
      .coral-accent {
        background: #ffedd5;
        color: #9a3412;
      }
      .amber-accent {
        background: #dbeafe;
        color: #1e40af;
      }

      .card-info p {
        margin: 0;
        font-size: 0.84rem;
        color: #6b7280;
        line-height: 1.35;
      }
      .arrow-icon {
        color: #d1d5db;
        font-size: 20px;
      }

      .menu-footer {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin-top: 32px;
        font-size: 0.78rem;
        color: #9ca3af;
      }
      .heart-icon {
        color: #ef4444;
        font-size: 13px;
      }
    `,
  ],
})
export class MainMenuPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ui = inject(UiService);

  protected readonly mapOutline = mapOutline;
  protected readonly personOutline = personOutline;
  protected readonly addCircleOutline = addCircleOutline;
  protected readonly bookOutline = bookOutline;
  protected readonly logInOutline = logInOutline;
  protected readonly logOutOutline = logOutOutline;
  protected readonly sparkles = sparkles;
  protected readonly chevronForwardOutline = chevronForwardOutline;
  protected readonly heart = heart;

  goTo(path: string): void {
    void this.router.navigateByUrl(path);
  }

  goCreate(): void {
    if (!this.auth.isLoggedIn()) {
      void this.ui.toast('Inicia sesión para compartir a tu perrito.', 'warning');
      void this.router.navigateByUrl('/login');
      return;
    }
    void this.router.navigateByUrl('/create-report');
  }

  goLogin(): void {
    void this.router.navigateByUrl('/login');
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    void this.ui.toast('Sesión cerrada.', 'medium');
  }
}
