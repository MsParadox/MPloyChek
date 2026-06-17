import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin',
  template: `
    <div class="admin-shell">
      <div class="admin-header">
        <div>
          <div class="breadcrumb"><span routerLink="/dashboard">Home</span><span>›</span><span class="bc-cur">Admin Console</span></div>
          <h1 class="admin-title"><mat-icon>admin_panel_settings</mat-icon>Admin Console</h1>
          <p class="admin-sub">Platform administration and configuration</p>
        </div>
        <div class="admin-user-badge">
          <mat-icon>verified_user</mat-icon>
          Logged in as <strong>{{ auth.currentUser?.userId }}</strong>
        </div>
      </div>
      <div class="admin-tabs">
        <button class="at-btn" [class.active]="activeTab === 'users'" (click)="nav('users')"><mat-icon>people</mat-icon>User Management</button>
        <button class="at-btn" [class.active]="activeTab === 'audit'" (click)="nav('audit')"><mat-icon>history</mat-icon>Audit Log</button>
      </div>
      <router-outlet></router-outlet>
    </div>
  `,
  styles: [`.admin-shell{padding:28px;max-width:1440px;margin:0 auto;display:flex;flex-direction:column;gap:20px;animation:fadeUp .4s ease both}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}.admin-header{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px}.breadcrumb{display:flex;gap:6px;font-size:12px;color:var(--t-4);margin-bottom:8px;}.bc-cur{color:var(--t-3)}.admin-title{font-size:24px;font-weight:700;color: var(--t-1);margin:0 0 4px;display:flex;align-items:center;gap:10px}.admin-title mat-icon{color:var(--accent-amber);font-size:26px}.admin-sub{font-size:13px;color:var(--t-4);margin:0}.admin-user-badge{display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:20px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);font-size:13px;color:var(--t-4)}.admin-user-badge strong{color:var(--accent-amber)}.admin-tabs{display:flex;gap:4px;background:var(--surface-1);border:1px solid var(--line-1);border-radius:12px;padding:4px;width:fit-content}.at-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;border:none;background:none;color:var(--t-3);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s}.at-btn:hover{color:var(--t-2)}.at-btn.active{background:rgba(245,158,11,.12);color:var(--accent-amber)}`],
})
export class AdminComponent implements OnInit {
  activeTab = 'users';
  constructor(public auth: AuthService, private router: Router) {}
  ngOnInit() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => { this.activeTab = e.urlAfterRedirects.includes('audit') ? 'audit' : 'users'; });
  }
  nav(tab: string) { this.activeTab = tab; this.router.navigate(['/admin', tab]); }
}
