import { Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { home, map, addCircle } from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="home">
          <ion-icon [icon]="homeIcon"></ion-icon>
          <ion-label>Inicio</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="map">
          <ion-icon [icon]="mapIcon"></ion-icon>
          <ion-label>Mapa</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="create">
          <ion-icon [icon]="addIcon" class="special-tab-icon"></ion-icon>
          <ion-label>Publicar</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: [
    `
      ion-tab-bar {
        --background: #ffffff;
        border-top: 1px solid #e8e0d4;
        height: 58px;
      }
      ion-tab-button {
        --color: #8a817a;
        --color-selected: #1b8a6b;
      }
      .special-tab-icon {
        color: #ff7a59;
        font-size: 26px;
      }
    `,
  ],
})
export class TabsPage {
  protected readonly homeIcon = home;
  protected readonly mapIcon = map;
  protected readonly addIcon = addCircle;
}
