import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, forkJoin, takeUntil, finalize, catchError, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { RecordsService } from '../../core/services/records.service';
import { CandidatesService } from '../../core/services/candidates.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { User, VerificationRecord, DashboardStats, Candidate, AnalyticsOverview, TERMINAL_STATUSES } from '../../core/models';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  records: VerificationRecord[] = [];
  candidates: Candidate[] = [];
  stats: DashboardStats | null = null;
  analytics: AnalyticsOverview | null = null;

  isLoadingProfile  = false;
  isLoadingRecords  = false;
  isLoadingStats    = false;
  asyncDelayMs      = environment.defaultDelay;
  lastProcessingTime: number | null = null;
  loadStartTime: number | null = null;
  elapsedMs = 0;
  elapsedInterval: ReturnType<typeof setInterval> | null = null;

  private destroy$ = new Subject<void>();

  loadError = '';

  constructor(
    public auth: AuthService,
    public router: Router,
    private zone: NgZone,
    private userSvc: UserService,
    private recordsSvc: RecordsService,
    private candidatesSvc: CandidatesService,
    private notifSvc: NotificationsService,
    private analyticsSvc: AnalyticsService,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.currentUser;
    this.loadDashboard();
  }

  loadDashboard(delay = this.asyncDelayMs): void {
    this.asyncDelayMs = delay;
    this.loadError = '';
    this.loadProfile();
    this.loadRecords(delay);
    this.candidatesSvc.load().pipe(takeUntil(this.destroy$), catchError(() => of({ data: [] } as any))).subscribe({ next: r => { this.candidates = r.data || []; } });
    this.notifSvc.load().pipe(takeUntil(this.destroy$), catchError(() => of(null))).subscribe();
    if (this.auth.isAdmin || this.auth.currentUser?.role === 'Manager') {
      this.loadStats();
      this.analyticsSvc.getOverview(0).pipe(takeUntil(this.destroy$), catchError(() => of(null))).subscribe({ next: r => this.analytics = (r as any)?.data || null });
    }
  }

  loadProfile(): void {
    this.isLoadingProfile = true;
    this.auth.fetchMe().pipe(
      takeUntil(this.destroy$),
      catchError(() => of(null)),
      finalize(() => this.zone.run(() => { this.isLoadingProfile = false; }))
    ).subscribe({ next: r => { if ((r as any)?.data) this.currentUser = (r as any).data; } });
  }

  loadRecords(delay = this.asyncDelayMs): void {
    this.isLoadingRecords = true;
    this.loadStartTime = Date.now();
    this.startElapsedTimer();
    this.recordsSvc.loadRecords(delay).pipe(
      takeUntil(this.destroy$),
      catchError(err => {
        const msg = err?.error?.error || 'Failed to load data. Server may be waking up — please refresh in a moment.';
        this.loadError = msg;
        return of({ data: [], success: false } as any);
      }),
      finalize(() => this.zone.run(() => { this.isLoadingRecords = false; this.stopElapsedTimer(); }))
    ).subscribe({ next: r => { if ((r as any)?.data?.length) { this.records = (r as any).data; this.lastProcessingTime = (r as any).processingTime ?? null; } } });
  }

  loadStats(): void {
    this.isLoadingStats = true;
    this.userSvc.getStats().pipe(
      takeUntil(this.destroy$),
      catchError(() => of(null)),
      finalize(() => this.zone.run(() => { this.isLoadingStats = false; }))
    ).subscribe({ next: r => { if ((r as any)?.data) this.stats = (r as any).data; } });
  }

  private startElapsedTimer(): void {
    this.elapsedMs = 0;
    this.stopElapsedTimer();
    // Run outside Angular zone — updates elapsedMs without triggering change detection on every tick.
    // Angular still renders the updated value on its own scheduled ticks.
    this.zone.runOutsideAngular(() => {
      this.elapsedInterval = setInterval(() => { this.elapsedMs = Date.now() - (this.loadStartTime || Date.now()); }, 100);
    });
  }
  private stopElapsedTimer(): void {
    if (this.elapsedInterval) { clearInterval(this.elapsedInterval); this.elapsedInterval = null; }
  }

  getAsyncProgress(): number {
    if (this.asyncDelayMs <= 0) return 100;
    return Math.min((this.elapsedMs / this.asyncDelayMs) * 100, 100);
  }

  get greeting(): string { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
  // FIX: Count all non-terminal statuses as active work
  get pendingCount(): number { return this.records.filter(r => !TERMINAL_STATUSES.includes(r.status)).length; }
  // FIX: Exclude ALL terminal statuses from overdue; 'Approved' is terminal and not overdue
  get overdueCount(): number { return this.records.filter(r => !TERMINAL_STATUSES.includes(r.status) && new Date(r.dueDate) < new Date()).length; }
  // FIX: 'Approved' is also a successful completion state
  get completedCount(): number { return this.records.filter(r => r.status === 'Completed' || r.status === 'Approved').length; }
  get flaggedCandidates(): Candidate[] { return this.candidates.filter(c => c.status === 'Flagged'); }
  get recentRecords(): VerificationRecord[] { return this.records.slice(0, 5); }
  // FIX: Use completedCount (includes Approved) in rate calculation
  get completionRate(): number { return this.records.length ? Math.round((this.completedCount / this.records.length) * 100) : 0; }

  scoreColor(s: number|null) { if(!s) return 'var(--t-5)'; return s>=80?'var(--status-success)':s>=50?'var(--accent-amber)':'var(--status-error)'; }

  // FIX: Complete status→CSS class map including all v4.0 workflow states
  statusClass(s: string) {
    const m: Record<string, string> = {
      'Completed':            's-success',
      'Approved':             's-success',
      'In Progress':          's-info',
      'In Review':            's-info',
      'Verification Running': 's-info',
      'Pending':              's-warning',
      'On Hold':              's-warning',
      'Failed':               's-error',
      'Rejected':             's-error',
      'Cancelled':            's-muted',
    };
    return m[s] || '';
  }

  riskColor(r: string) { const m:any={'Low':'var(--status-success)','Medium':'var(--accent-amber)','High':'var(--status-error)','Critical':'#f87171'}; return m[r]||''; }
  formatDate(d: string|null) { return d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) : '—'; }
  // FIX: Use TERMINAL_STATUSES for overdue check
  isOverdue(r: VerificationRecord) { return !TERMINAL_STATUSES.includes(r.status) && new Date(r.dueDate) < new Date(); }

  ngOnDestroy(): void { this.stopElapsedTimer(); this.destroy$.next(); this.destroy$.complete(); }
}
