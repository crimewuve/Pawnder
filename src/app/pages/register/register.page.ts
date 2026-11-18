import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonInput, IonInputPasswordToggle, IonSpinner } from '@ionic/angular';
import { arrowBackOutline } from 'ionicons/icons';

import { AuthService } from '../../core/services/auth.service';
import { UiService } from '../../core/services/ui.service';
import { EMAIL_RE } from '../../core/utils/validators';

@Component({
  selector: 'app-register',
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
          <h1>Únete a Pawnder</h1>
          <p class="tagline">Crea tu alias para registrar perritos y comentar</p>
        </div>

        <div class="auth-card">
          <form (submit)="$event.preventDefault(); submit()" novalidate>
            <ion-input
              label="Tu alias o nombre público"
              labelPlacement="floating"
              fill="outline"
              type="text"
              autocomplete="nickname"
              maxlength="30"
              class="custom-input"
              placeholder="Ej: SofiaG, CarlosVet..."
              [value]="displayName()"
              (ionInput)="displayName.set($any($event).detail.value ?? '')"
            ></ion-input>
            @if (nameError()) {
              <p class="field-error">{{ nameError() }}</p>
            }

            <ion-input
              class="custom-input gap"
              label="Correo electrónico"
              labelPlacement="floating"
              fill="outline"
              type="email"
              autocomplete="email"
              inputmode="email"
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
              autocomplete="new-password"
              [value]="password()"
              (ionInput)="password.set($any($event).detail.value ?? '')"
            >
              <ion-input-password-toggle slot="end"></ion-input-password-toggle>
            </ion-input>
            @if (passError()) {
              <p class="field-error">{{ passError() }}</p>
            }

            <ion-input
              class="custom-input gap"
              label="Confirmar contraseña"
              labelPlacement="floating"
              fill="outline"
              type="password"
              autocomplete="new-password"
              [value]="confirmPassword()"
              (ionInput)="confirmPassword.set($any($event).detail.value ?? '')"
            >
              <ion-input-password-toggle slot="end"></ion-input-password-toggle>
            </ion-input>
            @if (confirmError()) {
              <p class="field-error">{{ confirmError() }}</p>
            }

            <ion-button expand="block" type="submit" class="btn-submit" [disabled]="loading()">
              @if (loading()) {
                <ion-spinner name="crescent"></ion-spinner>
              } @else {
                Registrarme en Pawnder
              }
            </ion-button>
          </form>

          <div class="divider">
            <span>¿Ya tienes cuenta?</span>
          </div>

          <ion-button expand="block" fill="outline" class="btn-login" routerLink="/login"> Iniciar sesión </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [
    `
      .auth-content {
        --background: linear-gradient(180deg, #faf6f0 0%, #f3ede2 100%);
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
        border: 1px solid rgba(229, 231, 235, 0.9);
        padding: 6px 14px;
        border-radius: 999px;
        color: #4b5563;
        font-weight: 700;
        font-size: 0.8rem;
        cursor: pointer;
        margin-bottom: 20px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
      }
      .brand-hero {
        text-align: center;
        margin-bottom: 22px;
      }
      .logo-box {
        width: 76px;
        height: 76px;
        margin: 0 auto 12px;
        border-radius: 26px;
        background: #ffffff;
        overflow: hidden;
        box-shadow: 0 10px 24px rgba(16, 185, 129, 0.2);
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
        color: #064e3b;
        letter-spacing: -0.03em;
      }
      .tagline {
        margin: 6px 0 0;
        color: #6b7280;
        font-size: 0.9rem;
      }

      .auth-card {
        background: #ffffff;
        border-radius: 26px;
        padding: 26px 22px;
        box-shadow: var(--pw-shadow-soft);
        border: 1px solid rgba(229, 231, 235, 0.8);
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
      .btn-login {
        height: 48px;
        --border-radius: 14px;
        font-weight: 700;
      }
    `,
  ],
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ui = inject(UiService);

  protected readonly arrowBackOutline = arrowBackOutline;

  protected readonly displayName = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly submitted = signal(false);
  protected readonly loading = signal(false);

  protected readonly nameError = computed(() => {
    if (!this.submitted()) return '';
    const v = this.displayName().trim();
    if (!v) return 'Escribe tu alias.';
    return v.length >= 3 ? '' : 'Mínimo 3 caracteres.';
  });

  protected readonly emailError = computed(() => {
    if (!this.submitted()) return '';
    const v = this.email().trim();
    if (!v) return 'Ingresa tu correo.';
    return EMAIL_RE.test(v) ? '' : 'Formato de correo no válido.';
  });

  protected readonly passError = computed(() => {
    if (!this.submitted()) return '';
    return this.password().length >= 6 ? '' : 'Mínimo 6 caracteres.';
  });

  protected readonly confirmError = computed(() => {
    if (!this.submitted()) return '';
    return this.confirmPassword() === this.password() ? '' : 'Las contraseñas no coinciden.';
  });

  goMenu(): void {
    void this.router.navigateByUrl('/menu');
  }

  async submit(): Promise<void> {
    if (this.loading()) return;
    this.submitted.set(true);
    if (this.nameError() || this.emailError() || this.passError() || this.confirmError()) return;

    this.loading.set(true);
    try {
      const res = await this.auth.register(this.email().trim(), this.password(), this.displayName().trim());
      if (res.needsConfirmation) {
        await this.ui.notice(
          'Confirma tu correo',
          'Enviamos un enlace a tu bandeja para activar tu cuenta antes de ingresar.',
        );
        await this.router.navigateByUrl('/login');
      } else {
        await this.router.navigateByUrl('/menu', { replaceUrl: true });
        void this.ui.toast('¡Cuenta creada con éxito! 🐾', 'success');
      }
    } catch (e) {
      void this.ui.toast(e instanceof Error ? e.message : 'Error al registrar.', 'danger');
    } finally {
      this.loading.set(false);
    }
  }
}
