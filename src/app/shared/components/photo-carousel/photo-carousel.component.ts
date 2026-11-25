import type { ElementRef } from '@angular/core';
import { Component, computed, effect, input, signal, viewChild } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { pawOutline } from 'ionicons/icons';


@Component({
  selector: 'app-photo-carousel',
  imports: [IonIcon],
  template: `
    <div class="carousel" #track (scroll)="onScroll($event)">
      @for (url of photos(); track $index) {
        <div class="slide">
          <img [src]="url" [alt]="alt() + ' ' + ($index + 1)" loading="lazy" />
        </div>
      } @empty {
        <div class="slide slide-empty">
          <ion-icon [icon]="pawOutline"></ion-icon>
        </div>
      }
    </div>

    @if (photos().length > 1) {
      <div class="carousel-meta">
        <div class="dots" role="tablist" [attr.aria-label]="alt()">
          @for (url of photos(); track $index) {
            <button
              type="button"
              class="dot"
              [class.active]="$index === active()"
              [attr.aria-label]="'Ver foto ' + ($index + 1)"
              [attr.aria-selected]="$index === active()"
              (click)="goTo($index)"
            ></button>
          }
        </div>
        <span class="counter">{{ active() + 1 }}/{{ photos().length }}</span>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
      }
      .carousel {
        display: flex;
        height: 100%;
        width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        scroll-snap-type: x mandatory;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      .carousel::-webkit-scrollbar {
        display: none;
      }
      .slide {
        flex: 0 0 100%;
        height: 100%;
        scroll-snap-align: start;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f3f0ea;
      }
      .slide img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .slide-empty ion-icon {
        font-size: 48px;
        color: #9ad9c2;
      }
      .carousel-meta {
        position: absolute;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(17, 24, 39, 0.62);
        backdrop-filter: blur(8px);
        z-index: 3;
      }
      .dots {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .dot {
        width: 7px;
        height: 7px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.55);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .dot.active {
        width: 18px;
        border-radius: 999px;
        background: #ffffff;
      }
      .counter {
        color: #ffffff;
        font-family: var(--pw-font-mono);
        font-size: 0.68rem;
        font-weight: 700;
        white-space: nowrap;
      }
    `,
  ],
})
export class PhotoCarouselComponent {
  readonly photos = input.required<string[]>();
  readonly alt = input('Fotografía');

  protected readonly active = signal(0);
  protected readonly pawOutline = pawOutline;
  protected readonly count = computed(() => this.photos().length);

  private readonly track = viewChild<ElementRef<HTMLDivElement>>('track');

  constructor() {
    effect(() => {
      this.photos();
      this.active.set(0);
      const el = this.track()?.nativeElement;
      if (el) el.scrollLeft = 0;
    });
  }

  protected onScroll(event: Event): void {
    const el = event.target as HTMLDivElement;
    if (!el.clientWidth) return;
    this.active.set(Math.min(this.count() - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  }

  protected goTo(index: number): void {
    const el = this.track()?.nativeElement;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
  }
}
