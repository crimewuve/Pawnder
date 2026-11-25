import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { cameraOutline, createOutline, pawOutline, trashOutline } from 'ionicons/icons';

import { AuthService } from '../../core/services/auth.service';
import { CameraService } from '../../core/services/camera.service';
import { ReportsService } from '../../core/services/reports.service';
import { StorageService } from '../../core/services/storage.service';
import { UiService } from '../../core/services/ui.service';
import { HardwareError } from '../../core/utils/hardware-error';
import type { DogReport } from '../../models/dog-report.model';
import type { Profile } from '../../models/user.model';
import { ReportCardComponent } from '../../shared/components/report-card/report-card.component';

@Component({
  selector: 'app-profile',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonButton,
    IonIcon,
    IonInput,
    IonTextarea,
    IonSpinner,
    ReportCardComponent,
  ],
  template: `
    <ion-header class="ion-no-border profile-header">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/menu" text="Volver"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ isOwn() ? 'Mi perfil' : 'Perfil' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="profile-content">
      @if (loading()) {
        <div class="center-loader">
          <ion-spinner name="crescent" color="primary"></ion-spinner>
          <p>Cargando perfil…</p>
        </div>
      } @else if (profile(); as p) {
        <div class="profile-container">
          <div class="profile-hero">
            <div class="avatar-wrap">
              @if (p.avatar_url) {
                <img class="avatar" [src]="p.avatar_url" [alt]="'Foto de ' + p.display_name" />
              } @else {
                <div class="avatar avatar-placeholder">{{ initial() }}</div>
              }
              @if (isOwn()) {
                <button class="avatar-camera" type="button" (click)="pickAvatar()" aria-label="Cambiar foto">
                  <ion-icon [icon]="cameraOutline"></ion-icon>
                </button>
                @if (p.avatar_url) {
                  <button class="avatar-remove" type="button" (click)="removeAvatar()" aria-label="Quitar foto">
                    <ion-icon [icon]="trashOutline"></ion-icon>
                  </button>
                }
              }
            </div>

            <h1>{{ p.display_name }}</h1>
            <p class="joined">Miembro desde {{ joinedLabel() }}</p>
            <p class="post-count">
              <b>{{ posts().length }}</b> publicaciones
            </p>

            @if (isOwn() && editingName()) {
              <div class="inline-edit">
                <ion-input
                  aria-label="Nombre de usuario"
                  maxlength="30"
                  fill="outline"
                  [value]="nameDraft()"
                  (ionInput)="nameDraft.set($any($event).detail.value ?? '')"
                ></ion-input>
                <ion-button size="small" (click)="saveName()" [disabled]="saving()">Guardar</ion-button>
                <ion-button size="small" fill="outline" (click)="editingName.set(false)">Cancelar</ion-button>
              </div>
            } @else {
              @if (isOwn()) {
                <ion-button class="edit-chip" size="small" fill="outline" (click)="startEditName()">
                  <ion-icon slot="start" [icon]="createOutline"></ion-icon> Editar nombre
                </ion-button>
              }
            }
          </div>

          <div class="bio-card">
            <div class="bio-head">
              <h2>Sobre mí</h2>
              @if (isOwn() && !editingBio()) {
                <ion-button size="small" fill="clear" (click)="startEditBio()">Editar</ion-button>
              }
            </div>
            @if (isOwn() && editingBio()) {
              <ion-textarea
                aria-label="Biografía"
                rows="4"
                maxlength="300"
                fill="outline"
                placeholder="Cuéntale a la comunidad sobre ti…"
                [value]="bioDraft()"
                (ionInput)="bioDraft.set($any($event).detail.value ?? '')"
              ></ion-textarea>
              <div class="bio-actions">
                <ion-button size="small" (click)="saveBio()" [disabled]="saving()">Guardar</ion-button>
                <ion-button size="small" fill="outline" (click)="editingBio.set(false)">Cancelar</ion-button>
              </div>
            } @else {
              <p [class.muted]="!p.bio">{{ p.bio?.trim() || 'Todavía no ha escrito una biografía.' }}</p>
            }
          </div>

          <div class="posts-head">
            <h2>{{ isOwn() ? 'Mis publicaciones' : 'Publicaciones' }}</h2>
            <span>{{ posts().length }}</span>
          </div>

          @if (postsLoading()) {
            <div class="center-loader small">
              <ion-spinner name="dots" color="primary"></ion-spinner>
            </div>
          } @else {
            <div class="posts-list">
              @for (r of posts(); track r.id) {
                <app-report-card
                  [report]="r"
                  [showActions]="isOwn()"
                  (open)="openReport($event)"
                  (edit)="editReport($event)"
                  (delete)="deleteReport($event)"
                  (author)="openAuthor($event)"
                />
              } @empty {
                <div class="empty-posts">
                  <ion-icon [icon]="pawOutline"></ion-icon>
                  <p>{{ isOwn() ? 'Aún no has publicado perritos.' : 'Esta persona aún no tiene publicaciones.' }}</p>
                  @if (isOwn()) {
                    <ion-button size="small" (click)="goCreate()">Publicar el primero</ion-button>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </ion-content>
  `,
  styles: [
    `
      .profile-header {
        --background: #faf6f0;
      }
      .profile-content {
        --background: linear-gradient(180deg, #faf6f0 0%, #f3ede2 100%);
      }
      .profile-container {
        max-width: 680px;
        margin: 0 auto;
        padding: 12px 16px 48px;
      }
      .center-loader {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 72px 20px;
        color: #6b7280;
      }
      .center-loader.small {
        padding: 32px 20px;
      }
      .profile-hero {
        background: #ffffff;
        border: 1px solid rgba(229, 231, 235, 0.8);
        border-radius: 26px;
        padding: 26px 20px;
        text-align: center;
        box-shadow: var(--pw-shadow-soft);
      }
      .avatar-wrap {
        position: relative;
        width: 104px;
        height: 104px;
        margin: 0 auto 14px;
      }
      .avatar {
        width: 104px;
        height: 104px;
        border-radius: 50%;
        object-fit: cover;
        border: 3px solid #d1fae5;
        background: #ecfdf5;
      }
      .avatar-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #047857;
        font-size: 2.6rem;
        font-weight: 800;
      }
      .avatar-camera,
      .avatar-remove {
        position: absolute;
        bottom: 2px;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 2px solid #ffffff;
        background: #10b981;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 17px;
      }
      .avatar-camera {
        right: -2px;
      }
      .avatar-remove {
        left: -2px;
        background: #ef4444;
      }
      .profile-hero h1 {
        margin: 0;
        font-size: 1.55rem;
        font-weight: 800;
        color: #064e3b;
      }
      .joined,
      .post-count {
        margin: 4px 0;
        color: #6b7280;
        font-size: 0.85rem;
      }
      .post-count b {
        color: #059669;
      }
      .edit-chip {
        margin-top: 10px;
        --border-radius: 999px;
        font-size: 0.78rem;
        height: 30px;
      }
      .inline-edit {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        justify-content: center;
        margin-top: 14px;
      }
      .inline-edit ion-input {
        width: min(240px, 100%);
      }
      .bio-card {
        background: #ffffff;
        border: 1px solid rgba(229, 231, 235, 0.8);
        border-radius: 22px;
        padding: 18px 20px;
        margin-top: 16px;
        box-shadow: var(--pw-shadow-soft);
      }
      .bio-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .bio-head h2,
      .posts-head h2 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 800;
        color: #111827;
      }
      .bio-card p {
        margin: 8px 0 0;
        color: #4b5563;
        line-height: 1.5;
        white-space: pre-line;
      }
      .bio-card p.muted {
        color: #9ca3af;
        font-style: italic;
      }
      .bio-actions {
        display: flex;
        gap: 8px;
        margin-top: 10px;
      }
      .posts-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 26px 4px 12px;
      }
      .posts-head span {
        background: #d1fae5;
        color: #065f46;
        font-weight: 800;
        font-size: 0.75rem;
        padding: 2px 9px;
        border-radius: 999px;
      }
      .posts-list {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .empty-posts {
        background: #ffffff;
        border: 1px dashed #d7e4dc;
        border-radius: 22px;
        padding: 36px 20px;
        text-align: center;
        color: #6b7280;
      }
      .empty-posts ion-icon {
        font-size: 34px;
        color: #9ad9c2;
      }
      @media (max-width: 420px) {
        .profile-container {
          padding: 8px 12px 40px;
        }
      }
    `,
  ],
})
export class ProfilePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly camera = inject(CameraService);
  private readonly reports = inject(ReportsService);
  private readonly storage = inject(StorageService);
  private readonly ui = inject(UiService);

  private readonly targetId = signal<string | null>(null);
  protected readonly profile = signal<Profile | null>(null);
  protected readonly posts = signal<DogReport[]>([]);
  protected readonly loading = signal(true);
  protected readonly postsLoading = signal(true);
  protected readonly saving = signal(false);

  protected readonly editingName = signal(false);
  protected readonly editingBio = signal(false);
  protected readonly nameDraft = signal('');
  protected readonly bioDraft = signal('');

  protected readonly isOwn = computed(() => {
    const target = this.targetId();
    return !target || target === this.auth.user()?.id;
  });
  protected readonly initial = computed(() => this.profile()?.display_name?.trim().charAt(0).toUpperCase() || '🐾');
  protected readonly joinedLabel = computed(() => {
    const value = this.profile()?.created_at;
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '—'
      : new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(date);
  });

  protected readonly cameraOutline = cameraOutline;
  protected readonly createOutline = createOutline;
  protected readonly pawOutline = pawOutline;
  protected readonly trashOutline = trashOutline;

  async ionViewWillEnter(): Promise<void> {
    await this.auth.whenReady();
    const paramId = this.route.snapshot.paramMap.get('userId');
    const currentId = this.auth.user()?.id;
    if (!paramId && !currentId) {
      void this.router.navigateByUrl('/login');
      return;
    }
    const id = paramId ?? currentId!;
    this.targetId.set(id);
    this.loading.set(true);
    this.postsLoading.set(true);
    try {
      const profile = this.isOwn()
        ? (this.auth.profile() ?? (await this.auth.fetchProfile(id)))
        : await this.auth.fetchProfile(id);
      this.profile.set(profile);
      this.nameDraft.set(profile.display_name);
      this.bioDraft.set(profile.bio ?? '');
    } catch {
      void this.ui.toast('No se pudo cargar el perfil.', 'danger');
      this.profile.set(null);
    } finally {
      this.loading.set(false);
    }
    await this.loadPosts(id);
  }

  private async loadPosts(userId: string): Promise<void> {
    try {
      this.posts.set(await this.reports.listByUser(userId));
    } catch {
      void this.ui.toast('No se pudieron cargar las publicaciones.', 'danger');
      this.posts.set([]);
    } finally {
      this.postsLoading.set(false);
    }
  }

  protected startEditName(): void {
    this.nameDraft.set(this.profile()?.display_name ?? '');
    this.editingName.set(true);
  }

  protected async saveName(): Promise<void> {
    const name = this.nameDraft().trim();
    if (name.length < 3) {
      void this.ui.toast('El nombre debe tener al menos 3 caracteres.', 'warning');
      return;
    }
    this.saving.set(true);
    try {
      await this.auth.updateProfile({ display_name: name });
      await this.auth.refreshProfile();
      this.profile.set(this.auth.profile());
      this.editingName.set(false);
      void this.ui.toast('Nombre actualizado ✔', 'success');
    } catch {
      void this.ui.toast('No se pudo actualizar el nombre.', 'danger');
    } finally {
      this.saving.set(false);
    }
  }

  protected startEditBio(): void {
    this.bioDraft.set(this.profile()?.bio ?? '');
    this.editingBio.set(true);
  }

  protected async saveBio(): Promise<void> {
    this.saving.set(true);
    try {
      await this.auth.updateProfile({ bio: this.bioDraft().trim() });
      await this.auth.refreshProfile();
      this.profile.set(this.auth.profile());
      this.editingBio.set(false);
      void this.ui.toast('Biografía actualizada ✔', 'success');
    } catch {
      void this.ui.toast('No se pudo actualizar la biografía.', 'danger');
    } finally {
      this.saving.set(false);
    }
  }

  protected async pickAvatar(): Promise<void> {
    const user = this.auth.user();
    if (!user) return;
    try {
      const photo = await this.camera.pickFromGallery();
      const uploaded = await this.storage.uploadAvatar(photo.blob, user.id);
      await this.auth.updateProfile({ avatar_url: uploaded.publicUrl });
      await this.auth.refreshProfile();
      this.profile.set(this.auth.profile());
      void this.ui.toast('Foto de perfil actualizada ✔', 'success');
    } catch (e) {
      if (e instanceof HardwareError && e.kind === 'cancelled') return;
      void this.ui.toast('No se pudo actualizar la foto de perfil.', 'danger');
    }
  }

  protected async removeAvatar(): Promise<void> {
    const current = this.profile();
    if (!current?.avatar_url) return;
    const ok = await this.ui.confirm('Quitar foto', '¿Volver al avatar predeterminado?', 'Quitar');
    if (!ok) return;
    const oldPath = this.pathFromAvatarUrl(current.avatar_url);
    try {
      await this.auth.updateProfile({ avatar_url: null });
      await this.auth.refreshProfile();
      this.profile.set(this.auth.profile());
      if (oldPath) await this.storage.deleteAvatar(oldPath).catch(() => undefined);
      void this.ui.toast('Foto eliminada.', 'success');
    } catch {
      void this.ui.toast('No se pudo eliminar la foto.', 'danger');
    }
  }

  private pathFromAvatarUrl(url: string): string | null {
    const marker = '/avatars/';
    const index = url.indexOf(marker);
    return index >= 0 ? url.slice(index + marker.length).split('?')[0] : null;
  }

  protected openReport(id: string): void {
    void this.router.navigateByUrl(`/report-detail/${id}`);
  }

  protected editReport(id: string): void {
    void this.router.navigateByUrl(`/edit-report/${id}?from=profile`);
  }

  protected openAuthor(userId: string): void {
    void this.router.navigateByUrl(userId === this.auth.user()?.id ? '/profile' : `/profile/${userId}`);
  }

  protected goCreate(): void {
    void this.router.navigateByUrl('/create-report');
  }

  protected async deleteReport(id: string): Promise<void> {
    const report = this.posts().find((r) => r.id === id);
    if (!report) return;
    const ok = await this.ui.confirm(
      'Eliminar publicación',
      '¿Eliminar esta publicación? Sus fotos y comentarios también se borrarán.',
      'Eliminar',
    );
    if (!ok) return;
    try {
      await this.reports.remove(report);
      this.posts.update((list) => list.filter((r) => r.id !== id));
      void this.ui.toast('Publicación eliminada.', 'success');
    } catch {
      void this.ui.toast('No se pudo eliminar la publicación.', 'danger');
    }
  }
}
