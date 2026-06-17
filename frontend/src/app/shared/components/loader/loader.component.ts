// MPloyChek — Loader Component (shows async delay visually)
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loader',
  template: `
    <div class="loader-wrapper" [class.inline]="inline">
      <div class="spinner">
        <div class="ring ring-1"></div>
        <div class="ring ring-2"></div>
        <div class="ring ring-3"></div>
        <div class="core"></div>
      </div>
      <p class="loader-msg" *ngIf="message">{{ message }}</p>
    </div>
  `,
  styles: [`
    .loader-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      gap: 20px;
    }
    .loader-wrapper.inline {
      padding: 20px;
    }
    .spinner {
      position: relative;
      width: 56px;
      height: 56px;
    }
    .ring {
      position: absolute;
      border-radius: 50%;
      border-style: solid;
      border-color: transparent;
      animation: spin linear infinite;
    }
    .ring-1 {
      inset: 0;
      border-width: 3px;
      border-top-color: var(--accent-teal);
      animation-duration: 1s;
    }
    .ring-2 {
      inset: 8px;
      border-width: 2px;
      border-right-color: var(--accent-amber);
      animation-duration: 0.75s;
      animation-direction: reverse;
    }
    .ring-3 {
      inset: 16px;
      border-width: 2px;
      border-bottom-color: rgba(45, 212, 191, 0.4);
      animation-duration: 1.5s;
    }
    .core {
      position: absolute;
      inset: 22px;
      border-radius: 50%;
      background: var(--accent-teal);
      opacity: 0.3;
      animation: pulse 1s ease-in-out infinite;
    }
    @keyframes spin  { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.6; } }
    .loader-msg {
      font-size: 13px;
      color: var(--t-4);
      letter-spacing: 0.5px;
      margin: 0;
      animation: fadeInOut 1.5s ease-in-out infinite;
    }
    @keyframes fadeInOut { 0%,100%{opacity:.4} 50%{opacity:1} }
  `],
})
export class LoaderComponent {
  @Input() message = 'Loading data…';
  @Input() inline  = false;
}
