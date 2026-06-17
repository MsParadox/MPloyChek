import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { environment } from '../../../../environments/environment';
import { CandidatesService } from '../../../core/services/candidates.service';
import { RecordsService } from '../../../core/services/records.service';
import { AuthService } from '../../../core/services/auth.service';
import { DocumentsService, Document } from '../../../core/services/documents.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { Candidate, VerificationRecord } from '../../../core/models';

@Component({
  selector: 'app-candidate-detail',
  templateUrl: './candidate-detail.component.html',
  styleUrls: ['./candidate-detail.component.scss'],
})
export class CandidateDetailComponent implements OnInit {
  candidate: Candidate | null = null;
  records: VerificationRecord[] = [];
  isLoading = true;
  activeTab = 0;

  // ── Documents ──────────────────────────────────────────────
  documents: Document[] = [];
  docsLoading = false;
  uploading = false;
  uploadProgress = 0;
  selectedType = 'General';
  readonly docTypes = [
    'PAN', 'Aadhaar', 'Passport', 'Voter ID', 'Driving Licence',
    'Resume', 'Degree Certificate', 'Mark Sheet', 'Experience Letter',
    'Offer Letter', 'Salary Slip', 'Police Clearance', 'Address Proof',
    'Bank Statement', 'Photo', 'General',
  ];
  readonly maxBytes = 10 * 1024 * 1024; // 10 MB — matches backend limit
  readonly acceptTypes = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx';

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    public auth: AuthService,
    private candidatesSvc: CandidatesService,
    private recordsSvc: RecordsService,
    private docsSvc: DocumentsService,
    private snack: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.candidatesSvc.getById(id).subscribe({
      next: r => {
        this.candidate = r.data || null;
        this.isLoading = false;
        this.recordsSvc.loadRecords(0, { candidateId: id }).subscribe({ next: rr => { this.records = rr.data || []; } });
        this.loadDocuments();
      },
      error: () => { this.isLoading = false; this.router.navigate(['/candidates']); },
    });
  }

  // ── Document operations ────────────────────────────────────
  loadDocuments() {
    if (!this.candidate) return;
    this.docsLoading = true;
    this.docsSvc.getByCandidateId(this.candidate.id).subscribe({
      next: docs => { this.documents = docs; this.docsLoading = false; },
      error: () => { this.docsLoading = false; },
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.candidate) return;

    if (file.size > this.maxBytes) {
      this.snack.open('File exceeds the 10 MB limit.', 'Dismiss', { duration: 4000 });
      input.value = '';
      return;
    }

    this.uploading = true;
    this.uploadProgress = 0;
    this.docsSvc.upload(this.candidate.id, file, this.selectedType).subscribe({
      next: ev => {
        this.uploadProgress = ev.progress;
        if (ev.done && ev.document) {
          this.documents = [ev.document, ...this.documents];
          this.uploading = false;
          this.snack.open('Document uploaded.', 'OK', { duration: 2500 });
        }
      },
      error: (err) => {
        this.uploading = false;
        const msg = err?.error?.error || 'Upload failed.';
        this.snack.open(msg, 'Dismiss', { duration: 4000 });
      },
    });
    input.value = ''; // allow re-selecting the same file
  }

  deleteDocument(doc: Document) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      panelClass: 'dark-dialog',
      autoFocus: false,
      data: {
        title: 'Delete document?',
        message: `"${doc.name}" will be permanently removed. This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Keep',
        danger: true,
        icon: 'delete_outline',
      },
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.docsSvc.delete(doc.id).subscribe({
        next: () => {
          this.documents = this.documents.filter(d => d.id !== doc.id);
          this.snack.open('Document deleted.', 'OK', { duration: 2500 });
        },
        error: (err) => {
          const msg = err?.error?.error || 'Delete failed.';
          this.snack.open(msg, 'Dismiss', { duration: 4000 });
        },
      });
    });
  }

  canDelete(doc: Document): boolean {
    const role = this.auth.currentUser?.role;
    return role === 'Admin' || role === 'Manager' || doc.uploadedBy === this.auth.currentUser?.id;
  }

  /** Resolve a document's URL — Cloudinary URLs are absolute; local ones are
   *  served relative to the backend origin (apiUrl without the /api suffix). */
  docUrl(doc: Document): string {
    if (/^https?:\/\//i.test(doc.storageUrl)) return doc.storageUrl;
    const origin = environment.apiUrl.replace(/\/api\/?$/, '');
    return `${origin}${doc.storageUrl}`;
  }

  docIcon(doc: Document): string { return this.docsSvc.getIcon(doc.mimeType); }
  docSize(doc: Document): string { return this.docsSvc.formatSize(doc.sizeBytes); }

  riskColor(r: string) { const m: Record<string,string> = { 'Low':'var(--status-success)', 'Medium':'var(--accent-amber)', 'High':'var(--status-error)', 'Critical':'#f87171' }; return m[r] || ''; }
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
    return m[s] || 's-muted';
  }
  formatDate(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'; }
  age(dob: string) { const d = new Date(dob); return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000)); }
  // FIX: Include 'Approved' as a successfully completed record state
  get completedRecords() { return this.records.filter(r => r.status === 'Completed' || r.status === 'Approved').length; }
  get avgScore() { const s = this.records.filter(r => r.score !== null); return s.length ? Math.round(s.reduce((a, r) => a + (r.score||0), 0) / s.length) : null; }
  newRequest() { this.router.navigate(['/records/new']); }
}
