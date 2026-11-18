import type { OnDestroy, OnInit } from '@angular/core';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonFab,
  IonFabButton,
  IonGrid,
  IonHeader,
  IonIcon,
  IonModal,
  IonRefresher,
  IonRefresherContent,
  IonRow,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { add, alertCircle, filterOutline, mapOutline, pawOutline } from 'ionicons/icons';
import type { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { ReportsService } from '../../core/services/reports.service';
import { UiService } from '../../core/services/ui.service';
import type { DogReport, ReportFilters, UrgencyLevel } from '../../models/dog-report.model';
import { DEFAULT_FILTERS } from '../../models/dog-report.model';
import { ReportCardComponent } from '../../shared/components/report-card/report-card.component';

@Component({
  selector: 'app-home',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonGrid,
    IonRow,
    IonCol,
    IonSpinner,
    IonFab,
    IonFabButton,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonModal,
    IonSelect,
    IonSelectOption,
    ReportCardComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/menu" text="Menú"></ion-back-button>
        </ion-buttons>
        <ion-title>🐾 Directorio Canino</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="goMap()">
            <ion-icon slot="icon-only" [icon]="mapOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>

      <!-- Barra de pestañas con botón conciso de urgencias -->
      <ion-toolbar class="sub-bar">
        <ion-segment [value]="feedMode()" (ionChange)="onModeChange($any($event).detail.value)">
          <ion-segment-button value="all">
            <span>Todos</span>
          </ion-segment-button>
          <ion-segment-button value="alerts" class="emergency-tab">
            <ion-icon [icon]="alertCircle"></ion-icon>
            <span>Urgencias</span>
          </ion-segment-button>
          <ion-segment-button value="pets">
            <span>Mascotas</span>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>

      <!-- Buscador y filtro -->
      <ion-toolbar class="search-bar">
        <ion-searchbar
          placeholder="Buscar por raza, sector, título..."
          [debounce]="300"
          (ionInput)="onSearch($any($event).detail.value ?? '')"
        ></ion-searchbar>
        <ion-buttons slot="end">
          <ion-button (click)="filterModalOpen.set(true)">
            <ion-icon slot="icon-only" [icon]="filterOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="wrap">
        <div class="welcome-box">
          <p class="sub">
            @if (feedMode() === 'alerts') {
              🚨 Mostrando perros que requieren atención o rescate urgente.
            } @else if (feedMode() === 'pets') {
              🐶 Perritos tiernos y consentidos de la comunidad.
            } @else {
              🐾 Catálogo general de perritos compartidos por la comunidad.
            }
          </p>
        </div>

        @if (loading()) {
          <div class="center">
            <ion-spinner name="crescent"></ion-spinner>
            <p>Cargando perritos…</p>
          </div>
        } @else if (errorMsg()) {
          <div class="center">
            <p class="err">{{ errorMsg() }}</p>
            <ion-button (click)="load()">Reintentar</ion-button>
          </div>
        } @else if (filteredReports().length === 0) {
          <div class="center empty">
            <ion-icon class="big" [icon]="pawOutline"></ion-icon>
            <p>No se encontraron publicaciones con este filtro.</p>
            <ion-button fill="outline" (click)="clearFilters()">Limpiar filtros</ion-button>
            <ion-button (click)="goCreate()">Compartir un perrito</ion-button>
          </div>
        } @else {
          <ion-grid class="grid">
            <ion-row>
              @for (r of filteredReports(); track r.id) {
                <ion-col size="12" sizeMd="6" sizeLg="4">
                  <app-report-card [report]="r" (open)="goToDetail($event)" />
                </ion-col>
              }
            </ion-row>
          </ion-grid>
        }
      </div>

      <!-- FAB para subir reporte -->
      <ion-fab slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button color="warning" (click)="goCreate()">
          <ion-icon [icon]="add"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>

    <!-- Modal de filtros adicionales -->
    <ion-modal [isOpen]="filterModalOpen()" (didDismiss)="filterModalOpen.set(false)">
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>Filtros avanzados</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="filterModalOpen.set(false)">Cerrar</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <ion-select
            label="Nivel de urgencia"
            labelPlacement="floating"
            fill="outline"
            [value]="filters().urgency"
            (ionChange)="setFilterUrgency($any($event).detail.value)"
          >
            <ion-select-option value="todas">Todas</ion-select-option>
            <ion-select-option value="normal">Mascotas / Normal</ion-select-option>
            <ion-select-option value="alta">Alta prioridad</ion-select-option>
            <ion-select-option value="critica">Crítica (Urgente)</ion-select-option>
          </ion-select>

          <div style="height: 16px;"></div>

          <ion-select
            label="Ordenar por"
            labelPlacement="floating"
            fill="outline"
            [value]="filters().order"
            (ionChange)="setFilterOrder($any($event).detail.value)"
          >
            <ion-select-option value="recientes">Más recientes primero</ion-select-option>
            <ion-select-option value="antiguos">Más antiguos primero</ion-select-option>
          </ion-select>

          <div style="margin-top: 24px; display: flex; gap: 8px;">
            <ion-button expand="block" fill="outline" style="flex: 1;" (click)="clearFilters()">
              Restablecer
            </ion-button>
            <ion-button expand="block" style="flex: 1;" (click)="filterModalOpen.set(false)"> Aplicar </ion-button>
          </div>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [
    `
      .sub-bar {
        --background: #fff8ee;
        padding: 0 8px;
      }
      .emergency-tab {
        --color-checked: #e5383b;
        --indicator-color: #ffe3e3;
        font-weight: 700;
      }
      .emergency-tab ion-icon {
        color: #e5383b;
        margin-right: 4px;
        font-size: 16px;
      }
      .search-bar {
        --background: #fff8ee;
        padding: 0 8px 4px;
      }
      ion-searchbar {
        --background: #ffffff;
        --border-radius: 12px;
        --box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
      }
      .wrap {
        padding: 8px 12px 96px;
        max-width: 1100px;
        margin: 0 auto;
      }
      .welcome-box {
        margin: 4px 4px 10px;
      }
      .sub {
        margin: 0;
        color: #8a817a;
        font-size: 0.88rem;
      }
      .center {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        text-align: center;
        padding: 48px 20px;
        color: #6b625b;
      }
      .big {
        font-size: 64px;
        color: #bfe9da;
      }
      .err {
        color: var(--ion-color-danger);
      }
    `,
  ],
})
export class HomePage implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly reportsService = inject(ReportsService);
  private readonly router = inject(Router);
  private readonly ui = inject(UiService);

  protected readonly mapOutline = mapOutline;
  protected readonly pawOutline = pawOutline;
  protected readonly add = add;
  protected readonly filterOutline = filterOutline;
  protected readonly alertCircle = alertCircle;

  protected readonly reports = signal<DogReport[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMsg = signal('');
  protected readonly feedMode = signal<'all' | 'alerts' | 'pets'>('all');
  protected readonly searchQuery = signal('');
  protected readonly filters = signal<ReportFilters>({ ...DEFAULT_FILTERS });
  protected readonly filterModalOpen = signal(false);

  private realtimeSub?: Subscription;

  protected readonly filteredReports = computed(() => {
    let list = this.reports();
    const mode = this.feedMode();
    const q = this.searchQuery().toLowerCase().trim();

    if (mode === 'alerts') {
      list = list.filter((r) => r.urgency_level === 'alta' || r.urgency_level === 'critica');
    } else if (mode === 'pets') {
      list = list.filter((r) => r.urgency_level === 'normal');
    }

    if (q) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.breed.toLowerCase().includes(q) ||
          r.zone.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q),
      );
    }

    return list;
  });

  async ngOnInit(): Promise<void> {
    await this.load();
    this.realtimeSub = this.reportsService
      .changes$()
      .pipe(debounceTime(300))
      .subscribe(() => {
        void this.load(false);
      });
  }

  ngOnDestroy(): void {
    this.realtimeSub?.unsubscribe();
  }

  async load(showSpinner = true): Promise<void> {
    if (showSpinner) this.loading.set(true);
    this.errorMsg.set('');
    try {
      const data = await this.reportsService.list(this.filters());
      this.reports.set(data);
    } catch (e) {
      this.errorMsg.set(e instanceof Error ? e.message : 'Error al cargar los reportes.');
    } finally {
      this.loading.set(false);
    }
  }

  async refresh(event: any): Promise<void> {
    await this.load(false);
    event.target.complete();
  }

  onModeChange(mode: 'all' | 'alerts' | 'pets'): void {
    this.feedMode.set(mode);
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
  }

  setFilterUrgency(urgency: UrgencyLevel | 'todas'): void {
    this.filters.update((f) => ({ ...f, urgency }));
    void this.load();
  }

  setFilterOrder(order: 'recientes' | 'antiguos'): void {
    this.filters.update((f) => ({ ...f, order }));
    void this.load();
  }

  clearFilters(): void {
    this.filters.set({ ...DEFAULT_FILTERS });
    this.searchQuery.set('');
    this.feedMode.set('all');
    this.filterModalOpen.set(false);
    void this.load();
  }

  goToDetail(reportId: string): void {
    void this.router.navigate(['/report-detail', reportId]);
  }

  goMap(): void {
    void this.router.navigateByUrl('/map-view');
  }

  goCreate(): void {
    if (!this.auth.isLoggedIn()) {
      void this.ui.toast('Debes iniciar sesión para publicar.', 'warning');
      void this.router.navigateByUrl('/login');
      return;
    }
    void this.router.navigateByUrl('/create-report');
  }
}
