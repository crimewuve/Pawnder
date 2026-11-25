import { Component, computed, input, output } from '@angular/core';
import { IonCard, IonCardContent, IonIcon } from '@ionic/angular';
import {
  alertCircle,
  chatbubbleEllipsesOutline,
  createOutline,
  locationOutline,
  pawOutline,
  shieldCheckmarkOutline,
  timeOutline,
  trashOutline,
} from 'ionicons/icons';

import { weatherSummary } from '../../../core/services/weather.service';
import { formatDateTime } from '../../../core/utils/format';
import type { DogReport } from '../../../models/dog-report.model';
import {
  STATUS_OPTIONS,
  URGENCY_CATEGORY_OPTIONS,
  URGENCY_LEVEL_OPTIONS,
  labelOf,
} from '../../../models/dog-report.model';
import { PhotoCarouselComponent } from '../photo-carousel/photo-carousel.component';
import { WeatherIndicatorComponent } from '../weather-indicator/weather-indicator.component';

@Component({
  selector: 'app-report-card',
  imports: [IonCard, IonCardContent, IonIcon, PhotoCarouselComponent, WeatherIndicatorComponent],
  template: `
    <ion-card
      class="paw-card"
      [class.card-critical]="report().urgency_level === 'critica'"
      [class.card-high]="report().urgency_level === 'alta'"
      [class.card-resolved]="report().report_status === 'resuelto'"
      [button]="true"
      (click)="open.emit(report().id)"
    >
      <!-- Top Frame / Photography -->
      <div class="photo-wrapper">
        <app-photo-carousel [photos]="photoUrls()" [alt]="report().title" />

        <!-- Pawnder ID Tag -->
        <div class="pawn-tag">
          <ion-icon [icon]="pawOutline"></ion-icon>
          <span>{{ pawnId() }}</span>
        </div>

        <!-- Emergency or Community Badge -->
        @if (report().urgency_level !== 'normal') {
          <div class="pill-badge pill-alert" [class.alert-crit]="report().urgency_level === 'critica'">
            <ion-icon [icon]="alertCircle"></ion-icon>
            <span>{{ report().urgency_level === 'critica' ? 'CRÍTICA' : 'URGENTE' }}</span>
          </div>
        } @else {
          <div class="pill-badge pill-pet">
            <ion-icon [icon]="shieldCheckmarkOutline"></ion-icon>
            <span>MASCOTA</span>
          </div>
        }

        <!-- Status Tag (Top Right) -->
        <div class="status-pill status-{{ report().report_status }}">
          {{ statusLabel() }}
        </div>
      </div>

      <!-- Card Body: Pawnder Stats & Metadata -->
      <ion-card-content class="card-body">
        <div class="headline-row">
          <h2 class="title">{{ report().title }}</h2>
        </div>

        <!-- Breed and Size Pills -->
        <div class="stats-pills">
          <span class="stat-chip breed-chip">
            <b>{{ report().breed }}</b>
          </span>
          <span class="stat-chip size-chip">
            {{ sizeLabel() }}
          </span>
          @if (categoryLabel()) {
            <span class="stat-chip cat-chip">
              {{ categoryLabel() }}
            </span>
          }
        </div>

        <p class="description">{{ report().description }}</p>

        <!-- Location & Time Info -->
        <div class="meta-row">
          <div class="meta-item">
            <ion-icon [icon]="locationOutline"></ion-icon>
            <span>{{ report().zone || 'Sin sector' }}</span>
            @if (report().is_approximate_location) {
              <small class="approx-tag">(Aprox)</small>
            }
          </div>
          <div class="meta-item">
            <ion-icon [icon]="timeOutline"></ion-icon>
            <span>{{ date() }}</span>
          </div>
        </div>

        <!-- Weather summary indicator -->
        <div class="weather-row">
          <app-weather-indicator [emoji]="report().weather_emoji" [summary]="weather()" />
        </div>

        <!-- Footer: Social author & comments -->
        <div class="card-footer">
          <button
            type="button"
            class="author-info"
            (click)="openAuthor($event)"
            [attr.aria-label]="'Ver perfil de ' + authorName()"
          >
            @if (authorAvatar()) {
              <img class="author-avatar" [src]="authorAvatar()" [alt]="authorName()" />
            } @else {
              <div class="author-avatar">{{ authorInitial() }}</div>
            }
            <span>{{ authorName() }}</span>
          </button>
          <div class="footer-right">
            <div class="comments-count">
              <ion-icon [icon]="chatbubbleEllipsesOutline"></ion-icon>
              <span>{{ comments() }}</span>
            </div>
            @if (showActions()) {
              <div class="owner-actions">
                <button type="button" class="action-btn" aria-label="Editar publicación" (click)="editReport($event)">
                  <ion-icon [icon]="createOutline"></ion-icon>
                </button>
                <button
                  type="button"
                  class="action-btn danger"
                  aria-label="Eliminar publicación"
                  (click)="deleteReport($event)"
                >
                  <ion-icon [icon]="trashOutline"></ion-icon>
                </button>
              </div>
            }
          </div>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [
    `
      .paw-card {
        margin: 12px 0;
        border-radius: 24px;
        background: #ffffff;
        box-shadow: 0 4px 18px -2px rgba(19, 78, 63, 0.07), 0 2px 6px -1px rgba(0, 0, 0, 0.03);
        border: 1px solid rgba(215, 232, 225, 0.85);
        overflow: hidden;
        transition:
          transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
          box-shadow 0.22s ease,
          border-color 0.22s ease;
      }
      .paw-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 10px 25px -4px rgba(19, 78, 63, 0.12);
        border-color: #75D6B3;
      }
      .paw-card:active {
        transform: scale(0.985);
      }
      .paw-card.card-critical {
        border: 2px solid #ef4444;
        box-shadow: 0 8px 24px -3px rgba(239, 68, 68, 0.22);
      }
      .paw-card.card-high {
        border: 2px solid #f59e0b;
        box-shadow: 0 6px 20px -3px rgba(245, 158, 11, 0.18);
      }
      .paw-card.card-resolved {
        opacity: 0.7;
        filter: grayscale(0.2);
      }

      /* Photo area */
      .photo-wrapper {
        position: relative;
        width: 100%;
        height: 240px;
        background: #eef7f3;
        overflow: hidden;
      }

      .pawn-tag {
        position: absolute;
        bottom: 12px;
        left: 12px;
        background: rgba(19, 78, 63, 0.88);
        backdrop-filter: blur(8px);
        color: #ffffff;
        font-family: var(--pw-font-mono);
        font-size: 0.75rem;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        gap: 5px;
        z-index: 10;
        border: 1px solid rgba(255, 255, 255, 0.25);
      }
      .pawn-tag ion-icon {
        color: #75D6B3;
        font-size: 13px;
      }

      .pill-badge {
        position: absolute;
        top: 12px;
        left: 12px;
        padding: 5px 12px;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 5px;
        z-index: 10;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
      }
      .pill-alert {
        background: #f59e0b;
      }
      .pill-alert.alert-crit {
        background: #ef4444;
        animation: pulse-soft 1.8s infinite;
      }
      .pill-pet {
        background: #134e3f;
        color: #75D6B3;
      }
      .pill-badge ion-icon {
        font-size: 13px;
      }

      .status-pill {
        position: absolute;
        top: 12px;
        right: 12px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        z-index: 10;
        color: #ffffff;
      }
      .status-activo {
        background: #75D6B3;
        color: #134e3f;
      }
      .status-en_proceso {
        background: #f59e0b;
        color: #ffffff;
      }
      .status-resuelto {
        background: #64748b;
        color: #ffffff;
      }

      /* Body */
      .card-body {
        padding: 16px 18px;
      }
      .headline-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 8px;
      }
      .title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 800;
        color: #134e3f;
        line-height: 1.3;
      }

      .stats-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 10px;
      }
      .stat-chip {
        font-size: 0.78rem;
        padding: 3px 10px;
        border-radius: 8px;
        font-weight: 600;
      }
      .breed-chip {
        background: #eafaf4;
        color: #134e3f;
        border: 1px solid #c2ebd9;
      }
      .size-chip {
        background: #f4efe6;
        color: #5c4d3c;
      }
      .cat-chip {
        background: #fff3e6;
        color: #c25e00;
      }

      .description {
        margin: 0 0 12px;
        font-size: 0.92rem;
        color: #4b6358;
        line-height: 1.45;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .meta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin-bottom: 10px;
        font-size: 0.8rem;
        color: #7d968b;
      }
      .meta-item {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .meta-item ion-icon {
        color: #75D6B3;
        font-size: 15px;
      }
      .approx-tag {
        color: #9ca3af;
        font-style: italic;
      }

      .weather-row {
        margin-bottom: 12px;
      }

      /* Card Footer */
      .card-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #f0f5f2;
        padding-top: 12px;
        margin-top: 4px;
      }
      .author-info {
        display: flex;
        align-items: center;
        gap: 8px;
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.82rem;
        font-weight: 700;
        color: #134e3f;
      }
      .author-avatar {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        object-fit: cover;
        background: #eafaf4;
        color: #134e3f;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 0.85rem;
        border: 2px solid #75D6B3;
      }
      .footer-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .comments-count {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.82rem;
        color: #7d968b;
        font-weight: 700;
      }
      .comments-count ion-icon {
        font-size: 15px;
        color: #75D6B3;
      }
      .owner-actions {
        display: flex;
        gap: 6px;
      }
      .action-btn {
        background: #f4efe6;
        border: none;
        border-radius: 8px;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #4b6358;
        transition: background 0.15s ease;
      }
      .action-btn:hover {
        background: #eafaf4;
        color: #134e3f;
      }
      .action-btn.danger {
        color: #ef4444;
      }
      .action-btn.danger:hover {
        background: #fee2e2;
      }

      @keyframes pulse-soft {
        0%,
        100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.04);
        }
      }

      /* Photo Viewport */
      .photo-wrapper {
        position: relative;
        height: 220px;
        background: #f3f0ea;
        overflow: hidden;
      }
      .photo-wrapper img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 0.4s ease;
      }
      .paw-card:hover .photo-wrapper img {
        transform: scale(1.03);
      }

      /* Pawnder ID Badge */
      .pawn-tag {
        position: absolute;
        bottom: 12px;
        left: 12px;
        background: rgba(17, 24, 39, 0.82);
        backdrop-filter: blur(8px);
        color: #ffffff;
        padding: 4px 10px;
        border-radius: 999px;
        font-family: var(--pw-font-mono);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        display: flex;
        align-items: center;
        gap: 5px;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      .pawn-tag ion-icon {
        color: #10b981;
        font-size: 13px;
      }

      /* Badges */
      .pill-badge {
        position: absolute;
        top: 12px;
        left: 12px;
        padding: 5px 12px;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        display: flex;
        align-items: center;
        gap: 5px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(8px);
      }
      .pill-alert {
        background: #f97316;
        color: #ffffff;
      }
      .pill-alert.alert-crit {
        background: #ef4444;
        animation: pulse-crit 1.6s infinite;
      }
      @keyframes pulse-crit {
        0%,
        100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.06);
        }
      }
      .pill-pet {
        background: rgba(16, 185, 129, 0.92);
        color: #ffffff;
      }

      .status-pill {
        position: absolute;
        top: 12px;
        right: 12px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 800;
        color: #ffffff;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      .status-activo {
        background: #10b981;
      }
      .status-en_proceso {
        background: #f59e0b;
      }
      .status-resuelto {
        background: #6b7280;
      }

      /* Card Content */
      .card-body {
        padding: 16px 18px;
      }
      .title {
        margin: 0 0 10px;
        font-size: 1.25rem;
        font-weight: 800;
        color: #111827;
        line-height: 1.25;
      }

      /* Stat Pills (Breed, Size, Category) */
      .stats-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 12px;
      }
      .stat-chip {
        padding: 4px 10px;
        border-radius: 8px;
        font-size: 0.78rem;
        font-weight: 600;
      }
      .breed-chip {
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
      }
      .size-chip {
        background: #f3f4f6;
        color: #374151;
      }
      .cat-chip {
        background: #fef2f2;
        color: #991b1b;
        border: 1px solid #fecaca;
      }

      .description {
        margin: 0 0 12px;
        color: #4b5563;
        font-size: 0.9rem;
        line-height: 1.45;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .meta-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        font-size: 0.78rem;
        color: #6b7280;
        margin-bottom: 10px;
      }
      .meta-item {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .meta-item ion-icon {
        font-size: 14px;
        color: #10b981;
      }
      .approx-tag {
        color: #f97316;
        font-weight: 700;
      }

      .weather-row {
        margin-bottom: 12px;
      }

      /* Footer */
      .card-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 10px;
        border-top: 1px solid #f3f4f6;
        font-size: 0.8rem;
      }
      .author-info {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #4b5563;
        font-weight: 600;
        background: transparent;
        border: 0;
        padding: 0;
        cursor: pointer;
        font-family: inherit;
        font-size: inherit;
      }
      .author-info:hover span {
        color: #059669;
        text-decoration: underline;
      }
      .author-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #e0e7ff;
        color: #3730a3;
        font-weight: 800;
        font-size: 0.72rem;
        display: flex;
        align-items: center;
        justify-content: center;
        object-fit: cover;
        flex-shrink: 0;
      }
      .footer-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .owner-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .action-btn {
        width: 26px;
        height: 26px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
        color: #6b7280;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 14px;
      }
      .action-btn:hover {
        color: #059669;
        border-color: #a7f3d0;
      }
      .action-btn.danger:hover {
        color: #ef4444;
        border-color: #fecaca;
      }
      .comments-count {
        display: flex;
        align-items: center;
        gap: 5px;
        color: #6b7280;
        font-weight: 700;
        font-family: var(--pw-font-mono);
      }
      .comments-count ion-icon {
        font-size: 16px;
        color: #9ca3af;
      }
    `,
  ],
})
export class ReportCardComponent {
  readonly report = input.required<DogReport>();
  readonly showActions = input(false);
  readonly open = output<string>();
  readonly edit = output<string>();
  readonly delete = output<string>();
  readonly author = output<string>();

  protected readonly locationOutline = locationOutline;
  protected readonly timeOutline = timeOutline;
  protected readonly chatbubbleEllipsesOutline = chatbubbleEllipsesOutline;
  protected readonly createOutline = createOutline;
  protected readonly trashOutline = trashOutline;
  protected readonly pawOutline = pawOutline;
  protected readonly alertCircle = alertCircle;
  protected readonly shieldCheckmarkOutline = shieldCheckmarkOutline;

  protected readonly photoUrls = computed(() => {
    const report = this.report();
    const urls = report.photos?.map((p) => p.photo_url).filter(Boolean) ?? [];
    return urls.length ? urls : [report.photo_url].filter(Boolean);
  });

  protected readonly authorName = computed(() => this.report().profiles?.display_name ?? 'Amante de perros');

  protected readonly authorAvatar = computed(() => this.report().profiles?.avatar_url ?? null);

  protected readonly pawnId = computed(() => {
    const idStr = this.report().id || '';
    const numericPart = idStr.replace(/[^0-9]/g, '').slice(-3) || '042';
    return `#PWN-${numericPart.padStart(3, '0')}`;
  });

  protected readonly authorInitial = computed(() => {
    const name = this.report().profiles?.display_name || 'U';
    return name.charAt(0).toUpperCase();
  });

  protected readonly urgencyLabel = computed(() => labelOf(URGENCY_LEVEL_OPTIONS, this.report().urgency_level));

  protected readonly statusLabel = computed(() => labelOf(STATUS_OPTIONS, this.report().report_status));

  protected readonly sizeLabel = computed(() => {
    const s = this.report().size;
    return s === 'pequeno' ? 'Pequeño' : s === 'mediano' ? 'Mediano' : 'Grande';
  });

  protected readonly categoryLabel = computed(() => labelOf(URGENCY_CATEGORY_OPTIONS, this.report().urgency_category));

  protected readonly date = computed(() => formatDateTime(this.report().found_at));

  protected readonly weather = computed(() => {
    const r = this.report();
    return weatherSummary({
      weather_description: r.weather_description ?? '',
      temperature: r.temperature ?? 0,
      humidity: r.humidity ?? 0,
      precipitation: r.precipitation ?? 0,
      wind_speed: r.wind_speed ?? 0,
    });
  });

  protected readonly comments = computed(() => this.report().report_comments?.[0]?.count ?? 0);

  protected openAuthor(event: Event): void {
    event.stopPropagation();
    this.author.emit(this.report().user_id);
  }

  protected editReport(event: Event): void {
    event.stopPropagation();
    this.edit.emit(this.report().id);
  }

  protected deleteReport(event: Event): void {
    event.stopPropagation();
    this.delete.emit(this.report().id);
  }
}
