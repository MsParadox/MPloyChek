import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subject, takeUntil, filter } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationsService } from '../../../core/services/notifications.service';
import { ThemeService } from '../../../core/services/theme.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { User } from '../../../core/models';

@Component({ selector: 'app-navbar', templateUrl: './navbar.component.html', styleUrls: ['./navbar.component.scss'] })
export class NavbarComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  unreadCount = 0;
  currentRoute = '';
  isMobileMenuOpen = false;
  wsConnected = false;
  private destroy$ = new Subject<void>();

  navItems = [
    { label: 'Dashboard',  icon: 'dashboard',           route: '/dashboard', roles: ['all'] },
    { label: 'Records',    icon: 'assignment',           route: '/records',   roles: ['all'] },
    { label: 'Candidates', icon: 'people',               route: '/candidates',roles: ['all'] },
    { label: 'Reports',    icon: 'bar_chart',            route: '/reports',   roles: ['Admin','Manager','Verifier'] },
    { label: 'Admin',      icon: 'admin_panel_settings', route: '/admin',     roles: ['Admin'] },
  ];

  constructor(
    public auth: AuthService,
    public theme: ThemeService,
    private notifSvc: NotificationsService,
    private wsSvc: WebSocketService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.auth.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user: User | null) => {
      this.currentUser = user;
      if (user) this.notifSvc.load().pipe(takeUntil(this.destroy$)).subscribe();
    });
    this.notifSvc.unreadCount$.pipe(takeUntil(this.destroy$)).subscribe(n => this.unreadCount = n);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntil(this.destroy$))
      .subscribe((e: any) => this.currentRoute = e.urlAfterRedirects);
    this.wsSvc.connected$.pipe(takeUntil(this.destroy$)).subscribe(c => this.wsConnected = c);
  }

  get visibleNavItems() {
    const role = this.currentUser?.role || '';
    return this.navItems.filter(i => i.roles.includes('all') || i.roles.includes(role));
  }
  get initials(): string { return this.currentUser ? `${this.currentUser.firstName[0]}${this.currentUser.lastName[0]}`.toUpperCase() : '?'; }
  get fullName(): string { return this.currentUser ? `${this.currentUser.firstName} ${this.currentUser.lastName}` : ''; }
  isActive(route: string): boolean { return this.currentRoute.startsWith(route); }
  navigate(path: string): void { this.router.navigate([path]); this.isMobileMenuOpen = false; }
  toggleTheme(): void { this.theme.toggle(); }
  logout(): void { this.auth.logout(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
