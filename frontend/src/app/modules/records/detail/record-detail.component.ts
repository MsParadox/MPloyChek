import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RecordsService } from '../../../core/services/records.service';
import { AuthService } from '../../../core/services/auth.service';
import { VerificationRecord, RECORD_WORKFLOW, TERMINAL_STATUSES } from '../../../core/models';

@Component({
  selector: 'app-record-detail',
  templateUrl: './record-detail.component.html',
  styleUrls: ['./record-detail.component.scss'],
})
export class RecordDetailComponent implements OnInit {
  record: VerificationRecord | null = null;
  isLoading = true;
  isSaving = false;
  editMode = false;
  remarksDraft = '';

  constructor(private route: ActivatedRoute, private router: Router,
    public auth: AuthService, private recordsSvc: RecordsService) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.recordsSvc.getById(id).subscribe({
      next: r => { this.record = r.data || null; this.remarksDraft = this.record?.remarks || ''; this.isLoading = false; },
      error: () => { this.isLoading = false; this.router.navigate(['/records']); },
    });
  }

  saveRemarks() {
    if (!this.record) return;
    this.isSaving = true;
    // FIX: allow saving empty remarks string (clearing a remark is valid)
    this.recordsSvc.update(this.record.id, { remarks: this.remarksDraft }).subscribe({
      next: r => { this.record = r.data || this.record; this.editMode = false; this.isSaving = false; },
      error: () => this.isSaving = false,
    });
  }

  updateStatus(status: string) {
    if (!this.record || !status) return;
    this.isSaving = true;
    this.recordsSvc.update(this.record.id, { status }).subscribe({
      next: r => { this.record = r.data || this.record; this.isSaving = false; },
      error: () => this.isSaving = false,
    });
  }

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

  priorityClass(p: string) { const m: any = {'Critical':'p-critical','High':'p-high','Medium':'p-med','Low':'p-low'}; return m[p]||''; }
  formatDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'; }
  formatDateTime(d: string) { return new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }

  // FIX: Exclude ALL terminal statuses from overdue calculation
  isOverdue() {
    return this.record
      && !TERMINAL_STATUSES.includes(this.record.status)
      && new Date(this.record.dueDate) < new Date();
  }

  get canUpdateStatus() { return this.auth.isAdmin || this.auth.currentUser?.role === 'Verifier' || this.auth.currentUser?.role === 'Manager'; }

  // FIX: Use RECORD_WORKFLOW state machine — only show valid next transitions
  get availableStatuses(): string[] {
    if (!this.record) return [];
    return RECORD_WORKFLOW[this.record.status] ?? [];
  }

  get isTerminal(): boolean {
    return this.record ? TERMINAL_STATUSES.includes(this.record.status) : false;
  }

  get costFormatted() { return this.record ? `₹${(this.record.actualCost || this.record.estimatedCost).toLocaleString('en-IN')}` : '—'; }
}
