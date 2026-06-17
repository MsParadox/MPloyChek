// MPloyChek — Session Timeout Service
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private warningSubject = new BehaviorSubject<boolean>(false);
  warning$ = this.warningSubject.asObservable();
  private secondsLeft = 0;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private router: Router, private zone: NgZone) {}

  startSession(expiresIn: number) {
    this.clearTimers();
    const warningAt = (expiresIn - 300) * 1000; // warn 5 min before
    this.warningTimer = setTimeout(() => {
      this.zone.run(() => {
        this.warningSubject.next(true);
        this.secondsLeft = 300;
        this.countdownInterval = setInterval(() => {
          this.secondsLeft--;
          if (this.secondsLeft <= 0) { this.zone.run(() => this.expireSession()); }
        }, 1000);
      });
    }, Math.max(warningAt, 0));
  }

  extendSession() {
    this.warningSubject.next(false);
    this.clearTimers();
    // Re-use stored expiresIn
    const token = localStorage.getItem(environment.tokenKey);
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const remaining = payload.exp - Math.floor(Date.now() / 1000);
        if (remaining > 0) this.startSession(remaining);
      } catch { this.expireSession(); }
    }
  }

  private expireSession() {
    this.clearTimers();
    this.warningSubject.next(false);
    // FIX: Clear ALL session keys including refreshKey to prevent stale token reuse
    localStorage.removeItem(environment.tokenKey);
    localStorage.removeItem(environment.userKey);
    localStorage.removeItem(environment.refreshKey);
    this.router.navigate(['/auth/login'], { queryParams: { reason: 'session_expired' } });
  }

  private clearTimers() {
    if (this.warningTimer)    { clearTimeout(this.warningTimer);   this.warningTimer = null; }
    if (this.countdownInterval){ clearInterval(this.countdownInterval); this.countdownInterval = null; }
  }

  get countdown() { return this.secondsLeft; }
  get countdownFormatted() { const m = Math.floor(this.secondsLeft / 60); const s = this.secondsLeft % 60; return `${m}:${s.toString().padStart(2,'0')}`; }
  stopSession() { this.clearTimers(); this.warningSubject.next(false); }
}
