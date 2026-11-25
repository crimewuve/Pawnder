import type { OnInit } from '@angular/core';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
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
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonRow,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular';
import {
  alertCircle,
  cameraOutline,
  checkmarkCircle,
  imagesOutline,
  locationOutline,
  pawOutline,
  refreshOutline,
  shieldCheckmarkOutline,
  sparkles,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { BreedsService } from '../../core/services/breeds.service';
import type { CapturedPhoto } from '../../core/services/camera.service';
import { CameraService } from '../../core/services/camera.service';
import type { BreedCandidate, DogAnalysis } from '../../core/services/dog-vision.service';
import { DogVisionService } from '../../core/services/dog-vision.service';
import { GeocodingService } from '../../core/services/geocoding.service';
import type { GpsFix } from '../../core/services/location.service';
import { LocationService } from '../../core/services/location.service';
import { PREF_KEYS, PreferencesService } from '../../core/services/preferences.service';
import { ReportsService } from '../../core/services/reports.service';
import { StorageService } from '../../core/services/storage.service';
import { UiService } from '../../core/services/ui.service';
import { WeatherService, weatherSummary } from '../../core/services/weather.service';
import { toLocalInput } from '../../core/utils/format';
import { HardwareError } from '../../core/utils/hardware-error';
import type { Breed } from '../../models/breed.model';
import type { DogIdentity, DogSize, NewDogReport, UrgencyCategory, UrgencyLevel } from '../../models/dog-report.model';
import { SIZE_OPTIONS, URGENCY_CATEGORY_OPTIONS, URGENCY_LEVEL_OPTIONS } from '../../models/dog-report.model';
import type { WeatherSnapshot } from '../../models/weather.model';
import { MiniMapComponent } from '../../shared/components/mini-map/mini-map.component';
import { WeatherIndicatorComponent } from '../../shared/components/weather-indicator/weather-indicator.component';

interface ReportDraft {
  breed: string;
  size: DogSize | '';
  title: string;
  description: string;
  situation: string;
  zone: string;
  isEmergency: boolean;
  urgencyLevel: UrgencyLevel;
  urgencyCategory: UrgencyCategory | '';
  customCategory: string;
  isApproximateLocation: boolean;
}

interface BreedSuggestion {
  name: string | null;
  label: string | null;
  score: number;
  message: string;
  uncertain: boolean;
  candidates: BreedCandidate[];
}

@Component({
  selector: 'app-create-report',
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
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    IonGrid,
    IonRow,
    IonCol,
    IonToggle,
    WeatherIndicatorComponent,
    MiniMapComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/menu" text="Volver"></ion-back-button>
        </ion-buttons>
        <ion-title>Publicar perrito</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding pw-form">
      
      <div class="emergency-toggle-card" [class.is-emergency]="isEmergency()">
        <div class="toggle-info">
          <div class="toggle-icon">
            <ion-icon [icon]="isEmergency() ? alertCircle : shieldCheckmarkOutline"></ion-icon>
          </div>
          <div>
            <h4>{{ isEmergency() ? '🚨 Reporte de Emergencia / Rescate' : '🐾 Mascota de la comunidad' }}</h4>
            <p>
              {{
                isEmergency()
                  ? 'Activo: se alertará a rescatistas y se marcará en el mapa.'
                  : 'Desactivado: publicación amigable para amantes de los perritos.'
              }}
            </p>
          </div>
        </div>
        <ion-toggle
          [checked]="isEmergency()"
          color="danger"
          (ionChange)="onToggleEmergency($any($event).detail.checked)"
        ></ion-toggle>
      </div>

      
      <h3>1. Fotografía</h3>
      <div class="photo-box" [class.invalid]="photoError()">
        @if (photo(); as p) {
          <img [src]="p.webPath" alt="Fotografía del perro" />
          @if (analyzing()) {
            <div class="status">
              <span class="scan-dot"></span>
              <ion-spinner name="dots"></ion-spinner> {{ analyzingText() }}
            </div>
          } @else if (analysis(); as a) {
            <div class="result" [class.result-ok]="a.status === 'dog'" [class.result-warn]="a.status !== 'dog'">
              <ion-icon [icon]="a.status === 'dog' ? checkmarkCircle : alertCircle"></ion-icon>
              <p>{{ a.message }}</p>
            </div>
            @if (a.status === 'dog') {
              <p class="ok">🐾 Perro detectado ({{ pct(a.dogScore) }} %)</p>
            }
          }
        } @else {
          <div class="placeholder">🐶 Aún no hay fotografía</div>
        }
        <div class="photo-actions">
          <ion-button [fill]="photo() ? 'outline' : 'solid'" (click)="takePhoto()" [disabled]="analyzing()">
            <ion-icon slot="start" [icon]="photo() ? refreshOutline : cameraOutline"></ion-icon>
            {{ photo() ? 'Repetir' : 'Tomar foto' }}
          </ion-button>
          <ion-button fill="outline" (click)="pickPhoto()" [disabled]="analyzing()">
            <ion-icon slot="start" [icon]="imagesOutline"></ion-icon> Galería
          </ion-button>
        </div>
      </div>
      @if (photoError()) {
        <p class="pw-error">{{ photoError() }}</p>
      }

      
      <h3>2. Datos del perro</h3>

      <div class="dog-identity-card">
        <div class="dog-identity-head">
          <ion-icon [icon]="pawOutline"></ion-icon>
          <div>
            <h4>¿Ya conoces a este perro?</h4>
            <p>Agrupa reportes solo si estás seguro de que es el mismo. Si dudas, déjalo independiente.</p>
          </div>
        </div>
        <ion-segment [value]="dogMode()" (ionChange)="setDogMode($any($event).detail.value)">
          <ion-segment-button value="new"><ion-label>Nuevo</ion-label></ion-segment-button>
          <ion-segment-button value="existing"><ion-label>Existente</ion-label></ion-segment-button>
          <ion-segment-button value="ungrouped"><ion-label>No estoy seguro</ion-label></ion-segment-button>
        </ion-segment>

        @if (dogMode() === 'new') {
          <ion-input
            class="gap"
            label="Nombre del perro (opcional)"
            labelPlacement="floating"
            fill="outline"
            maxlength="40"
            placeholder="Ej: Toby"
            [value]="dogName()"
            (ionInput)="dogName.set($any($event).detail.value ?? '')"
          ></ion-input>
        } @else if (dogMode() === 'existing') {
          @if (selectedDog(); as dog) {
            <div class="selected-dog">
              @if (dog.photo_url) {
                <img [src]="dog.photo_url" alt="Foto del perro" />
              }
              <div>
                <b>{{ dog.name || 'Perrito sin nombre' }}</b>
                <p>ID {{ dog.id.slice(0, 8) }} · {{ dog.breed || 'Raza desconocida' }}</p>
              </div>
            </div>
            <ion-button size="small" fill="outline" (click)="openDogPicker()">Cambiar perro</ion-button>
          } @else {
            <ion-button class="gap" expand="block" fill="outline" (click)="openDogPicker()">
              Buscar perro existente
            </ion-button>
          }
        } @else {
          <p class="pw-hint">Se publicará como un reporte independiente, sin mezclarlo con otros perros.</p>
        }
        @if (dogError()) {
          <p class="pw-error">{{ dogError() }}</p>
        }
      </div>

      <ion-input
        [class.pw-invalid]="titleError()"
        label="Título del reporte"
        labelPlacement="floating"
        fill="outline"
        maxlength="80"
        [placeholder]="
          isEmergency() ? 'Ej: Perrito café atropellado en el parque' : 'Ej: Mi consentido Toby jugando en el parque'
        "
        [value]="title()"
        (ionInput)="title.set($any($event).detail.value ?? '')"
      ></ion-input>
      @if (titleError()) {
        <p class="pw-error">{{ titleError() }}</p>
      }

      @if (breedSuggestion(); as s) {
        <div class="ai-card" [class.ai-uncertain]="s.uncertain">
          <div class="ai-head">
            <ion-icon [icon]="sparkles"></ion-icon>
            @if (s.name) {
              <p>
                @if (s.uncertain) {
                  Posible raza: <b>{{ s.name }}</b>
                } @else {
                  Raza sugerida: <b>{{ s.name }}</b> ({{ pct(s.score) }} % de seguridad)
                }
              </p>
            } @else {
              <p>
                Parece un <b>{{ s.label }}</b>, pero esa raza no está en el catálogo.
              </p>
            }
          </div>
          @if (s.uncertain) {
            <p class="ai-note">{{ s.message }}</p>
          }
          @if (s.candidates.length > 1) {
            <div class="candidate-chips">
              @for (c of s.candidates; track c.label) {
                <button
                  type="button"
                  class="candidate"
                  [class.selected]="breed() === c.breed"
                  (click)="selectCandidate(c)"
                >
                  {{ c.breed || c.label }} <small>{{ pct(c.score) }} %</small>
                </button>
              }
            </div>
          }
          <div class="photo-actions">
            <ion-button size="small" (click)="confirmBreed()">✔ Es correcta</ion-button>
            <ion-button size="small" fill="outline" (click)="openBreedModal()">Elegir otra raza</ion-button>
          </div>
        </div>
      }

      <ion-item button [detail]="true" class="pw-pick" [class.pw-invalid]="breedError()" (click)="openBreedModal()">
        <ion-label>
          <p>Raza</p>
          <h3>{{ breed() || 'Toca para elegir una raza' }}</h3>
        </ion-label>
      </ion-item>
      @if (breedError()) {
        <p class="pw-error">{{ breedError() }}</p>
      }

      <ion-grid class="no-pad">
        <ion-row>
          <ion-col size="12" sizeMd="6">
            <ion-select
              [class.pw-invalid]="sizeError()"
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
            @if (sizeError()) {
              <p class="pw-error">{{ sizeError() }}</p>
            }
          </ion-col>
          <ion-col size="12" sizeMd="6">
            <ion-input
              [class.pw-invalid]="dateError()"
              [label]="isEmergency() ? 'Fecha y hora del avistamiento' : 'Fecha y hora de la foto'"
              labelPlacement="floating"
              fill="outline"
              type="datetime-local"
              [value]="foundAt()"
              [max]="maxDate"
              (ionInput)="onFoundAt($any($event).detail.value ?? '')"
            ></ion-input>
            @if (dateError()) {
              <p class="pw-error">{{ dateError() }}</p>
            }
          </ion-col>
        </ion-row>
      </ion-grid>

      <ion-textarea
        [class.pw-invalid]="descError()"
        label="Descripción"
        labelPlacement="floating"
        fill="outline"
        [rows]="3"
        [counter]="true"
        auto-grow
        maxlength="400"
        placeholder="Color, señas particulares, collar, personalidad…"
        [value]="description()"
        (ionInput)="description.set($any($event).detail.value ?? '')"
      ></ion-textarea>
      @if (descError()) {
        <p class="pw-error">{{ descError() }}</p>
      }

      <ion-textarea
        class="gap"
        label="Situación o detalles adicionales (opcional)"
        labelPlacement="floating"
        fill="outline"
        [rows]="3"
        [counter]="true"
        auto-grow
        maxlength="400"
        placeholder="Comportamiento, condición física o información extra…"
        [value]="situation()"
        (ionInput)="situation.set($any($event).detail.value ?? '')"
      ></ion-textarea>

      
      <h3>3. Ubicación</h3>
      <p class="pw-hint">Indica la zona donde se encuentra o vio al perrito.</p>

      
      <div class="privacy-card">
        <div class="privacy-header">
          <ion-icon [icon]="shieldCheckmarkOutline"></ion-icon>
          <div>
            <b>Seguridad y privacidad</b>
            <p>
              {{
                isApproximateLocation()
                  ? '🛡️ Ubicación aproximada (Radio general). Recomendada para mascotas en casa y evitar robos.'
                  : '📍 Ubicación precisa (Punto exacto). Ideal para rescate urgente en calle.'
              }}
            </p>
          </div>
        </div>
        <ion-segment
          [value]="isApproximateLocation() ? 'approx' : 'exact'"
          (ionChange)="isApproximateLocation.set($any($event).detail.value === 'approx')"
        >
          <ion-segment-button value="approx">
            <ion-label>🛡️ Aproximada (Segura)</ion-label>
          </ion-segment-button>
          <ion-segment-button value="exact">
            <ion-label>📍 Punto Exacto</ion-label>
          </ion-segment-button>
        </ion-segment>
      </div>

      @if (gps(); as g) {
        <app-mini-map
          [lat]="g.latitude"
          [lon]="g.longitude"
          [isApproximate]="isApproximateLocation()"
          (moved)="onMapMoved($event)"
        />
        <p class="pw-hint">
          {{
            isApproximateLocation()
              ? 'El mapa mostrará un radio aproximado para no revelar tu domicilio exacto.'
              : 'Arrastra el pin o toca el mapa para ajustar el punto exacto.'
          }}
        </p>
        @if (address()) {
          <p class="addr">📍 {{ address() }}</p>
        }
        <p class="coords">
          {{ g.latitude.toFixed(5) }}, {{ g.longitude.toFixed(5) }}
          @if (adjusted()) {
            · ajustada a mano
          } @else {
            · precisión ±{{ g.accuracy.toFixed(0) }} m
          }
        </p>
        @if (locationConfirmed()) {
          <p class="ok"><ion-icon [icon]="checkmarkCircle"></ion-icon> Ubicación confirmada</p>
        } @else {
          <ion-button expand="block" (click)="confirmLocation()">Confirmar esta ubicación</ion-button>
        }
      }

      <ion-button
        class="gap"
        [fill]="gps() ? 'outline' : 'solid'"
        expand="block"
        [disabled]="gpsLoading()"
        (click)="getLocation()"
      >
        @if (gpsLoading()) {
          <ion-spinner name="crescent"></ion-spinner>
        } @else {
          <ion-icon slot="start" [icon]="locationOutline"></ion-icon>
          {{ gps() ? 'Volver a obtener ubicación' : 'Obtener ubicación GPS' }}
        }
      </ion-button>
      @if (gpsError()) {
        <p class="pw-error">{{ gpsError() }}</p>
        <ion-button size="small" fill="clear" (click)="getLocation()">Reintentar</ion-button>
      }
      @if (locationError()) {
        <p class="pw-error">{{ locationError() }}</p>
      }

      <ion-input
        class="gap"
        [class.pw-invalid]="zoneError()"
        label="Barrio o sector de referencia"
        labelPlacement="floating"
        fill="outline"
        maxlength="60"
        placeholder="Ej: Cálamo, Las Granjas…"
        [value]="zone()"
        (ionInput)="onZoneInput($any($event).detail.value ?? '')"
      ></ion-input>
      @if (zoneError()) {
        <p class="pw-error">{{ zoneError() }}</p>
      }

      
      @if (gps()) {
        <h3>4. Clima en la zona</h3>
        @if (weatherLoading()) {
          <div class="center pw-loading"><ion-spinner name="dots"></ion-spinner> Consultando el clima…</div>
        } @else if (weather(); as w) {
          <app-weather-indicator [emoji]="w.weather_emoji" [summary]="weatherText()" [showNote]="true" />
        } @else if (weatherError()) {
          <p class="pw-error">{{ weatherError() }}</p>
          <ion-button size="small" fill="outline" (click)="loadWeather()">Reintentar clima</ion-button>
        }
      }

      
      @if (isEmergency()) {
        <div class="emergency-details-block">
          <h3>5. Nivel y Motivo de Urgencia 🚨</h3>
          <p class="pw-hint">Especifica la gravedad para coordinar con veterinarias o rescatistas.</p>

          <ion-segment [value]="urgencyLevel()" (ionChange)="urgencyLevel.set($any($event).detail.value)">
            @for (o of levelOptions; track o.value) {
              <ion-segment-button [value]="o.value">
                <ion-label>{{ o.label }}</ion-label>
              </ion-segment-button>
            }
          </ion-segment>

          <ion-select
            class="gap"
            [class.pw-invalid]="categoryError()"
            label="Categoría de la emergencia"
            labelPlacement="floating"
            fill="outline"
            interface="alert"
            [value]="urgencyCategory()"
            (ionChange)="urgencyCategory.set($any($event).detail.value)"
          >
            @for (o of categoryOptions; track o.value) {
              <ion-select-option [value]="o.value">{{ o.label }}</ion-select-option>
            }
          </ion-select>
          @if (categoryError()) {
            <p class="pw-error">{{ categoryError() }}</p>
          }

          
          @if (urgencyCategory() === 'otro') {
            <ion-input
              class="gap"
              [class.pw-invalid]="customCategoryError()"
              label="Escribe el motivo de la emergencia"
              labelPlacement="floating"
              fill="outline"
              maxlength="80"
              placeholder="Especifica el caso (ej: mordedura, encerrado en azotea...)"
              [value]="customCategory()"
              (ionInput)="customCategory.set($any($event).detail.value ?? '')"
            ></ion-input>
            @if (customCategoryError()) {
              <p class="pw-error">{{ customCategoryError() }}</p>
            }
          }
        </div>
      }

      <ion-button
        expand="block"
        class="publish"
        [class.publish-emergency]="isEmergency()"
        [disabled]="publishing() || analyzing()"
        (click)="submit()"
      >
        @if (publishing()) {
          <ion-spinner name="crescent"></ion-spinner>
        } @else {
          {{ isEmergency() ? '🚨 Publicar Alerta de Rescate' : '🐾 Publicar en Pawnder' }}
        }
      </ion-button>
    </ion-content>

    
    <ion-modal [isOpen]="breedModalOpen()" (didDismiss)="breedModalOpen.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Elegir raza</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="breedModalOpen.set(false)">Cerrar</ion-button>
            </ion-buttons>
          </ion-toolbar>
          <ion-toolbar>
            <ion-searchbar
              placeholder="Buscar raza…"
              [debounce]="150"
              (ionInput)="breedQuery.set($any($event).detail.value ?? '')"
            ></ion-searchbar>
          </ion-toolbar>
        </ion-header>
        <ion-content class="pw-form">
          @if (breedsLoading()) {
            <div class="center pw-loading"><ion-spinner name="crescent"></ion-spinner> Cargando razas…</div>
          } @else if (breedsError()) {
            <div class="center">
              <p class="pw-error">{{ breedsError() }}</p>
              <ion-button (click)="loadBreeds()">Reintentar</ion-button>
            </div>
          } @else {
            <ion-list>
              @for (b of filteredBreeds(); track b.id) {
                <ion-item button (click)="selectBreed(b.name)">
                  <ion-label>{{ b.name }}</ion-label>
                </ion-item>
              } @empty {
                <p class="center">No se encontraron razas con ese nombre.</p>
              }
            </ion-list>
          }
        </ion-content>
      </ng-template>
    </ion-modal>

    
    <ion-modal [isOpen]="dogPickerOpen()" (didDismiss)="onDogPickerDismiss()">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Buscar perro existente</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="onDogPickerDismiss()">Cerrar</ion-button>
            </ion-buttons>
          </ion-toolbar>
          <ion-toolbar>
            <ion-searchbar
              placeholder="Buscar por nombre o raza…"
              [debounce]="300"
              (ionInput)="onDogQuery($any($event).detail.value ?? '')"
            ></ion-searchbar>
          </ion-toolbar>
        </ion-header>
        <ion-content class="pw-form">
          @if (dogSearchLoading()) {
            <div class="center pw-loading"><ion-spinner name="crescent"></ion-spinner> Buscando perros…</div>
          } @else if (dogSearchError()) {
            <div class="center">
              <p class="pw-error">{{ dogSearchError() }}</p>
              <ion-button (click)="searchDogs()">Reintentar</ion-button>
            </div>
          } @else {
            <ion-list>
              @for (dog of dogSearchResults(); track dog.id) {
                <ion-item button (click)="previewDog(dog)">
                  @if (dog.photo_url) {
                    <img class="dog-result-photo" [src]="dog.photo_url" alt="Foto del perro" slot="start" />
                  }
                  <ion-label>
                    <h3>{{ dog.name || 'Perrito sin nombre' }}</h3>
                    <p>ID {{ dog.id.slice(0, 8) }} · {{ dog.breed || 'Raza desconocida' }}</p>
                  </ion-label>
                </ion-item>
              } @empty {
                <p class="center">No se encontraron perros con ese nombre o raza.</p>
              }
            </ion-list>
          }

          @if (dogPreview(); as dog) {
            <div class="dog-preview">
              @if (dog.photo_url) {
                <img [src]="dog.photo_url" alt="Vista previa del perro" />
              }
              <h4>{{ dog.name || 'Perrito sin nombre' }}</h4>
              <p>ID {{ dog.id.slice(0, 8) }} · {{ dog.breed || 'Raza desconocida' }}</p>
              <p class="pw-hint">Confirma que es el mismo perro antes de vincular tu reporte.</p>
              <div class="photo-actions">
                <ion-button size="small" (click)="confirmDog(dog)">Usar este perro</ion-button>
                <ion-button size="small" fill="outline" (click)="dogPreview.set(null)">Cancelar</ion-button>
              </div>
            </div>
          }
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [
    `
      h3 {
        margin: 22px 0 8px;
        font-size: 1.05rem;
        font-weight: 800;
        color: #1b6b53;
      }
      .gap {
        margin-top: 14px;
      }
      .no-pad {
        padding: 0;
        margin-top: 8px;
      }
      .emergency-toggle-card {
        background: #fdfaf6;
        border: 2px solid #bfe9da;
        border-radius: var(--pw-card-radius);
        padding: 14px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
        transition: all 0.25s ease;
      }
      .emergency-toggle-card.is-emergency {
        background: #fff4f2;
        border-color: #ff7a59;
        box-shadow: 0 4px 14px rgba(229, 56, 59, 0.15);
      }
      .toggle-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .toggle-icon {
        font-size: 28px;
        color: #1b8a6b;
      }
      .emergency-toggle-card.is-emergency .toggle-icon {
        color: #e5383b;
      }
      .toggle-info h4 {
        margin: 0;
        font-size: 0.98rem;
        font-weight: 800;
        color: #2f2a26;
      }
      .toggle-info p {
        margin: 2px 0 0;
        font-size: 0.78rem;
        color: #7a726a;
        max-width: 220px;
      }
      .dog-identity-card {
        background: #f2fbf7;
        border: 1px solid #c8ede0;
        border-radius: var(--pw-card-radius);
        padding: 12px;
        margin-bottom: 14px;
      }
      .dog-identity-head {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        margin-bottom: 10px;
      }
      .dog-identity-head ion-icon {
        font-size: 24px;
        color: #1b8a6b;
        flex-shrink: 0;
      }
      .dog-identity-head h4 {
        margin: 0;
        font-size: 0.92rem;
        color: #1b6b53;
      }
      .dog-identity-head p {
        margin: 2px 0 0;
        font-size: 0.76rem;
        color: #7a726a;
      }
      .selected-dog,
      .dog-preview {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 10px 0;
        padding: 8px;
        background: #fff;
        border: 1px solid #d8efe5;
        border-radius: 12px;
      }
      .selected-dog img,
      .dog-preview img,
      .dog-result-photo {
        width: 52px;
        height: 52px;
        object-fit: cover;
        border-radius: 10px;
        flex-shrink: 0;
      }
      .selected-dog b,
      .dog-preview h4 {
        margin: 0;
        font-size: 0.9rem;
        color: #2f2a26;
      }
      .selected-dog p,
      .dog-preview p {
        margin: 2px 0;
        font-size: 0.76rem;
        color: #7a726a;
      }
      .dog-preview {
        display: block;
        text-align: center;
      }
      .dog-preview img {
        width: 100%;
        height: 140px;
      }
      .dog-result-photo {
        margin-right: 10px;
      }
      .privacy-card {
        background: #f2fbf7;
        border: 1px solid #c8ede0;
        border-radius: var(--pw-card-radius);
        padding: 12px;
        margin-bottom: 14px;
      }
      .privacy-header {
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
      }
      .privacy-header ion-icon {
        font-size: 24px;
        color: #1b8a6b;
        flex-shrink: 0;
      }
      .privacy-header b {
        font-size: 0.9rem;
        color: #1b6b53;
      }
      .privacy-header p {
        margin: 2px 0 0;
        font-size: 0.78rem;
        color: #555;
      }
      .photo-box {
        background: #fff;
        border-radius: var(--pw-card-radius);
        padding: 12px;
        text-align: center;
        border: 2px dashed #bfe9da;
      }
      .photo-box.invalid {
        border-color: var(--ion-color-danger);
      }
      .photo-box img {
        width: 100%;
        max-height: 280px;
        object-fit: cover;
        border-radius: 14px;
      }
      .placeholder {
        padding: 36px 0;
        color: #8a817a;
      }
      .photo-actions {
        display: flex;
        gap: 8px;
        margin-top: 10px;
      }
      .photo-actions ion-button {
        flex: 1;
        margin: 0;
      }
      .status {
        margin-top: 8px;
        color: #6b625b;
        font-size: 0.85rem;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 6px;
      }
      .ok {
        color: #1b8a6b;
        font-weight: 700;
        margin: 8px 0 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .warn {
        color: #9a5a00;
        font-size: 0.85rem;
        margin: 8px 0 0;
      }
      .result {
        margin-top: 8px;
        padding: 8px 10px;
        border-radius: 12px;
        font-size: 0.82rem;
        display: flex;
        align-items: flex-start;
        gap: 8px;
        text-align: left;
        line-height: 1.35;
        animation: result-in 0.28s ease-out;
      }
      .result ion-icon {
        font-size: 18px;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .result p {
        margin: 0;
      }
      .result-ok {
        background: #eaf8f2;
        color: #1b6b53;
      }
      .result-warn {
        background: #fff6e8;
        color: #8a5a00;
      }
      @keyframes result-in {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .scan-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6);
        animation: scan-pulse 1.2s infinite;
      }
      @keyframes scan-pulse {
        70% {
          box-shadow: 0 0 0 9px rgba(16, 185, 129, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
        }
      }
      .ai-card {
        background: #eaf8f2;
        border: 1px solid #bfe9da;
        border-radius: 14px;
        padding: 10px 12px;
        margin-top: 12px;
      }
      .ai-card.ai-uncertain {
        background: #fff8ec;
        border-color: #f7d9a6;
      }
      .ai-head {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }
      .ai-head ion-icon {
        font-size: 20px;
        color: #1b8a6b;
        flex-shrink: 0;
      }
      .ai-card p {
        margin: 0 0 4px;
        color: #2f4a40;
      }
      .ai-note {
        font-size: 0.8rem;
        color: #8a5a00;
        margin: 6px 0 0 !important;
      }
      .candidate-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 10px 0 2px;
      }
      .candidate {
        border: 1px solid #bfe9da;
        background: #fff;
        color: #1b6b53;
        border-radius: 999px;
        padding: 6px 12px;
        font: inherit;
        font-size: 0.78rem;
        font-weight: 700;
        cursor: pointer;
        transition:
          transform 0.15s ease,
          background 0.15s ease;
      }
      .candidate small {
        opacity: 0.7;
        font-weight: 600;
      }
      .candidate:active {
        transform: scale(0.95);
      }
      .candidate.selected {
        background: #10b981;
        border-color: #10b981;
        color: #fff;
      }
      .addr {
        margin: 8px 2px 0;
        font-weight: 600;
        color: #2f2a26;
      }
      .coords {
        margin: 2px 2px 10px;
        font-size: 0.75rem;
        color: #8a817a;
      }
      .center {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 24px 12px;
        color: #6b625b;
      }
      .emergency-details-block {
        background: #fff6f4;
        border: 1px solid #ffd4cb;
        padding: 14px;
        border-radius: var(--pw-card-radius);
        margin-top: 16px;
      }
      .publish {
        margin: 28px 0 40px;
        --border-radius: 14px;
        height: 52px;
        font-weight: 800;
      }
      .publish-emergency {
        --background: #e5383b;
        --color: #ffffff;
      }
    `,
  ],
})
export class CreateReportPage implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly camera = inject(CameraService);
  private readonly location = inject(LocationService);
  private readonly geocoder = inject(GeocodingService);
  private readonly weatherApi = inject(WeatherService);
  private readonly breedsApi = inject(BreedsService);
  private readonly reports = inject(ReportsService);
  private readonly storage = inject(StorageService);
  private readonly prefs = inject(PreferencesService);
  private readonly ui = inject(UiService);
  protected readonly vision = inject(DogVisionService);

  protected readonly cameraOutline = cameraOutline;
  protected readonly imagesOutline = imagesOutline;
  protected readonly checkmarkCircle = checkmarkCircle;
  protected readonly locationOutline = locationOutline;
  protected readonly refreshOutline = refreshOutline;
  protected readonly sparkles = sparkles;
  protected readonly alertCircle = alertCircle;
  protected readonly shieldCheckmarkOutline = shieldCheckmarkOutline;
  protected readonly pawOutline = pawOutline;
  protected readonly sizeOptions = SIZE_OPTIONS;
  protected readonly levelOptions = URGENCY_LEVEL_OPTIONS;
  protected readonly categoryOptions = URGENCY_CATEGORY_OPTIONS;
  protected readonly maxDate = toLocalInput(new Date(Date.now() + 5 * 60000));

  
  protected readonly photo = signal<CapturedPhoto | null>(null);
  protected readonly breed = signal('');
  protected readonly size = signal<DogSize | ''>('');
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly situation = signal('');
  protected readonly zone = signal('');
  protected readonly foundAt = signal(toLocalInput(new Date()));

  
  protected readonly isEmergency = signal(false);
  protected readonly urgencyLevel = signal<UrgencyLevel>('alta');
  protected readonly urgencyCategory = signal<UrgencyCategory | ''>('');
  protected readonly customCategory = signal('');
  protected readonly isApproximateLocation = signal(true); 

  
  protected readonly analyzing = signal(false);
  protected readonly analysis = signal<DogAnalysis | null>(null);
  protected readonly breedSuggestion = signal<BreedSuggestion | null>(null);
  protected readonly analyzingText = computed(() => {
    const status = this.vision.modelStatus();
    if (status === 'loading') return 'Preparando al detector de perritos (solo la primera vez)…';
    if (status === 'error') return 'Analizando con el modelo disponible…';
    return 'Buscando al perrito y su raza…';
  });

  
  protected readonly breeds = signal<Breed[]>([]);
  protected readonly breedsLoading = signal(false);
  protected readonly breedsError = signal('');
  protected readonly breedModalOpen = signal(false);
  protected readonly breedQuery = signal('');
  protected readonly filteredBreeds = computed(() => {
    const q = this.breedQuery().trim().toLowerCase();
    return this.breeds()
      .filter((b) => b.name.toLowerCase().includes(q))
      .slice(0, 200);
  });

  
  protected readonly gps = signal<GpsFix | null>(null);
  protected readonly gpsLoading = signal(false);
  protected readonly gpsError = signal('');
  protected readonly adjusted = signal(false);
  protected readonly address = signal('');
  protected readonly locationConfirmed = signal(false);
  protected readonly weather = signal<WeatherSnapshot | null>(null);
  protected readonly weatherLoading = signal(false);
  protected readonly weatherError = signal('');
  protected readonly weatherText = computed(() => {
    const w = this.weather();
    return w ? weatherSummary(w) : '';
  });

  
  protected readonly submitted = signal(false);
  protected readonly publishing = signal(false);

  
  protected readonly dogMode = signal<'new' | 'existing' | 'ungrouped'>('new');
  protected readonly dogName = signal('');
  protected readonly selectedDog = signal<DogIdentity | null>(null);
  protected readonly dogPickerOpen = signal(false);
  protected readonly dogQuery = signal('');
  protected readonly dogSearchResults = signal<DogIdentity[]>([]);
  protected readonly dogSearchLoading = signal(false);
  protected readonly dogSearchError = signal('');
  protected readonly dogPreview = signal<DogIdentity | null>(null);

  
  protected readonly dogError = computed(() =>
    this.submitted() && this.dogMode() === 'existing' && !this.selectedDog()
      ? 'Busca y confirma el perro existente antes de publicar.'
      : '',
  );
  protected readonly photoError = computed(() =>
    this.submitted() && !this.photo() ? 'Toma o elige una fotografía del perro.' : '',
  );
  protected readonly titleError = computed(() =>
    this.submitted() && this.title().trim().length < 3 ? 'El título debe tener al menos 3 caracteres.' : '',
  );
  protected readonly breedError = computed(() =>
    this.submitted() && !this.breed() ? 'Selecciona una raza (o "Mestizo" / "Raza desconocida").' : '',
  );
  protected readonly sizeError = computed(() =>
    this.submitted() && !this.size() ? 'Selecciona el tamaño aproximado.' : '',
  );
  protected readonly dateError = computed(() => {
    if (!this.submitted()) return '';
    const value = this.foundAt();
    if (!value) return 'Indica la fecha y hora del encuentro.';
    return new Date(value).getTime() > Date.now() + 5 * 60000 ? 'La fecha no puede estar en el futuro.' : '';
  });
  protected readonly descError = computed(() =>
    this.submitted() && this.description().trim().length < 10 ? 'Describe al perro con al menos 10 caracteres.' : '',
  );
  protected readonly zoneError = computed(() =>
    this.submitted() && this.zone().trim().length < 2 ? 'Indica el barrio o sector.' : '',
  );
  protected readonly locationError = computed(() => {
    if (!this.submitted()) return '';
    if (!this.gps()) return 'Obtén la ubicación GPS del hallazgo.';
    return this.locationConfirmed() ? '' : 'Confirma la ubicación antes de publicar.';
  });
  protected readonly categoryError = computed(() =>
    this.submitted() && this.isEmergency() && !this.urgencyCategory()
      ? 'Elige la categoría de la situación urgente.'
      : '',
  );
  protected readonly customCategoryError = computed(() =>
    this.submitted() &&
    this.isEmergency() &&
    this.urgencyCategory() === 'otro' &&
    this.customCategory().trim().length < 3
      ? 'Describe el motivo de la emergencia.'
      : '',
  );

  private draftReady = false;
  private zoneAuto = true;

  constructor() {
    effect(() => {
      const draft: ReportDraft = {
        breed: this.breed(),
        size: this.size(),
        title: this.title(),
        description: this.description(),
        situation: this.situation(),
        zone: this.zone(),
        isEmergency: this.isEmergency(),
        urgencyLevel: this.urgencyLevel(),
        urgencyCategory: this.urgencyCategory(),
        customCategory: this.customCategory(),
        isApproximateLocation: this.isApproximateLocation(),
      };
      if (this.draftReady) void this.prefs.set(PREF_KEYS.reportDraft, draft);
    });
  }

  async ngOnInit(): Promise<void> {
    const draft = await this.prefs.get<ReportDraft | null>(PREF_KEYS.reportDraft, null);
    if (draft && (draft.title || draft.description || draft.breed || draft.zone)) {
      this.breed.set(draft.breed ?? '');
      this.size.set(draft.size ?? '');
      this.title.set(draft.title ?? '');
      this.description.set(draft.description ?? '');
      this.situation.set(draft.situation ?? '');
      this.zone.set(draft.zone ?? '');
      this.zoneAuto = !draft.zone;
      this.isEmergency.set(draft.isEmergency ?? false);
      this.urgencyLevel.set(draft.urgencyLevel ?? 'alta');
      this.urgencyCategory.set(draft.urgencyCategory ?? '');
      this.customCategory.set(draft.customCategory ?? '');
      this.isApproximateLocation.set(draft.isApproximateLocation ?? true);
      void this.ui.toast('Recuperamos tu borrador anterior ✏️', 'medium');
    }
    this.draftReady = true;
    void this.loadBreeds();
    this.vision.preload();
  }

  protected pct(value: number): number {
    return Math.round(value * 100);
  }

  
  protected setDogMode(mode: 'new' | 'existing' | 'ungrouped'): void {
    this.dogMode.set(mode);
    if (mode !== 'existing') {
      this.selectedDog.set(null);
      this.dogPreview.set(null);
    }
  }

  protected openDogPicker(): void {
    this.dogPickerOpen.set(true);
    this.dogPreview.set(null);
    void this.searchDogs();
  }

  protected onDogPickerDismiss(): void {
    this.dogPickerOpen.set(false);
    this.dogPreview.set(null);
  }

  protected onDogQuery(value: string): void {
    this.dogQuery.set(value);
    void this.searchDogs();
  }

  protected async searchDogs(): Promise<void> {
    this.dogSearchLoading.set(true);
    this.dogSearchError.set('');
    try {
      this.dogSearchResults.set(await this.reports.searchDogs(this.dogQuery()));
    } catch {
      this.dogSearchError.set('No se pudo cargar la lista de perros.');
    } finally {
      this.dogSearchLoading.set(false);
    }
  }

  protected previewDog(dog: DogIdentity): void {
    this.dogPreview.set(dog);
  }

  protected confirmDog(dog: DogIdentity): void {
    this.selectedDog.set(dog);
    if (dog.breed && !this.breed()) {
      this.breed.set(dog.breed);
    }
    if (dog.size && !this.size()) {
      this.size.set(dog.size);
    }
    this.onDogPickerDismiss();
  }

  protected onToggleEmergency(checked: boolean): void {
    this.isEmergency.set(checked);
    if (!checked) {
      this.isApproximateLocation.set(true); 
    }
  }

  
  protected async takePhoto(): Promise<void> {
    await this.acquirePhoto(() => this.camera.takePhoto());
  }

  protected async pickPhoto(): Promise<void> {
    await this.acquirePhoto(() => this.camera.pickFromGallery());
  }

  private async acquirePhoto(getter: () => Promise<CapturedPhoto>): Promise<void> {
    try {
      const photo = await getter();
      this.photo.set(photo);
      await this.analyzePhoto(photo);
    } catch (e) {
      if (e instanceof HardwareError) {
        if (e.kind === 'cancelled') return;
        if (e.kind === 'denied') {
          await this.ui.notice('Permiso de cámara', e.message);
          return;
        }
        await this.ui.toast(e.message, 'danger');
      } else {
        await this.ui.toast('No se pudo obtener la fotografía.', 'danger');
      }
    }
  }

  private async analyzePhoto(photo: CapturedPhoto): Promise<void> {
    this.analysis.set(null);
    this.breedSuggestion.set(null);
    this.analyzing.set(true);
    try {
      if (this.breeds().length === 0 && !this.breedsLoading()) await this.loadBreeds();
      const extraIds = this.breedsApi.extraOptions.map((b) => b.id);
      const apiBreeds = this.breeds().filter((b) => !extraIds.includes(b.id));

      const result = await this.vision.analyze(photo.blob, apiBreeds);
      if (this.photo() !== photo) return;

      this.analysis.set(result);
      if (result.status === 'dog') {
        if (result.suggestion) this.breed.set(result.suggestion);
        this.breedSuggestion.set({
          name: result.suggestion,
          label: result.breedLabel,
          score: result.breedScore,
          message: result.message,
          uncertain: result.uncertain,
          candidates: result.candidates,
        });
      } else {
        this.breedSuggestion.set(null);
      }
    } finally {
      this.analyzing.set(false);
    }
  }

  protected selectCandidate(candidate: BreedCandidate): void {
    if (candidate.breed) {
      this.breed.set(candidate.breed);
      void this.ui.toast('Raza actualizada ✔', 'success');
    } else {
      this.openBreedModal();
    }
  }

  protected confirmBreed(): void {
    this.breedSuggestion.set(null);
    void this.ui.toast('Raza confirmada ✔', 'success');
  }

  
  protected async loadBreeds(): Promise<void> {
    this.breedsLoading.set(true);
    this.breedsError.set('');
    try {
      this.breeds.set(await firstValueFrom(this.breedsApi.getBreeds()));
    } catch (e) {
      this.breedsError.set(e instanceof Error ? e.message : 'No se pudieron cargar las razas.');
    } finally {
      this.breedsLoading.set(false);
    }
  }

  protected openBreedModal(): void {
    this.breedQuery.set('');
    this.breedModalOpen.set(true);
    if (this.breeds().length === 0 && !this.breedsLoading()) void this.loadBreeds();
  }

  protected selectBreed(name: string): void {
    this.breed.set(name);
    this.breedSuggestion.set(null);
    this.breedModalOpen.set(false);
  }

  
  protected onFoundAt(value: string): void {
    this.foundAt.set(value ?? '');
  }

  protected onZoneInput(value: string): void {
    this.zone.set(value);
    this.zoneAuto = false;
  }

  
  protected async getLocation(): Promise<void> {
    this.gpsLoading.set(true);
    this.gpsError.set('');
    this.locationConfirmed.set(false);
    try {
      this.gps.set(await this.location.getCurrentFix());
      this.adjusted.set(false);
      void this.refreshLocationInfo();
    } catch (e) {
      this.gpsError.set(e instanceof Error ? e.message : 'No se pudo obtener la ubicación.');
    } finally {
      this.gpsLoading.set(false);
    }
  }

  protected onMapMoved(point: { latitude: number; longitude: number }): void {
    this.gps.set({ latitude: point.latitude, longitude: point.longitude, accuracy: 0 });
    this.adjusted.set(true);
    this.locationConfirmed.set(false);
    void this.refreshLocationInfo();
  }

  protected confirmLocation(): void {
    this.locationConfirmed.set(true);
    void this.ui.toast('Ubicación confirmada 📍', 'success');
  }

  private async refreshLocationInfo(): Promise<void> {
    await Promise.all([this.loadWeather(), this.loadAddress()]);
  }

  private async loadAddress(): Promise<void> {
    const g = this.gps();
    if (!g) return;
    this.address.set('');
    const result = await firstValueFrom(this.geocoder.reverse(g.latitude, g.longitude));
    if (!result) return;
    this.address.set(result.displayName);
    if (result.zone && (this.zoneAuto || !this.zone().trim())) {
      this.zone.set(result.zone);
      this.zoneAuto = true;
    }
  }

  protected async loadWeather(): Promise<void> {
    const g = this.gps();
    if (!g) return;
    this.weatherLoading.set(true);
    this.weatherError.set('');
    try {
      this.weather.set(await firstValueFrom(this.weatherApi.getCurrent(g.latitude, g.longitude)));
    } catch (e) {
      this.weather.set(null);
      this.weatherError.set(e instanceof Error ? e.message : 'No se pudo consultar el clima.');
    } finally {
      this.weatherLoading.set(false);
    }
  }

  
  protected async submit(): Promise<void> {
    if (this.publishing()) return;
    this.submitted.set(true);

    const hasErrors =
      this.dogError() ||
      this.photoError() ||
      this.titleError() ||
      this.breedError() ||
      this.sizeError() ||
      this.dateError() ||
      this.descError() ||
      this.zoneError() ||
      this.locationError() ||
      this.categoryError() ||
      this.customCategoryError();

    if (hasErrors) {
      await this.ui.toast('Revisa los campos marcados en rojo.', 'warning');
      return;
    }

    const user = this.auth.user();
    const photo = this.photo();
    const gps = this.gps();
    if (!user || !photo || !gps) {
      await this.ui.toast('Debes iniciar sesión para publicar.', 'danger');
      return;
    }

    this.publishing.set(true);
    let uploadedPath: string | null = null;
    let createdDogId: string | null = null;
    let reportCreated = false;
    try {
      const uploaded = await this.storage.uploadPhoto(photo.blob, user.id);
      uploadedPath = uploaded.path;
      const w = this.weather();

      let dogId: string | null = null;
      let parentReportId: string | null = null;
      if (this.dogMode() === 'new') {
        const dog = await this.reports.createDog(
          {
            name: this.dogName().trim() || null,
            breed: this.breed(),
            size: this.size() as DogSize,
            photo_url: uploaded.publicUrl,
          },
          user.id,
        );
        dogId = dog.id;
        createdDogId = dog.id;
      } else if (this.dogMode() === 'existing') {
        const sel = this.selectedDog();
        if (!sel) {
          throw new Error('Debes seleccionar un perro existente para continuar.');
        }
        
        dogId = await this.reports.resolveDogIdForReport(sel, user.id);
        
        parentReportId = sel.origin_report_id ?? null;
      }

      
      
      let finalLat = gps.latitude;
      let finalLng = gps.longitude;
      if (this.isApproximateLocation()) {
        const offsetLat = (Math.random() - 0.5) * 0.003;
        const offsetLng = (Math.random() - 0.5) * 0.003;
        finalLat += offsetLat;
        finalLng += offsetLng;
      }

      const isEm = this.isEmergency();
      const customReason = isEm && this.urgencyCategory() === 'otro' ? this.customCategory().trim() : '';
      const situationParts = [customReason ? `Motivo de emergencia: ${customReason}` : '', this.situation().trim()];

      const report: NewDogReport = {
        dog_id: dogId,
        parent_report_id: parentReportId,
        title: this.title().trim(),
        photo_url: uploaded.publicUrl,
        photo_path: uploaded.path,
        breed: this.breed(),
        size: this.size() as DogSize,
        description: this.description().trim(),
        situation: situationParts.filter(Boolean).join('\n\n') || null,
        found_at: new Date(this.foundAt()).toISOString(),
        urgency_level: isEm ? this.urgencyLevel() : 'normal',
        urgency_category: isEm ? this.urgencyCategory() || null : null,
        latitude: finalLat,
        longitude: finalLng,
        zone: this.zone().trim(),
        weather_code: w?.weather_code ?? null,
        weather_description: w?.weather_description ?? null,
        weather_emoji: w?.weather_emoji ?? null,
        temperature: w?.temperature ?? null,
        humidity: w?.humidity ?? null,
        precipitation: w?.precipitation ?? null,
        wind_speed: w?.wind_speed ?? null,
        report_status: 'activo',
      };

      await this.reports.create(report, user.id);
      reportCreated = true;
      this.draftReady = false;
      await this.prefs.remove(PREF_KEYS.reportDraft);
      await this.router.navigateByUrl('/home', { replaceUrl: true });
      await this.ui.toast(
        isEm
          ? '¡Alerta de rescate publicada! La comunidad ha sido notificada 🚨'
          : '¡Mascota compartida! Gracias por ser parte de Pawnder 🐾',
        'success',
      );
    } catch (e) {
      if (createdDogId && !reportCreated) await this.reports.deleteDog(createdDogId).catch(() => undefined);
      if (uploadedPath) await this.storage.deletePhoto(uploadedPath).catch(() => undefined);
      await this.ui.toast(e instanceof Error ? e.message : 'No se pudo publicar el reporte.', 'danger');
    } finally {
      this.publishing.set(false);
    }
  }
}
