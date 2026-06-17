// MPloyChek — Records Table Component
import { Component, Input, OnChanges, ViewChild, AfterViewInit } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { VerificationRecord, RecordStatus } from '../../../../core/models';

@Component({
  selector: 'app-records-table',
  templateUrl: './records-table.component.html',
  styleUrls: ['./records-table.component.scss'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0', minHeight: '0', opacity: 0, visibility: 'hidden' })),
      state('expanded', style({ height: '*', opacity: 1, visibility: 'visible' })),
      transition('expanded <=> collapsed', animate('220ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})
export class RecordsTableComponent implements OnChanges, AfterViewInit {
  @Input() records: VerificationRecord[] = [];
  @Input() isLoading = false;
  @Input() isAdmin   = false;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort)      sort!: MatSort;

  dataSource = new MatTableDataSource<VerificationRecord>([]);
  filterValue = '';
  expandedRecord: VerificationRecord | null = null;

  get displayedColumns(): string[] {
    const cols = ['candidateName', 'type', 'status', 'priority', 'score', 'submittedDate'];
    if (this.isAdmin) cols.unshift('ownerId');
    cols.push('actions');
    return cols;
  }

  ngOnChanges(): void {
    this.dataSource.data = this.records;
    if (this.paginator) this.dataSource.paginator = this.paginator;
    if (this.sort)      this.dataSource.sort      = this.sort;
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort      = this.sort;
  }

  applyFilter(value: string): void {
    this.filterValue = value;
    this.dataSource.filter = value.trim().toLowerCase();
  }

  toggleExpand(record: VerificationRecord): void {
    this.expandedRecord = this.expandedRecord?.id === record.id ? null : record;
  }

  statusClass(status: RecordStatus): string {
    // FIX: Complete status→CSS class map including all v4.0 workflow states
    const m: Record<string, string> = {
      'Completed':            'status-success',
      'Approved':             'status-success',
      'In Progress':          'status-info',
      'In Review':            'status-info',
      'Verification Running': 'status-info',
      'Pending':              'status-warning',
      'On Hold':              'status-warning',
      'Failed':               'status-error',
      'Rejected':             'status-error',
      'Cancelled':            '',
    };
    return m[status] ?? '';
  }

  priorityClass(priority: string): string {
    switch (priority) {
      case 'Critical': return 'priority-critical';
      case 'High':   return 'priority-high';
      case 'Medium': return 'priority-med';
      case 'Low':    return 'priority-low';
      default:       return '';
    }
  }

  scoreColor(score: number | null): string {
    if (score === null) return 'var(--t-5)';
    if (score >= 80) return 'var(--status-success)';
    if (score >= 50) return 'var(--accent-amber)';
    return 'var(--status-error)';
  }

  formatDate(d: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // FIX: Include 'Approved' as a successfully completed state
  get completedCount(): number { return this.records.filter(r => r.status === 'Completed' || r.status === 'Approved').length; }
  // FIX: Count all non-terminal active states
  get pendingCount(): number   { return this.records.filter(r => r.status === 'Pending' || r.status === 'In Review').length; }
  get inProgressCount(): number { return this.records.filter(r => r.status === 'In Progress' || r.status === 'Verification Running').length; }
  get failedCount(): number    { return this.records.filter(r => r.status === 'Failed' || r.status === 'Rejected').length; }
}
