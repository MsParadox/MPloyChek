// ============================================================
// MPloyChek v4.0 — Root App Component
// Author: Mohit Sharma
// ============================================================
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, NavigationError } from '@angular/router';
import { Subject, takeUntil, debounceTime } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { SessionService } from './core/services/session.service';
import { WebSocketService } from './core/services/websocket.service';
import { NotificationsService } from './core/services/notifications.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  template: `
    <div class="app-shell" [class.light-mode]="!theme.isDark">
      <div class="global-loader" *ngIf="isNavigating">
        <div class="progress-line"></div>
      </div>
      <app-navbar *ngIf="isAuthenticated"></app-navbar>
      <main class="app-content" [class.with-navbar]="isAuthenticated">
        <router-outlet></router-outlet>
      </main>
      <app-session-warning *ngIf="isAuthenticated"></app-session-warning>
    </div>
  `,
  styles: [`
    .app-shell { min-height:100vh; background:var(--bg-primary); transition:background .25s, color .25s; }
    .global-loader { position:fixed; top:0; left:0; right:0; z-index:9999; }
    .progress-line { height:3px; background:linear-gradient(90deg,var(--accent-teal),var(--accent-amber)); animation:progressAnim 1.2s ease-in-out infinite; transform-origin:left; }
    @keyframes progressAnim { 0%{transform:scaleX(0)} 50%{transform:scaleX(0.7)} 100%{transform:scaleX(1)} }
    .app-content { min-height:100vh; transition:padding .3s ease; }
    .app-content.with-navbar { padding-top:60px; }
  `],
})
export class AppComponent implements OnInit, OnDestroy {
  isNavigating    = false;
  isAuthenticated = false;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private auth: AuthService,
    private session: SessionService,
    private wsService: WebSocketService,
    private notifSvc: NotificationsService,
    public theme: ThemeService,
  ) {
    (window as any)._mploychekLogout = () => this.auth.logout();
  }

  ngOnInit(): void {
    // Restore language preference persisted from the Profile preferences page.
    const savedLang = localStorage.getItem('mploychek_lang');
    if (savedLang) document.documentElement.lang = savedLang;

    this.auth.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.isAuthenticated = !!user;
      if (user) {
        // Start session timer
        const token = this.auth.token;
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const remaining = payload.exp - Math.floor(Date.now() / 1000);
            if (remaining > 0) this.session.startSession(remaining);
          } catch { /* invalid token */ }
        }

        // FIX CRITICAL-2: Connect WebSocket with the JWT token, not user.id.
        // The server validates the token and rejects unauthenticated connections.
        if (token) {
          this.wsService.connect(token);
          // Debounce notification reloads so rapid WS events don't cascade into
          // multiple simultaneous HTTP calls and Angular change-detection loops.
          this.wsService.message$.pipe(
            takeUntil(this.destroy$),
            debounceTime(500),
          ).subscribe(msg => {
            if (msg.type === 'notification') this.notifSvc.load().subscribe();
          });
        }
      } else {
        this.session.stopSession();
        this.wsService.disconnect();
      }
    });

    this.router.events.pipe(takeUntil(this.destroy$)).subscribe(event => {
      if (event instanceof NavigationStart)  this.isNavigating = true;
      if (event instanceof NavigationEnd || event instanceof NavigationError) this.isNavigating = false;
    });
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
