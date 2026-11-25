import type { OnDestroy, OnInit } from '@angular/core';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonList,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import {
  alertCircle,
  checkmarkCircle,
  createOutline,
  locationOutline,
  navigateOutline,
  paw,
  pawOutline,
  send,
  shareSocialOutline,
  shieldCheckmarkOutline,
  timeOutline,
  trashOutline,
} from 'ionicons/icons';
import type { Subscription } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { CommentsService } from '../../core/services/comments.service';
import { ReportsService } from '../../core/services/reports.service';
import { UiService } from '../../core/services/ui.service';
import { weatherSummary } from '../../core/services/weather.service';
import { formatDateTime } from '../../core/utils/format';
import type { ReportComment } from '../../models/comment.model';
import type { DogReport, ReportStatus } from '../../models/dog-report.model';
import { STATUS_OPTIONS, URGENCY_CATEGORY_OPTIONS, labelOf } from '../../models/dog-report.model';
import { MiniMapComponent } from '../../shared/components/mini-map/mini-map.component';
import { PhotoCarouselComponent } from '../../shared/components/photo-carousel/photo-carousel.component';
import { WeatherIndicatorComponent } from '../../shared/components/weather-indicator/weather-indicator.component';

@Component({
  selector: 'app-report-detail',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonButton,
    IonIcon,
    IonCard,
    IonCardContent,
    IonList,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    MiniMapComponent,
    PhotoCarouselComponent,
    WeatherIndicatorComponent,
  ],
  template: `
    <ion-header class="ion-no-border header-detail">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/home" text="Atrás"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ report()?.title ?? 'Ficha de Pawnder' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="share()">
            <ion-icon slot="icon-only" [icon]="shareSocialOutline"></ion-icon>
          </ion-button>
          @if (isOwner()) {
            <ion-button (click)="editReport()" aria-label="Editar publicación">
              <ion-icon slot="icon-only" [icon]="createOutline"></ion-icon>
            </ion-button>
            <ion-button color="danger" (click)="deleteReport()" aria-label="Eliminar publicación">
              <ion-icon slot="icon-only" [icon]="trashOutline"></ion-icon>
            </ion-button>
          }
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="detail-content">
      @if (loading()) {
        <div class="center-loader">
          <ion-spinner name="crescent" color="primary"></ion-spinner>
          <p>Cargando ficha del perrito…</p>
        </div>
      } @else if (errorMsg()) {
        <div class="center-loader">
          <p class="error">{{ errorMsg() }}</p>
          <ion-button (click)="loadAll()">Reintentar</ion-button>
        </div>
      } @else if (report(); as r) {
        <div class="detail-container">
          
          <div class="hero-viewport">
            <app-photo-carousel [photos]="photoUrls()" [alt]="r.title" />

            
            <div class="floating-pawn-id">
              <ion-icon [icon]="pawOutline"></ion-icon>
              <span>{{ pawnId() }}</span>
            </div>

            
            @if (r.urgency_level !== 'normal') {
              <div class="urgency-pill" [class.is-crit]="r.urgency_level === 'critica'">
                <ion-icon [icon]="alertCircle"></ion-icon>
                <span>{{ r.urgency_level === 'critica' ? 'ALERTA CRÍTICA' : 'NECESITA AYUDA' }}</span>
              </div>
            } @else {
              <div class="urgency-pill is-pet">
                <ion-icon [icon]="shieldCheckmarkOutline"></ion-icon>
                <span>MASCOTA DE LA COMUNIDAD</span>
              </div>
            }

            <div class="status-chip status-{{ r.report_status }}">
              {{ getStatusLabel(r.report_status) }}
            </div>
          </div>

          
          <div class="info-header">
            <h2>{{ r.title }}</h2>

            <button type="button" class="report-author" (click)="openProfile(r.user_id)">
              @if (r.profiles?.avatar_url) {
                <img [src]="r.profiles.avatar_url" [alt]="r.profiles.display_name" />
              } @else {
                <span>{{ authorInitial() }}</span>
              }
              <b>{{ r.profiles?.display_name ?? 'Amante de perros' }}</b>
              <small>Ver perfil</small>
            </button>

            <div class="stats-pills-row">
              <span class="pawn-chip breed-chip">
                <ion-icon [icon]="paw"></ion-icon>
                <b>{{ r.breed }}</b>
              </span>
              <span class="pawn-chip size-chip"> Tamaño: {{ r.size }} </span>
              @if (r.urgency_category) {
                <span class="pawn-chip cat-chip">
                  {{ getCategoryLabel(r.urgency_category) }}
                </span>
              }
            </div>
          </div>

          
          <ion-card class="glass-card">
            <ion-card-content>
              <h4>Descripción</h4>
              <p class="body-text">{{ r.description }}</p>

              @if (r.situation) {
                <h4>Situación observada</h4>
                <div class="situation-box">
                  <p>{{ r.situation }}</p>
                </div>
              }

              
              <div class="meta-grid">
                <div class="meta-item">
                  <ion-icon [icon]="timeOutline"></ion-icon>
                  <div>
                    <span class="meta-label">Fecha del avistamiento</span>
                    <span class="meta-val">{{ formattedDate() }}</span>
                  </div>
                </div>

                <div class="meta-item">
                  <ion-icon [icon]="locationOutline"></ion-icon>
                  <div>
                    <span class="meta-label">Barrio / Sector</span>
                    <span class="meta-val">{{ r.zone }}</span>
                  </div>
                </div>
              </div>

              
              @if (r.weather_emoji) {
                <div class="weather-box">
                  <app-weather-indicator [emoji]="r.weather_emoji" [summary]="weatherSummary()" />
                </div>
              }
            </ion-card-content>
          </ion-card>

          
          <div class="section-card map-card-section">
            <div class="section-title-row">
              <div>
                <h3>📍 Ubicación del hallazgo</h3>
                <p class="hint">
                  {{
                    r.is_approximate_location
                      ? 'Zona aproximada para proteger al hogar.'
                      : 'Punto geográfico referenciado.'
                  }}
                </p>
              </div>
            </div>

            <app-mini-map
              [lat]="r.latitude"
              [lon]="r.longitude"
              [editable]="false"
              [isApproximate]="r.is_approximate_location ?? false"
            />

            <ion-button expand="block" fill="outline" class="btn-maps" (click)="openInGoogleMaps()">
              <ion-icon slot="start" [icon]="navigateOutline"></ion-icon>
              Abrir en Google Maps
            </ion-button>
          </div>

          
          @if (isOwner()) {
            <ion-card class="glass-card status-box">
              <ion-card-content>
                <h4>Estado de seguimiento</h4>
                <p class="hint">Actualiza si el perrito ya fue rescatado o atendido.</p>
                <ion-select
                  [value]="r.report_status"
                  (ionChange)="changeStatus($any($event).detail.value)"
                  interface="action-sheet"
                  fill="outline"
                  [disabled]="updatingStatus()"
                >
                  @for (st of statusOptions; track st.value) {
                    <ion-select-option [value]="st.value">{{ st.label }}</ion-select-option>
                  }
                </ion-select>
              </ion-card-content>
            </ion-card>
          }

          
          <div class="section-card comments-card">
            <h3>💬 Comunidad & Rescate ({{ comments().length }})</h3>
            <p class="hint">Coordina ayuda, avistamientos o comparte cariño.</p>

            <ion-list class="comment-bubbles">
              @for (node of commentTree(); track node.comment.id) {
                <div class="bubble-wrap" [style.margin-left.px]="indentOf(node.depth)">
                  <div class="bubble-item" [class.is-reply]="node.depth > 0">
                    @if (node.comment.profiles?.avatar_url) {
                      <img
                        class="bubble-avatar"
                        [src]="node.comment.profiles.avatar_url"
                        [alt]="node.comment.profiles.display_name"
                      />
                    } @else {
                      <div class="bubble-avatar">{{ commentInitial(node.comment) }}</div>
                    }
                    <div class="bubble-content">
                      <div class="bubble-header">
                        <button type="button" class="comment-author" (click)="openProfile(node.comment.user_id)">
                          <b>{{ node.comment.profiles?.display_name ?? 'Amante de los perros' }}</b>
                        </button>
                        <small>{{ formatCommentDate(node.comment.created_at) }}</small>
                      </div>
                      <p>{{ node.comment.content }}</p>
                      @if (auth.isLoggedIn()) {
                        <button type="button" class="reply-btn" (click)="startReply(node.comment)">Responder</button>
                      }
                    </div>
                  </div>

                  @if (replyTo()?.id === node.comment.id) {
                    <div class="reply-composer">
                      <div class="reply-context">
                        <ion-icon [icon]="pawOutline"></ion-icon>
                        <span>
                          Respondiendo a <b>{{ replyAuthorName() }}</b>: «{{ replySnippet() }}»
                        </span>
                      </div>
                      <ion-input
                        placeholder="Escribe tu respuesta..."
                        [value]="replyText()"
                        (ionInput)="replyText.set($any($event).detail.value ?? '')"
                        (keyup.enter)="sendReply()"
                        [disabled]="sendingReply()"
                      ></ion-input>
                      <div class="reply-actions">
                        <ion-button size="small" fill="outline" (click)="cancelReply()"> Cancelar </ion-button>
                        <ion-button
                          size="small"
                          (click)="sendReply()"
                          [disabled]="!replyText().trim() || sendingReply()"
                        >
                          @if (sendingReply()) {
                            <ion-spinner name="dots"></ion-spinner>
                          } @else {
                            Publicar
                          }
                        </ion-button>
                      </div>
                    </div>
                  }
                </div>
              } @empty {
                <div class="empty-comments">
                  <ion-icon [icon]="pawOutline"></ion-icon>
                  <p>Sé la primera persona en dejar un mensaje sobre este perrito.</p>
                </div>
              }
            </ion-list>

            
            <div class="comment-bar">
              <ion-input
                placeholder="Escribe un comentario..."
                [value]="newComment()"
                (ionInput)="newComment.set($any($event).detail.value ?? '')"
                (keyup.enter)="sendComment()"
                [disabled]="sendingComment()"
              ></ion-input>
              <ion-button (click)="sendComment()" [disabled]="!newComment().trim() || sendingComment()">
                @if (sendingComment()) {
                  <ion-spinner name="dots"></ion-spinner>
                } @else {
                  <ion-icon slot="icon-only" [icon]="send"></ion-icon>
                }
              </ion-button>
            </div>
          </div>
        </div>
      }
    </ion-content>
  `,
  styles: [
    `
      .header-detail {
        --background: #faf6f0;
      }
      .detail-content {
        --background: #faf6f0;
      }
      .detail-container {
        max-width: 680px;
        margin: 0 auto;
        padding: 0 16px 40px;
      }
      .center-loader {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 20px;
        color: #6b7280;
      }

      .hero-viewport {
        position: relative;
        width: 100%;
        height: 320px;
        border-radius: 28px;
        overflow: hidden;
        margin-bottom: 20px;
        box-shadow: var(--pw-shadow-hover);
        background: #f3ede2;
      }
      .hero-viewport img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .floating-pawn-id {
        position: absolute;
        bottom: 14px;
        left: 14px;
        background: rgba(17, 24, 39, 0.85);
        backdrop-filter: blur(8px);
        color: #ffffff;
        font-family: var(--pw-font-mono);
        font-size: 0.78rem;
        font-weight: 700;
        padding: 5px 12px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        gap: 6px;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      .floating-pawn-id ion-icon {
        color: #10b981;
      }

      .urgency-pill {
        position: absolute;
        top: 14px;
        left: 14px;
        padding: 6px 14px;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 800;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 6px;
        backdrop-filter: blur(8px);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
      }
      .urgency-pill.is-crit {
        background: #ef4444;
        animation: pulse-badge 1.5s infinite;
      }
      .urgency-pill.is-pet {
        background: rgba(16, 185, 129, 0.95);
      }
      @keyframes pulse-badge {
        0%,
        100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.05);
        }
      }

      .status-chip {
        position: absolute;
        top: 14px;
        right: 14px;
        padding: 5px 12px;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 800;
        color: #ffffff;
        text-transform: uppercase;
        letter-spacing: 0.05em;
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

      .info-header {
        margin-bottom: 16px;
      }
      .info-header h2 {
        margin: 0 0 10px;
        font-size: 1.65rem;
        font-weight: 800;
        color: #111827;
        line-height: 1.25;
      }

      .report-author {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 12px;
        padding: 4px 12px 4px 4px;
        border: 1px solid #e5e7eb;
        border-radius: 999px;
        background: #ffffff;
        color: #374151;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.82rem;
      }
      .report-author:hover {
        border-color: #a7f3d0;
        background: #ecfdf5;
      }
      .report-author img,
      .report-author span {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        object-fit: cover;
        background: #d1fae5;
        color: #065f46;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .report-author small {
        color: #059669;
        font-size: 0.7rem;
      }

      .stats-pills-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .pawn-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        border-radius: 10px;
        font-size: 0.85rem;
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

      .glass-card {
        margin: 0 0 18px;
        border-radius: 22px;
        background: #ffffff;
        border: 1px solid rgba(229, 231, 235, 0.8);
        box-shadow: var(--pw-shadow-soft);
      }
      .glass-card h4 {
        margin: 0 0 6px;
        font-size: 1rem;
        font-weight: 800;
        color: #111827;
      }
      .body-text {
        margin: 0 0 14px;
        font-size: 0.95rem;
        color: #4b5563;
        line-height: 1.5;
      }
      .situation-box {
        background: #fffbeb;
        border-left: 3px solid #f59e0b;
        padding: 10px 14px;
        border-radius: 0 10px 10px 0;
        color: #92400e;
        font-size: 0.9rem;
        margin-bottom: 14px;
      }

      .meta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        padding: 12px 0;
        border-top: 1px solid #f3f4f6;
      }
      .meta-item {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .meta-item ion-icon {
        font-size: 20px;
        color: #10b981;
      }
      .meta-label {
        display: block;
        font-size: 0.72rem;
        color: #9ca3af;
      }
      .meta-val {
        display: block;
        font-size: 0.84rem;
        font-weight: 700;
        color: #1f2937;
      }

      .weather-box {
        margin-top: 12px;
      }

      .section-card {
        background: #ffffff;
        border-radius: 22px;
        padding: 18px 20px;
        margin-bottom: 18px;
        border: 1px solid rgba(229, 231, 235, 0.8);
        box-shadow: var(--pw-shadow-soft);
      }
      .section-card h3 {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 800;
        color: #111827;
      }
      .hint {
        margin: 3px 0 10px;
        font-size: 0.82rem;
        color: #6b7280;
      }
      .btn-maps {
        margin-top: 12px;
        --border-radius: 12px;
        font-weight: 700;
      }

      .comment-bubbles {
        background: transparent;
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 16px;
      }
      .bubble-wrap {
        min-width: 0;
      }
      .bubble-item {
        display: flex;
        gap: 10px;
        background: #f9fafb;
        border-radius: 16px;
        padding: 12px;
      }
      .bubble-item.is-reply {
        background: #ecfdf5;
        border-left: 3px solid #a7f3d0;
      }
      .bubble-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #dbeafe;
        color: #1e40af;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        object-fit: cover;
      }
      .bubble-content {
        flex: 1;
      }
      .bubble-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
        font-size: 0.84rem;
      }
      .bubble-header b {
        color: #111827;
      }
      .bubble-header small {
        color: #9ca3af;
        font-family: var(--pw-font-mono);
        white-space: nowrap;
      }
      .comment-author {
        background: transparent;
        border: 0;
        padding: 0;
        color: #111827;
        cursor: pointer;
        font-family: inherit;
        font-size: inherit;
      }
      .comment-author:hover b {
        color: #059669;
        text-decoration: underline;
      }
      .bubble-content p {
        margin: 0;
        font-size: 0.88rem;
        color: #374151;
        line-height: 1.4;
        white-space: pre-line;
      }
      .reply-btn {
        margin-top: 6px;
        background: transparent;
        border: 0;
        padding: 2px 0;
        color: #059669;
        font-family: inherit;
        font-size: 0.75rem;
        font-weight: 800;
        cursor: pointer;
      }
      .reply-btn:hover {
        text-decoration: underline;
      }
      .reply-composer {
        margin: 6px 0 4px 42px;
        background: #ffffff;
        border: 1px solid #a7f3d0;
        border-radius: 14px;
        padding: 10px 12px;
        box-shadow: 0 2px 8px rgba(5, 150, 105, 0.08);
      }
      .reply-context {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        background: #ecfdf5;
        border-radius: 10px;
        padding: 6px 8px;
        margin-bottom: 8px;
        color: #065f46;
        font-size: 0.74rem;
        line-height: 1.35;
      }
      .reply-context ion-icon {
        font-size: 13px;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .reply-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
        margin-top: 6px;
      }
      .empty-comments {
        text-align: center;
        padding: 24px 10px;
        color: #9ca3af;
      }
      .empty-comments ion-icon {
        font-size: 36px;
        color: #d1d5db;
        margin-bottom: 6px;
      }

      .comment-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 999px;
        padding: 4px 6px 4px 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }
    `,
  ],
})
export class ReportDetailPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reportsService = inject(ReportsService);
  private readonly commentsService = inject(CommentsService);
  protected readonly auth = inject(AuthService);
  private readonly ui = inject(UiService);

  protected readonly shareSocialOutline = shareSocialOutline;
  protected readonly trashOutline = trashOutline;
  protected readonly alertCircle = alertCircle;
  protected readonly checkmarkCircle = checkmarkCircle;
  protected readonly pawOutline = pawOutline;
  protected readonly paw = paw;
  protected readonly timeOutline = timeOutline;
  protected readonly locationOutline = locationOutline;
  protected readonly navigateOutline = navigateOutline;
  protected readonly shieldCheckmarkOutline = shieldCheckmarkOutline;
  protected readonly send = send;
  protected readonly createOutline = createOutline;

  protected readonly reportId = signal<string>('');
  protected readonly report = signal<DogReport | null>(null);
  protected readonly comments = signal<ReportComment[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMsg = signal('');
  protected readonly updatingStatus = signal(false);
  protected readonly newComment = signal('');
  protected readonly sendingComment = signal(false);
  protected readonly replyTo = signal<ReportComment | null>(null);
  protected readonly replyText = signal('');
  protected readonly sendingReply = signal(false);

  protected readonly statusOptions = STATUS_OPTIONS;

  private commentSub?: Subscription;

  protected readonly pawnId = computed(() => {
    const idStr = this.report()?.id || '';
    const numericPart = idStr.replace(/[^0-9]/g, '').slice(-3) || '042';
    return `#PWN-${numericPart.padStart(3, '0')}`;
  });

  protected readonly isOwner = computed(() => {
    const user = this.auth.user();
    const rep = this.report();
    return !!(user && rep && user.id === rep.user_id);
  });

  protected readonly photoUrls = computed(() => {
    const rep = this.report();
    if (!rep) return [];
    const urls = rep.photos?.map((p) => p.photo_url).filter(Boolean) ?? [];
    return urls.length ? urls : [rep.photo_url].filter(Boolean);
  });

  protected readonly authorInitial = computed(() => {
    const name = this.report()?.profiles?.display_name ?? 'U';
    return name.charAt(0).toUpperCase();
  });

  protected readonly commentTree = computed(() => {
    const items = [...this.comments()];
    const byId = new Map(items.map((c) => [c.id, c]));
    const result: { comment: ReportComment; depth: number }[] = [];
    const visited = new Set<string>();

    const walk = (comment: ReportComment, depth: number): void => {
      if (visited.has(comment.id)) return;
      visited.add(comment.id);
      result.push({ comment, depth });
      items
        .filter((child) => child.parent_id === comment.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .forEach((child) => walk(child, depth + 1));
    };

    items
      .filter((c) => !c.parent_id || !byId.has(c.parent_id))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .forEach((root) => walk(root, 0));

    items.filter((c) => !visited.has(c.id)).forEach((c) => result.push({ comment: c, depth: 0 }));
    return result;
  });

  protected readonly replyAuthorName = computed(() => this.replyTo()?.profiles?.display_name ?? 'Amante de los perros');

  protected readonly replySnippet = computed(() => {
    const text = this.replyTo()?.content?.trim() ?? '';
    return text.length > 60 ? `${text.slice(0, 60)}…` : text;
  });

  protected readonly formattedDate = computed(() => {
    const rep = this.report();
    return rep?.found_at ? formatDateTime(rep.found_at) : '';
  });

  protected readonly weatherSummary = computed(() => {
    const rep = this.report();
    if (!rep) return '';
    return weatherSummary({
      weather_description: rep.weather_description ?? '',
      temperature: rep.temperature ?? 0,
      humidity: rep.humidity ?? 0,
      precipitation: rep.precipitation ?? 0,
      wind_speed: rep.wind_speed ?? 0,
    });
  });

  async ngOnInit(): Promise<void> {
    await this.auth.whenReady();
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMsg.set('ID de reporte no válido.');
      this.loading.set(false);
      return;
    }
    this.reportId.set(id);
    await this.loadAll();

    this.commentSub = this.commentsService.changesForReport$(id).subscribe(() => {
      void this.loadComments();
    });
  }

  ngOnDestroy(): void {
    this.commentSub?.unsubscribe();
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      const [r, c] = await Promise.all([
        this.reportsService.getById(this.reportId()),
        this.commentsService.listForReport(this.reportId()),
      ]);
      this.report.set(r);
      this.comments.set(c);
    } catch (e) {
      this.errorMsg.set(e instanceof Error ? e.message : 'Error al cargar reporte.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadComments(): Promise<void> {
    try {
      const c = await this.commentsService.listForReport(this.reportId());
      this.comments.set(c);
    } catch {
    }
  }

  getStatusLabel(status: ReportStatus): string {
    return labelOf(STATUS_OPTIONS, status);
  }

  getCategoryLabel(cat: string): string {
    return labelOf(URGENCY_CATEGORY_OPTIONS, cat as any);
  }

  formatCommentDate(dateIso: string): string {
    return formatDateTime(dateIso);
  }

  indentOf(depth: number): number {
    return Math.min(depth, 5) * 22;
  }

  commentInitial(comment: ReportComment): string {
    return (comment.profiles?.display_name || 'U').charAt(0).toUpperCase();
  }

  openProfile(userId: string): void {
    const current = this.auth.user()?.id;
    void this.router.navigateByUrl(userId === current ? '/profile' : `/profile/${userId}`);
  }

  startReply(comment: ReportComment): void {
    if (!this.auth.user()) {
      void this.ui.toast('Inicia sesión para responder.', 'warning');
      void this.router.navigateByUrl('/login');
      return;
    }
    this.replyTo.set(comment);
    this.replyText.set('');
  }

  cancelReply(): void {
    this.replyTo.set(null);
    this.replyText.set('');
  }

  async sendReply(): Promise<void> {
    const text = this.replyText().trim();
    const parent = this.replyTo();
    const user = this.auth.user();
    if (!text || !parent || !user) return;

    this.sendingReply.set(true);
    try {
      await this.commentsService.addComment(this.reportId(), user.id, text, parent.id);
      this.cancelReply();
      await this.loadComments();
      void this.ui.toast('Respuesta publicada ✔', 'success');
    } catch {
      void this.ui.toast('No se pudo publicar la respuesta.', 'danger');
    } finally {
      this.sendingReply.set(false);
    }
  }

  editReport(): void {
    const rep = this.report();
    if (!rep || !this.isOwner()) return;
    void this.router.navigateByUrl(`/edit-report/${rep.id}`);
  }

  async changeStatus(newStatus: ReportStatus): Promise<void> {
    const rep = this.report();
    if (!rep || rep.report_status === newStatus) return;

    this.updatingStatus.set(true);
    try {
      await this.reportsService.updateStatus(rep.id, newStatus);
      this.report.set({ ...rep, report_status: newStatus });
      void this.ui.toast('Estado del reporte actualizado.', 'success');
    } catch {
      void this.ui.toast('No se pudo actualizar el estado.', 'danger');
    } finally {
      this.updatingStatus.set(false);
    }
  }

  async sendComment(): Promise<void> {
    const text = this.newComment().trim();
    if (!text) return;

    const user = this.auth.user();
    if (!user) {
      void this.ui.toast('Inicia sesión para dejar un comentario.', 'warning');
      void this.router.navigateByUrl('/login');
      return;
    }

    this.sendingComment.set(true);
    try {
      await this.commentsService.addComment(this.reportId(), user.id, text);
      this.newComment.set('');
      await this.loadComments();
      void this.ui.toast('Comentario publicado ✔', 'success');
    } catch {
      void this.ui.toast('No se pudo enviar el comentario.', 'danger');
    } finally {
      this.sendingComment.set(false);
    }
  }

  openInGoogleMaps(): void {
    const r = this.report();
    if (!r) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`;
    window.open(url, '_blank');
  }

  async share(): Promise<void> {
    const r = this.report();
    if (!r) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `🐾 Pawnder: ${r.title}`,
          text: `Mira a este perrito en Pawnder (${r.breed}) en ${r.zone}. ${r.description}`,
          url: window.location.href,
        });
      } catch {
      }
    } else {
      void this.ui.toast('Enlace copiado al portapapeles', 'medium');
    }
  }

  async deleteReport(): Promise<void> {
    const rep = this.report();
    if (!rep || !this.isOwner()) return;
    const confirmed = await this.ui.confirm(
      'Eliminar publicación',
      '¿Eliminar esta publicación? Sus fotos y comentarios también se borrarán.',
      'Eliminar',
    );
    if (!confirmed) return;

    try {
      await this.reportsService.remove(rep);
      void this.ui.toast('Publicación eliminada.', 'success');
      void this.router.navigateByUrl('/profile');
    } catch {
      void this.ui.toast('No se pudo eliminar la publicación.', 'danger');
    }
  }
}
