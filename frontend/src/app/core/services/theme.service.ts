import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly KEY = 'mploychek_theme';
  private isDarkSubject = new BehaviorSubject<boolean>(this.loadTheme());
  isDark$ = this.isDarkSubject.asObservable();

  constructor() { this.applyTheme(this.isDarkSubject.value); }

  get isDark() { return this.isDarkSubject.value; }

  toggle() { const next = !this.isDark; this.isDarkSubject.next(next); localStorage.setItem(this.KEY, next ? 'dark' : 'light'); this.applyTheme(next); }

  private loadTheme(): boolean { return (localStorage.getItem(this.KEY) || 'dark') === 'dark'; }

  private applyTheme(dark: boolean) {
    // All design tokens live in styles.scss (:root = dark, body.light-mode =
    // light). We only toggle the class so the entire app re-themes at once.
    document.body.classList.toggle('light-mode', !dark);
  }
}
