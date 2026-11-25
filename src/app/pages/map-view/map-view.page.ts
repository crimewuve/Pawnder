import type { OnInit } from '@angular/core';
import { Component, inject, isDevMode, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { add, alertCircle, chevronBack, locateOutline, refreshOutline } from 'ionicons/icons';

import { LocationService } from '../../core/services/location.service';
import { ReportsService } from '../../core/services/reports.service';
import { UiService } from '../../core/services/ui.service';
import type { DogReport } from '../../models/dog-report.model';
import { CityMapComponent } from '../../shared/components/city-map/city-map.component';

@Component({
  selector: 'app-map-view',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    IonFab,
    IonFabButton,
    CityMapComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/menu" text="Volver"></ion-back-button>
        </ion-buttons>
        <ion-title>🗺️ Mapa de Perros</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="loadReports()">
            <ion-icon slot="icon-only" [icon]="refreshOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar class="filter-bar">
        <ion-segment [value]="filter()" (ionChange)="filter.set($any($event).detail.value)">
          <ion-segment-button value="all">
            <span>Todos</span>
          </ion-segment-button>
          <ion-segment-button value="alerts" class="emergency-tab">
            <ion-icon [icon]="alertCircle"></ion-icon>
            <span>Urgencias</span>
          </ion-segment-button>
          <ion-segment-button value="community">
            <span>🐶 Mascotas</span>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true" class="map-content">
      @if (loading()) {
        <div class="loader">
          <ion-spinner name="crescent"></ion-spinner>
          <p>Localizando perritos en el mapa…</p>
        </div>
      }

      <app-city-map
        [reports]="reports()"
        [filter]="filter()"
        [userLat]="userLat()"
        [userLng]="userLng()"
        (selectReport)="onReportSelected($event)"
      />

      <!-- Botón para recentrar en ubicación actual -->
      <ion-fab slot="fixed" vertical="bottom" horizontal="end" class="fab-locate">
        <ion-fab-button color="light" (click)="locateMe()">
          <ion-icon [icon]="locateOutline"></ion-icon>
        </ion-fab-button>
      </ion-fab>

      <!-- Botón para reportar -->
      <ion-fab slot="fixed" vertical="bottom" horizontal="start" class="fab-add">
        <ion-fab-button color="primary" (click)="goCreate()">
          <ion-icon [icon]="add"></ion-icon>
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: [
    `
      .filter-bar {
        --background: #faf8f5;
        padding: 4px 12px 8px;
      }
      ion-segment {
        background: #ede6dc;
        border-radius: 14px;
        padding: 3px;
      }
      ion-segment-button {
        --color: #4b6358;
        --color-checked: #134e3f;
        --indicator-color: #75d6b3;
        --border-radius: 12px;
        font-weight: 700;
        font-size: 0.85rem;
        min-height: 38px;
      }
      .emergency-tab {
        --color-checked: #ffffff;
        --indicator-color: #ef4444;
        font-weight: 700;
      }
      .emergency-tab ion-icon {
        color: #ef4444;
        margin-right: 4px;
      }
      .emergency-tab.segment-button-checked ion-icon {
        color: #ffffff;
      }
      .map-content {
        position: relative;
        --padding-top: 0;
        --padding-bottom: 0;
        --padding-start: 0;
        --padding-end: 0;
      }
      .loader {
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 255, 255, 0.9);
        padding: 8px 16px;
        border-radius: 20px;
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      .fab-locate {
        margin-bottom: 16px;
      }
      .fab-add {
        margin-bottom: 16px;
      }
    `,
  ],
})
export class MapViewPage implements OnInit {
  private readonly reportsService = inject(ReportsService);
  private readonly locationService = inject(LocationService);
  private readonly router = inject(Router);
  private readonly ui = inject(UiService);

  protected readonly refreshOutline = refreshOutline;
  protected readonly locateOutline = locateOutline;
  protected readonly add = add;
  protected readonly alertCircle = alertCircle;
  protected readonly chevronBack = chevronBack;

  protected readonly reports = signal<DogReport[]>([]);
  protected readonly loading = signal(false);
  protected readonly filter = signal<'all' | 'alerts' | 'community'>('all');
  protected readonly userLat = signal<number | null>(null);
  protected readonly userLng = signal<number | null>(null);

  async ngOnInit(): Promise<void> {
    await this.loadReports();
    void this.locateMe();
  }

  async loadReports(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.reportsService.list();
      this.reports.set(data);
    } catch (error) {
      console.error('[MapView] Error al cargar los reportes:', error);
      const detail = isDevMode() && error instanceof Error ? ` (${error.message})` : '';
      void this.ui.toast(`No se pudieron cargar los perritos en el mapa.${detail}`, 'danger');
    } finally {
      this.loading.set(false);
    }
  }

  async locateMe(): Promise<void> {
    try {
      const fix = await this.locationService.getCurrentFix();
      this.userLat.set(fix.latitude);
      this.userLng.set(fix.longitude);
    } catch {
      // Ignorar si no hay GPS disponible
    }
  }

  onReportSelected(reportId: string): void {
    void this.router.navigate(['/report-detail', reportId]);
  }

  goCreate(): void {
    void this.router.navigateByUrl('/create-report');
  }
}
