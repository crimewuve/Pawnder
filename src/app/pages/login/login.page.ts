import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonInput, IonInputPasswordToggle, IonSpinner } from '@ionic/angular';
import { arrowBackOutline } from 'ionicons/icons';

import { AuthService } from '../../core/services/auth.service';
import { UiService } from '../../core/services/ui.service';
import { EMAIL_RE } from '../../core/utils/validators';

@Component({
  selector: 'app-login',
  imports: [IonContent, IonInput, IonInputPasswordToggle, IonButton, IonSpinner, IonIcon, RouterLink],
  template: `
    <ion-content [fullscreen]="true" class="auth-content">
      <div class="auth-wrap">
        <!-- Back to menu button -->
        <button class="back-pill" type="button" (click)="goMenu()">
          <ion-icon [icon]="arrowBackOutline"></ion-icon>
          <span>Menú principal</span>
        </button>

        <div class="brand-hero">
          <div class="logo-box">
            <img src="assets/icon/favicon.png" alt="" />
          </div>
          <h1>Bienvenido a Pawnder</h1>
          <p class="tagline">La comunidad canina y red de rescate y adopción</p>
        </div>

        <div class="auth-card">
          <form (submit)="$event.preventDefault(); submit()" novalidate>
            <ion-input
              label="Correo electrónico"
              labelPlacement="floating"
              fill="outline"
              type="email"
              autocomplete="email"
              inputmode="email"
              class="custom-input"
              [value]="email()"
              (ionInput)="email.set($any($event).detail.value ?? '')"
            ></ion-input>
            @if (emailError()) {
              <p class="field-error">{{ emailError() }}</p>
            }

            <ion-input
              class="custom-input gap"
              label="Contraseña"
              labelPlacement="floating"
              fill="outline"
              type="password"
              autocomplete="current-password"
              [value]="password()"
              (ionInput)="password.set($any($event).detail.value ?? '')"
            >
              <ion-input-password-toggle slot="end"></ion-input-password-toggle>
            </ion-input>
            @if (passError()) {
              <p class="field-error">{{ passError() }}</p>
            }

            <ion-button expand="block" type="submit" class="btn-submit" [disabled]="loading()">
              @if (loading()) {
                <ion-spinner name="crescent"></ion-spinner>
              } @else {
                Iniciar sesión
              }
            </ion-button>
          </form>

          <div class="divider">
            <span>¿Nuevo en Pawnder?</span>
          </div>

          <ion-button expand="block" fill="outline" class="btn-register" routerLink="/register">
            Crear una cuenta nueva
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .auth-content {
        --background: linear-gradient(180deg, #faf8f5 0%, #edf7f3 100%);
      }
      .auth-wrap {
        padding: 24px 20px 40px;
        max-width: 440px;
        margin: 0 auto;
        min-height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .back-pill {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #ffffff;
        border: 1px solid rgba(19, 78, 63, 0.15);
        padding: 6px 14px;
        border-radius: 999px;
        color: #134e3f;
        font-weight: 700;
        font-size: 0.8rem;
        cursor: pointer;
        margin-bottom: 24px;
        box-shadow: 0 2px 6px rgba(19, 78, 63, 0.05);
      }
      .brand-hero {
        text-align: center;
        margin-bottom: 24px;
      }
      .logo-box {
        width: 80px;
        height: 80px;
        margin: 0 auto 14px;
        border-radius: 26px;
        background: #ffffff;
        overflow: hidden;
        box-shadow: 0 10px 24px rgba(19, 78, 63, 0.12);
        border: 2px solid #75D6B3;
      }
      .logo-box img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      h1 {
        margin: 0;
        font-size: 1.85rem;
        font-weight: 800;
        color: #134e3f;
        letter-spacing: -0.03em;
      }
      .tagline {
        margin: 6px 0 0;
        color: #4b6358;
        font-size: 0.9rem;
      }

      .auth-card {
        background: #ffffff;
        border-radius: 24px;
        padding: 26px 22px;
        box-shadow: 0 4px 20px -2px rgba(19, 78, 63, 0.07);
        border: 1px solid rgba(215, 232, 225, 0.9);
      }
      .custom-input {
        --background: #fafafa;
        --border-radius: 14px;
      }
      .gap {
        margin-top: 14px;
      }
      .field-error {
        margin: 4px 6px 0;
        font-size: 0.78rem;
        color: #ef4444;
      }
      .btn-submit {
        margin-top: 24px;
        height: 50px;
        --border-radius: 14px;
        font-weight: 800;
        font-size: 1rem;
      }
      .divider {
        margin: 22px 0;
        text-align: center;
        position: relative;
      }
      .divider::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 1px;
        background: #e5e7eb;
      }
      .divider span {
        position: relative;
        background: #ffffff;
        padding: 0 12px;
        color: #9ca3af;
        font-size: 0.78rem;
        font-weight: 600;
      }
      .btn-register {
        height: 48px;
        --border-radius: 14px;
        font-weight: 700;
      }
    `,
  ],
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ui = inject(UiService);

  protected readonly arrowBackOutline = arrowBackOutline;

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly submitted = signal(false);
  protected readonly loading = signal(false);

  protected readonly emailError = computed(() => {
    if (!this.submitted()) return '';
    const val = this.email().trim();
    if (!val) return 'Ingresa tu correo.';
    return EMAIL_RE.test(val) ? '' : 'Formato de correo no válido.';
  });

  protected readonly passError = computed(() => {
    if (!this.submitted()) return '';
    return this.password().length >= 6 ? '' : 'Mínimo 6 caracteres.';
  });

  goMenu(): void {
    void this.router.navigateByUrl('/menu');
  }

  async submit(): Promise<void> {
    if (this.loading()) return;
    this.submitted.set(true);
    if (this.emailError() || this.passError()) return;

    this.loading.set(true);
    try {
      await this.auth.login(this.email().trim(), this.password());
      await this.router.navigateByUrl('/menu', { replaceUrl: true });
      void this.ui.toast('¡Bienvenido de vuelta! 🐾', 'success');
    } catch (e) {
      void this.ui.toast(e instanceof Error ? e.message : 'Error al iniciar sesión.', 'danger');
    } finally {
      this.loading.set(false);
    }
  }
}
