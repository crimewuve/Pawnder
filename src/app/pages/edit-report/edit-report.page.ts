import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonInput,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { cameraOutline, imagesOutline, starOutline, trashOutline } from 'ionicons/icons';

import { AuthService } from '../../core/services/auth.service';
import type { CapturedPhoto } from '../../core/services/camera.service';
import { CameraService } from '../../core/services/camera.service';
import { ReportsService } from '../../core/services/reports.service';
import { StorageService } from '../../core/services/storage.service';
import { UiService } from '../../core/services/ui.service';
import { toLocalInput } from '../../core/utils/format';
import { HardwareError } from '../../core/utils/hardware-error';
import type {
  DogReport,
  DogSize,
  Option,
  ReportPatch,
  ReportStatus,
  UrgencyCategory,
  UrgencyLevel,
} from '../../models/dog-report.model';
import {
  SIZE_OPTIONS,
  STATUS_OPTIONS,
  URGENCY_CATEGORY_OPTIONS,
  URGENCY_LEVEL_OPTIONS,
} from '../../models/dog-report.model';
import { PhotoCarouselComponent } from '../../shared/components/photo-carousel/photo-carousel.component';

interface WorkingPhoto {
  photo_url: string;
  photo_path: string | null;
  is_primary: boolean;
}

@Component({
  selector: 'app-edit-report',
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
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonGrid,
    IonRow,
    IonCol,
    PhotoCarouselComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/profile" text="Volver"></ion-back-button>
        </ion-buttons>
        <ion-title>Editar publicación</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding pw-form">
      @if (loading()) {
        <div class="center-loader">
          <ion-spinner name="crescent"></ion-spinner>
          <p>Cargando la publicación…</p>
        </div>
      } @else if (report(); as r) {
        <div class="form-container">
          <div class="card photo-card">
            <h3>Fotos</h3>
            <p class="pw-hint">La primera foto principal se mostrará en la ficha y en el mapa.</p>

            <div class="carousel-wrap">
              <app-photo-carousel [photos]="photoUrls()" alt="Fotos del reporte" />
            </div>

            <div class="photo-actions">
              <ion-button size="small" fill="outline" [disabled]="uploading() || saving()" (click)="pickPhoto()">
                <ion-icon slot="start" [icon]="imagesOutline"></ion-icon>
                Galería
              </ion-button>
              <ion-button size="small" fill="outline" [disabled]="uploading() || saving()" (click)="takePhoto()">
                <ion-icon slot="start" [icon]="cameraOutline"></ion-icon>
                Tomar foto
              </ion-button>
            </div>
            @if (uploading()) {
              <p class="pw-hint">Subiendo la foto…</p>
            }

            <div class="photo-list">
              @for (photo of photos(); track photo.photo_url; let i = $index) {
                <div class="photo-row" [class.is-primary]="photo.is_primary">
                  <img [src]="photo.photo_url" [alt]="'Foto ' + (i + 1)" />
                  <span class="photo-label">Foto {{ i + 1 }}</span>
                  @if (photo.is_primary) {
                    <span class="primary-badge">Principal</span>
                  }
                  <div class="row-actions">
                    @if (!photo.is_primary) {
                      <ion-button
                        size="small"
                        fill="clear"
                        aria-label="Marcar como principal"
                        [disabled]="saving()"
                        (click)="setPrimary(i)"
                      >
                        <ion-icon slot="icon-only" [icon]="starOutline"></ion-icon>
                      </ion-button>
                    }
                    <ion-button
                      size="small"
                      fill="clear"
                      color="danger"
                      aria-label="Eliminar foto"
                      [disabled]="saving()"
                      (click)="removePhoto(i)"
                    >
                      <ion-icon slot="icon-only" [icon]="trashOutline"></ion-icon>
                    </ion-button>
                  </div>
                </div>
              }
            </div>
          </div>

          <div class="card">
            <h3>Datos de la publicación</h3>

            <ion-input
              [class.pw-invalid]="titleError()"
              label="Título del reporte"
              labelPlacement="floating"
              fill="outline"
              maxlength="80"
              [value]="title()"
              (ionInput)="title.set($any($event).detail.value ?? '')"
            ></ion-input>
            @if (titleError()) {
              <p class="pw-error">{{ titleError() }}</p>
            }

            <ion-textarea
              label="Descripción"
              labelPlacement="floating"
              fill="outline"
              [rows]="4"
              [counter]="true"
              auto-grow
              maxlength="400"
              [class.pw-invalid]="descError()"
              [value]="description()"
              (ionInput)="description.set($any($event).detail.value ?? '')"
            ></ion-textarea>
            @if (descError()) {
              <p class="pw-error">{{ descError() }}</p>
            }

            <ion-textarea
              label="Situación o detalles adicionales"
              labelPlacement="floating"
              fill="outline"
              [rows]="3"
              [counter]="true"
              auto-grow
              maxlength="400"
              [value]="situation()"
              (ionInput)="situation.set($any($event).detail.value ?? '')"
            ></ion-textarea>

            <ion-grid class="no-pad">
              <ion-row>
                <ion-col size="12" sizeMd="6">
                  <ion-input
                    [class.pw-invalid]="breedError()"
                    label="Raza"
                    labelPlacement="floating"
                    fill="outline"
                    maxlength="60"
                    [value]="breed()"
                    (ionInput)="breed.set($any($event).detail.value ?? '')"
                  ></ion-input>
                  @if (breedError()) {
                    <p class="pw-error">{{ breedError() }}</p>
                  }
                </ion-col>
                <ion-col size="12" sizeMd="6">
                  <ion-select
                    label="Tamaño aproximado"
                    labelPlacement="floating"
                    fill="outline"
                    interface="popover"
                    [value]="size()"
                    (ionChange)="size.set($any($event).detail.value)"
                  >
                    @for (o of sizeOptions; track o.value) {
                      <ion-select-option [value]="o.value">{{ o.label }}</ion-select-option>
                    }
                  </ion-select>
                </ion-col>
              </ion-row>
              <ion-row>
                <ion-col size="12" sizeMd="6">
                  <ion-input
                    [class.pw-invalid]="dateError()"
                    label="Fecha y hora del hallazgo"
                    labelPlacement="floating"
                    fill="outline"
                    type="datetime-local"
                    [value]="foundAt()"
                    (ionInput)="foundAt.set($any($event).detail.value ?? '')"
                  ></ion-input>
                  @if (dateError()) {
                    <p class="pw-error">{{ dateError() }}</p>
                  }
                </ion-col>
                <ion-col size="12" sizeMd="6">
                  <ion-input
                    label="Barrio o sector"
                    labelPlacement="floating"
                    fill="outline"
                    maxlength="60"
                    [value]="zone()"
                    (ionInput)="zone.set($any($event).detail.value ?? '')"
                  ></ion-input>
                </ion-col>
              </ion-row>
              <ion-row>
                <ion-col size="6">
                  <ion-input
                    [class.pw-invalid]="coordsError()"
                    label="Latitud"
                    labelPlacement="floating"
                    fill="outline"
                    type="number"
                    inputmode="decimal"
                    [value]="latitude()"
                    (ionInput)="latitude.set($any($event).detail.value ?? '')"
                  ></ion-input>
                </ion-col>
                <ion-col size="6">
                  <ion-input
                    [class.pw-invalid]="coordsError()"
                    label="Longitud"
                    labelPlacement="floating"
                    fill="outline"
                    type="number"
                    inputmode="decimal"
                    [value]="longitude()"
                    (ionInput)="longitude.set($any($event).detail.value ?? '')"
                  ></ion-input>
                </ion-col>
              </ion-row>
              @if (coordsError()) {
                <p class="pw-error">{{ coordsError() }}</p>
              }
            </ion-grid>
          </div>

          <div class="card">
            <h3>Urgencia y seguimiento</h3>
            <ion-grid class="no-pad">
              <ion-row>
                <ion-col size="12" sizeMd="6">
                  <ion-select
                    label="Nivel de urgencia"
                    labelPlacement="floating"
                    fill="outline"
                    interface="popover"
                    [value]="urgencyLevel()"
                    (ionChange)="urgencyLevel.set($any($event).detail.value)"
                  >
                    @for (o of levelOptions; track o.value) {
                      <ion-select-option [value]="o.value">{{ o.label }}</ion-select-option>
                    }
                  </ion-select>
                </ion-col>
                <ion-col size="12" sizeMd="6">
                  <ion-select
                    label="Estado del reporte"
                    labelPlacement="floating"
                    fill="outline"
                    interface="popover"
                    [value]="reportStatus()"
                    (ionChange)="reportStatus.set($any($event).detail.value)"
                  >
                    @for (o of statusOptions; track o.value) {
                      <ion-select-option [value]="o.value">{{ o.label }}</ion-select-option>
                    }
                  </ion-select>
                </ion-col>
              </ion-row>
            </ion-grid>

            <ion-select
              label="Categoría de urgencia"
              labelPlacement="floating"
              fill="outline"
              interface="popover"
              [value]="urgencyCategory()"
              (ionChange)="urgencyCategory.set($any($event).detail.value ?? '')"
            >
              <ion-select-option value="">Sin categoría</ion-select-option>
              @for (o of categoryOptions; track o.value) {
                <ion-select-option [value]="o.value">{{ o.label }}</ion-select-option>
              }
            </ion-select>
          </div>

          <ion-button expand="block" class="save-button" [disabled]="saving() || uploading()" (click)="save()">
            @if (saving()) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              Guardar cambios
            }
          </ion-button>
        </div>
      }
    </ion-content>
  `,
  styles: [
    `
      .form-container {
        max-width: 680px;
        margin: 0 auto;
        padding-bottom: 40px;
      }
      .card {
        background: #ffffff;
        border: 1px solid #e4efe9;
        border-radius: var(--pw-card-radius);
        box-shadow: var(--pw-shadow-soft);
        padding: 16px 16px 8px;
        margin-bottom: 16px;
      }
      .card h3 {
        margin: 0 0 12px;
        font-size: 1.05rem;
        font-weight: 800;
        color: #1b6b53;
      }
      .no-pad {
        padding: 0;
        margin: 0;
      }
      .center-loader {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 80px 20px;
        color: #6b7c74;
      }
      .center-loader p {
        margin: 0;
        font-size: 0.9rem;
      }
      .carousel-wrap {
        height: 240px;
        border-radius: 14px;
        overflow: hidden;
        background: #f3f0ea;
      }
      .photo-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      .photo-actions ion-button {
        flex: 1;
        margin: 0;
      }
      .photo-list {
        margin-top: 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .photo-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 8px;
        border: 1px solid #e9f1ed;
        border-radius: 12px;
        background: #fbfdfc;
      }
      .photo-row.is-primary {
        border-color: #bfe9da;
        background: #f2fbf7;
      }
      .photo-row img {
        width: 52px;
        height: 52px;
        object-fit: cover;
        border-radius: 10px;
        flex-shrink: 0;
      }
      .photo-label {
        flex: 1;
        font-size: 0.85rem;
        font-weight: 700;
        color: #2f4a40;
      }
      .primary-badge {
        padding: 4px 10px;
        border-radius: 999px;
        background: #1b8a6b;
        color: #ffffff;
        font-size: 0.7rem;
        font-weight: 800;
      }
      .row-actions {
        display: flex;
        align-items: center;
      }
      .save-button {
        --border-radius: 14px;
        height: 52px;
        font-weight: 800;
        margin-top: 24px;
      }
    `,
  ],
})
export class EditReportPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly reports = inject(ReportsService);
  private readonly storage = inject(StorageService);
  private readonly camera = inject(CameraService);
  private readonly ui = inject(UiService);

  protected readonly cameraOutline = cameraOutline;
  protected readonly imagesOutline = imagesOutline;
  protected readonly starOutline = starOutline;
  protected readonly trashOutline = trashOutline;
  protected readonly sizeOptions = SIZE_OPTIONS;
  protected readonly categoryOptions = URGENCY_CATEGORY_OPTIONS;
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly levelOptions: Option<UrgencyLevel>[] = [
    { value: 'normal', label: 'Sin urgencia' },
    ...URGENCY_LEVEL_OPTIONS,
  ];

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly submitted = signal(false);
  protected readonly report = signal<DogReport | null>(null);

  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly breed = signal('');
  protected readonly size = signal<DogSize | ''>('');
  protected readonly situation = signal('');
  protected readonly foundAt = signal('');
  protected readonly zone = signal('');
  protected readonly latitude = signal('');
  protected readonly longitude = signal('');
  protected readonly urgencyLevel = signal<UrgencyLevel>('normal');
  protected readonly urgencyCategory = signal<UrgencyCategory | ''>('');
  protected readonly reportStatus = signal<ReportStatus>('activo');

  protected readonly photos = signal<WorkingPhoto[]>([]);
  protected readonly photoUrls = computed(() => this.photos().map((photo) => photo.photo_url));

  protected readonly titleError = computed(() =>
    this.submitted() && this.title().trim().length < 3 ? 'El título debe tener al menos 3 caracteres.' : '',
  );
  protected readonly descError = computed(() =>
    this.submitted() && this.description().trim().length < 10
      ? 'La descripción debe tener al menos 10 caracteres.'
      : '',
  );
  protected readonly breedError = computed(() =>
    this.submitted() && !this.breed().trim() ? 'Indica la raza del perro.' : '',
  );
  protected readonly dateError = computed(() =>
    this.submitted() && this.parseFoundAt() === null ? 'Indica una fecha y hora válidas.' : '',
  );
  protected readonly coordsError = computed(() =>
    this.submitted() && !this.validCoordinates() ? 'Las coordenadas no son válidas.' : '',
  );

  private reportId = '';
  private returnUrl = '';
  private readonly uploadedPaths = new Set<string>();

  async ionViewWillEnter(): Promise<void> {
    await this.auth.whenReady();

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      await this.ui.toast('No se encontró la publicación.', 'danger');
      await this.router.navigateByUrl('/home', { replaceUrl: true });
      return;
    }
    this.reportId = id;
    this.returnUrl = this.route.snapshot.queryParamMap.get('from') === 'profile' ? '/profile' : '';

    this.loading.set(true);
    try {
      const report = await this.reports.getById(id);
      if (report.user_id !== this.auth.user()?.id) {
        await this.ui.toast('No puedes editar esta publicación.', 'danger');
        await this.router.navigateByUrl('/home', { replaceUrl: true });
        return;
      }
      this.report.set(report);
      this.fillForm(report);
    } catch (e) {
      await this.ui.toast(e instanceof Error ? e.message : 'No se pudo cargar la publicación.', 'danger');
      await this.router.navigateByUrl('/home', { replaceUrl: true });
    } finally {
      this.loading.set(false);
    }
  }

  protected async pickPhoto(): Promise<void> {
    await this.addPhoto(() => this.camera.pickFromGallery());
  }

  protected async takePhoto(): Promise<void> {
    await this.addPhoto(() => this.camera.takePhoto());
  }

  protected setPrimary(index: number): void {
    this.photos.update((list) => list.map((photo, i) => ({ ...photo, is_primary: i === index })));
  }

  protected async removePhoto(index: number): Promise<void> {
    const photo = this.photos()[index];
    if (!photo) return;
    if (this.photos().length <= 1) {
      await this.ui.toast('Debe quedar al menos una foto.', 'warning');
      return;
    }

    const confirmed = await this.ui.confirm('Eliminar foto', '¿Eliminar esta foto de la publicación?', 'Eliminar');
    if (!confirmed) return;

    const wasPrimary = photo.is_primary;
    this.photos.update((list) => {
      const next = list.filter((_, i) => i !== index);
      if (wasPrimary && next.length > 0 && !next.some((item) => item.is_primary)) {
        next[0] = { ...next[0], is_primary: true };
      }
      return next;
    });

    if (photo.photo_path && this.uploadedPaths.has(photo.photo_path)) {
      await this.storage.deletePhoto(photo.photo_path).catch(() => undefined);
      this.uploadedPaths.delete(photo.photo_path);
    }
  }

  protected async save(): Promise<void> {
    if (this.saving() || this.uploading()) return;
    this.submitted.set(true);

    if (
      this.titleError() ||
      this.descError() ||
      this.breedError() ||
      this.dateError() ||
      this.coordsError() ||
      this.photos().length === 0
    ) {
      await this.ui.toast('Revisa los campos marcados en rojo.', 'warning');
      return;
    }

    const foundAt = this.parseFoundAt();
    const currentPhotos = this.photos();
    const primary = currentPhotos.find((photo) => photo.is_primary) ?? currentPhotos[0];
    if (!foundAt || !primary) return;

    const user = this.auth.user();
    if (!user || this.report()?.user_id !== user.id) {
      await this.ui.toast('No puedes editar esta publicación.', 'danger');
      await this.router.navigateByUrl('/home', { replaceUrl: true });
      return;
    }

    const patch: ReportPatch = {
      title: this.title().trim(),
      description: this.description().trim(),
      breed: this.breed().trim(),
      size: this.size() as DogSize,
      situation: this.situation().trim() || null,
      found_at: foundAt,
      zone: this.zone().trim(),
      latitude: Number(this.latitude()),
      longitude: Number(this.longitude()),
      urgency_level: this.urgencyLevel(),
      urgency_category: this.urgencyCategory() || null,
      report_status: this.reportStatus(),
      photo_url: primary.photo_url,
      photo_path: primary.photo_path,
    };

    this.saving.set(true);
    try {
      await this.reports.update(this.reportId, patch);
      await this.reports.syncPhotos(this.reportId, currentPhotos);
      const updated = await this.reports.getById(this.reportId);
      this.report.set(updated);
      this.fillForm(updated);
      this.uploadedPaths.clear();
      await this.ui.toast('Los cambios se guardaron correctamente.', 'success');
      await this.router.navigateByUrl(this.returnUrl || `/report-detail/${this.reportId}`);
    } catch (e) {
      await this.ui.toast(e instanceof Error ? e.message : 'No se pudieron guardar los cambios.', 'danger');
    } finally {
      this.saving.set(false);
    }
  }

  private fillForm(report: DogReport): void {
    this.title.set(report.title);
    this.description.set(report.description);
    this.breed.set(report.breed);
    this.size.set(report.size);
    this.situation.set(report.situation ?? '');
    const found = new Date(report.found_at);
    this.foundAt.set(Number.isNaN(found.getTime()) ? toLocalInput(new Date()) : toLocalInput(found));
    this.zone.set(report.zone);
    this.latitude.set(String(report.latitude));
    this.longitude.set(String(report.longitude));
    this.urgencyLevel.set(report.urgency_level);
    this.urgencyCategory.set(report.urgency_category ?? '');
    this.reportStatus.set(report.report_status);

    const existing = (report.photos ?? []).map<WorkingPhoto>((photo) => ({
      photo_url: photo.photo_url,
      photo_path: photo.photo_path,
      is_primary: photo.is_primary,
    }));
    const list =
      existing.length > 0
        ? existing
        : [{ photo_url: report.photo_url, photo_path: report.photo_path, is_primary: true }];
    const hasPrimary = list.some((photo) => photo.is_primary);
    this.photos.set(
      list.map((photo, index) => ({ ...photo, is_primary: hasPrimary ? photo.is_primary : index === 0 })),
    );
    this.submitted.set(false);
  }

  private async addPhoto(getter: () => Promise<CapturedPhoto>): Promise<void> {
    try {
      const captured = await getter();
      const user = this.auth.user();
      if (!user) {
        await this.ui.toast('Debes iniciar sesión para añadir fotos.', 'danger');
        return;
      }

      this.uploading.set(true);
      const uploaded = await this.storage.uploadPhoto(captured.blob, user.id);
      this.uploadedPaths.add(uploaded.path);
      this.photos.update((list) => {
        const hasPrimary = list.some((photo) => photo.is_primary);
        return [
          ...list.map((photo) => ({ ...photo, is_primary: hasPrimary ? photo.is_primary : false })),
          { photo_url: uploaded.publicUrl, photo_path: uploaded.path, is_primary: !hasPrimary },
        ];
      });
    } catch (e) {
      if (e instanceof HardwareError) {
        if (e.kind === 'cancelled') return;
        if (e.kind === 'denied') {
          await this.ui.notice('Permiso de cámara', e.message);
          return;
        }
        await this.ui.toast(e.message, 'danger');
        return;
      }
      await this.ui.toast(e instanceof Error ? e.message : 'No se pudo añadir la foto.', 'danger');
    } finally {
      this.uploading.set(false);
    }
  }

  private validCoordinates(): boolean {
    const lat = Number(this.latitude());
    const lng = Number(this.longitude());
    return (
      this.latitude().trim() !== '' &&
      this.longitude().trim() !== '' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    );
  }

  private parseFoundAt(): string | null {
    const value = this.foundAt();
    if (!value) return null;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : new Date(time).toISOString();
  }
}
