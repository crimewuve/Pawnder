import { Component, input } from '@angular/core';

@Component({
  selector: 'app-weather-indicator',
  template: `
    <div class="wx">
      <span class="emoji">{{ emoji() }}</span>
      <span class="txt">{{ summary() }}</span>
    </div>
    @if (showNote()) {
      <small class="note">Contexto ambiental al momento del reporte</small>
    }
  `,
  styles: [
    `
      .wx {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #eaf8f2;
        border-radius: 12px;
        padding: 8px 10px;
      }
      .emoji {
        font-size: 1.25rem;
        white-space: nowrap;
      }
      .txt {
        font-size: 0.8rem;
        color: #35564b;
        line-height: 1.25;
      }
      .note {
        display: block;
        margin: 3px 4px 0;
        color: #8a817a;
        font-size: 0.7rem;
      }
    `,
  ],
})
export class WeatherIndicatorComponent {
  readonly emoji = input<string | null>('');
  readonly summary = input<string>('');
  readonly showNote = input<boolean>(false);
}