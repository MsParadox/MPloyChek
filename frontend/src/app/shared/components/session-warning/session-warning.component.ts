import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { SessionService } from '../../../core/services/session.service';

@Component({
  selector: 'app-session-warning',
  template: `
    <div class="sw-overlay" *ngIf="show">
      <div class="sw-modal">
        <div class="sw-icon">⏱</div>
        <h2>Session Expiring Soon</h2>
        <p>Your session will expire in <strong class="countdown">{{ sessionSvc.countdownFormatted }}</strong></p>
        <p class="sw-sub">You will be automatically logged out to protect your account.</p>
        <div class="sw-actions">
          <button class="sw-btn-extend" (click)="extend()">Stay Logged In</button>
          <button class="sw-btn-logout" (click)="logout()">Logout Now</button>
        </div>
        <div class="sw-bar">
          <div class="sw-fill" [style.width.%]="(sessionSvc.countdown / 300) * 100"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .sw-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn .2s ease}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    .sw-modal{background:var(--surface-1);border:1px solid rgba(245,158,11,.3);border-radius:20px;padding:32px;max-width:400px;width:90%;text-align:center;display:flex;flex-direction:column;gap:14px;box-shadow:0 40px 80px rgba(0,0,0,.6);animation:slideUp .3s cubic-bezier(.34,1.56,.64,1)}
    @keyframes slideUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
    .sw-icon{font-size:48px;line-height:1}
    h2{font-size:20px;font-weight:700;color: var(--t-1);margin:0}
    p{font-size:14px;color:var(--t-3);margin:0;line-height:1.6}
    .countdown{color:var(--accent-amber);font-size:18px;font-weight:800;display:inline-block;min-width:52px}
    .sw-sub{font-size:12px;color:var(--t-4)}
    .sw-actions{display:flex;gap:10px;justify-content:center;margin-top:4px}
    .sw-btn-extend{padding:10px 22px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--accent-teal),#0ea5e9);color:#000;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;&:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(45,212,191,.3)}}
    .sw-btn-logout{padding:10px 22px;border-radius:10px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.08);color:var(--status-error);font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s;&:hover{background:rgba(239,68,68,.15)}}
    .sw-bar{height:4px;background:rgba(245,158,11,.12);border-radius:4px;overflow:hidden}
    .sw-fill{height:100%;background:var(--accent-amber);border-radius:4px;transition:width .9s linear}
  `]
})
export class SessionWarningComponent implements OnInit, OnDestroy {
  show = false;
  private destroy$ = new Subject<void>();
  constructor(public sessionSvc: SessionService) {}
  ngOnInit() {
    this.sessionSvc.warning$.pipe(takeUntil(this.destroy$)).subscribe(w => this.show = w);
  }
  extend() { this.sessionSvc.extendSession(); }
  logout()  { (window as any)._mploychekLogout?.(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }
}
