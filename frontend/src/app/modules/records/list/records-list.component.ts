import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Router } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import { RecordsService } from '../../../core/services/records.service';
import { AuthService } from '../../../core/services/auth.service';
import { VerificationRecord, RecordStatus, Priority, RECORD_TYPES, TERMINAL_STATUSES } from '../../../core/models';

@Component({
  selector: 'app-records-list',
  templateUrl: './records-list.component.html',
  styleUrls: ['./records-list.component.scss'],
})
export class RecordsListComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  dataSource = new MatTableDataSource<VerificationRecord>([]);
  columns = ['candidateName','type','status','priority','score','dueDate','billingCode','actions'];
  isLoading = false;
  filterText = '';
  statusFilter = '';
  typeFilter = '';
  priorityFilter = '';

  // FIX: Include ALL v4.0 workflow statuses in the filter dropdown
  statuses: RecordStatus[] = [
    'Pending', 'In Review', 'Verification Running',
    'In Progress', 'Completed', 'Approved',
    'Rejected', 'Failed', 'On Hold', 'Cancelled',
  ];
  recordTypes = RECORD_TYPES;
  priorities: Priority[] = ['Low','Medium','High','Critical'];

  private destroy$ = new Subject<void>();

  constructor(public auth: AuthService, private recordsSvc: RecordsService, private router: Router) {}

  ngOnInit() { this.loadRecords(); }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = (r, f) => {
      const text = `${r.candidateName} ${r.type} ${r.status} ${r.priority} ${r.billingCode}`.toLowerCase();
      const sf = this.statusFilter ? r.status === this.statusFilter : true;
      const tf = this.typeFilter ? r.type === this.typeFilter : true;
      const pf = this.priorityFilter ? r.priority === this.priorityFilter : true;
      return text.includes(f.split('|||')[0]) && sf && tf && pf;
    };
  }

  loadRecords() {
    this.isLoading = true;
    this.recordsSvc.loadRecords(0, {}).pipe(takeUntil(this.destroy$), finalize(() => this.isLoading = false))
      .subscribe({ next: r => { if (r.data) this.dataSource.data = r.data; } });
  }

  applyFilter() {
    this.dataSource.filter = `${this.filterText.toLowerCase()}|||${this.statusFilter}|||${this.typeFilter}|||${this.priorityFilter}`;
  }

  clearFilters() { this.filterText = ''; this.statusFilter = ''; this.typeFilter = ''; this.priorityFilter = ''; this.applyFilter(); }

  openDetail(r: VerificationRecord) { this.router.navigate(['/records', r.id]); }
  newRequest() { this.router.navigate(['/records/new']); }

  scoreColor(s: number | null) { if (!s) return 'var(--t-5)'; return s >= 80 ? 'var(--status-success)' : s >= 50 ? 'var(--accent-amber)' : 'var(--status-error)'; }

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

  priorityClass(p: string) { const m: any = { 'Critical':'p-critical','High':'p-high','Medium':'p-med','Low':'p-low' }; return m[p] || ''; }
  formatDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'; }

  // FIX: Exclude ALL terminal statuses from overdue check
  isOverdue(r: VerificationRecord) { return !TERMINAL_STATUSES.includes(r.status) && new Date(r.dueDate) < new Date(); }

  get totalCount() { return this.dataSource.data.length; }
  // FIX: Include 'Approved' as a completed/success state
  get completedCount() { return this.dataSource.data.filter(r => r.status === 'Completed' || r.status === 'Approved').length; }
  // FIX: Count all active (non-terminal) statuses as "pending" work
  get pendingCount() { return this.dataSource.data.filter(r => !TERMINAL_STATUSES.includes(r.status)).length; }
  get overdueCount() { return this.dataSource.data.filter(r => this.isOverdue(r)).length; }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }
}
