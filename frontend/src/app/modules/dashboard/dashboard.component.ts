import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil, finalize, timeout, catchError, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { RecordsService } from '../../core/services/records.service';
import { CandidatesService } from '../../core/services/candidates.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { ApiResponse, User, VerificationRecord, DashboardStats, Candidate, AnalyticsOverview, TERMINAL_STATUSES } from '../../core/models';

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
  asyncDelayMs      = 800;
  lastProcessingTime: number | null = null;
  recordsError      = '';
  loadStartTime: number | null = null;
  elapsedMs = 0;
  elapsedInterval: ReturnType<typeof setInterval> | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    public auth: AuthService,
    public router: Router,
    private userSvc: UserService,
    private recordsSvc: RecordsService,
    private candidatesSvc: CandidatesService,
    private notifSvc: NotificationsService,
    private analyticsSvc: AnalyticsService,
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.currentUser;
    this.asyncDelayMs = 0;
    this.loadDashboard();
  }

  loadDashboard(delay = this.asyncDelayMs): void {
    this.asyncDelayMs = delay;
    this.loadProfile();
    this.loadRecords(delay);
    this.candidatesSvc.load().pipe(takeUntil(this.destroy$)).subscribe({ next: r => { this.candidates = r.data || []; } });
    this.notifSvc.load().pipe(takeUntil(this.destroy$)).subscribe();
    if (this.auth.isAdmin || this.auth.currentUser?.role === 'Manager') {
      this.loadStats();
      this.analyticsSvc.getOverview(0).pipe(takeUntil(this.destroy$)).subscribe({ next: r => this.analytics = r.data || null });
    }
  }

  loadProfile(): void {
    this.isLoadingProfile = true;
    this.auth.fetchMe().pipe(takeUntil(this.destroy$), finalize(() => this.isLoadingProfile = false))
      .subscribe({ next: r => { if (r.data) this.currentUser = r.data; } });
  }

  loadRecords(delay = this.asyncDelayMs): void {
    this.isLoadingRecords = true;
    this.recordsError = '';
    this.loadStartTime = Date.now();
    this.startElapsedTimer();
    this.recordsSvc.loadRecords(delay).pipe(
      takeUntil(this.destroy$),
      timeout(15000),
      catchError(() => {
        this.recordsError = 'Records are taking too long to load. Please refresh.';
        return of<ApiResponse<VerificationRecord[]>>({ success: false, data: [] });
      }),
      finalize(() => { this.isLoadingRecords = false; this.stopElapsedTimer(); }),
    ).subscribe({ next: r => { if (r.data) { this.records = r.data; this.lastProcessingTime = r.processingTime ?? null; } } });
  }

  loadStats(): void {
    this.isLoadingStats = true;
    this.userSvc.getStats().pipe(takeUntil(this.destroy$), finalize(() => this.isLoadingStats = false))
      .subscribe({ next: r => { if (r.data) this.stats = r.data; } });
  }

  private startElapsedTimer(): void {
    this.elapsedMs = 0;
    this.stopElapsedTimer();
    this.elapsedInterval = setInterval(() => { this.elapsedMs = Date.now() - (this.loadStartTime || Date.now()); }, 50);
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
