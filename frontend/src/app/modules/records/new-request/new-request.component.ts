import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import { RecordsService } from '../../../core/services/records.service';
import { CandidatesService } from '../../../core/services/candidates.service';
import { Candidate, RECORD_TYPES, PRIORITIES } from '../../../core/models';

@Component({
  selector: 'app-new-request',
  templateUrl: './new-request.component.html',
  styleUrls: ['./new-request.component.scss'],
})
export class NewRequestComponent implements OnInit {
  step1!: FormGroup;
  step2!: FormGroup;
  step3!: FormGroup;
  candidates: Candidate[] = [];
  isLoadingCandidates = false;
  isSubmitting = false;
  recordTypes = RECORD_TYPES;
  priorities  = PRIORITIES;
  today = new Date().toISOString().split('T')[0];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private snack: MatSnackBar,
    private recordsSvc: RecordsService,
    private candidatesSvc: CandidatesService,
  ) {}

  ngOnInit() {
    this.step1 = this.fb.group({ candidateId: ['', Validators.required] });
    this.step2 = this.fb.group({ type: ['Employment Verification', Validators.required], priority: ['Medium', Validators.required], dueDate: ['', Validators.required] });
    this.step3 = this.fb.group({ notes: [''] });

    this.isLoadingCandidates = true;
    this.candidatesSvc.load().pipe(finalize(() => this.isLoadingCandidates = false)).subscribe({ next: r => { this.candidates = r.data || []; } });
  }

  get selectedCandidate(): Candidate | undefined {
    return this.candidates.find(c => c.id === this.step1.value.candidateId);
  }

  get estimatedCost(): number {
    const costs: Record<string, number> = { 'Employment Verification': 2500, 'Education Verification': 1500, 'Criminal Check': 1000, 'Credit Check': 800, 'Reference Check': 800, 'Address Verification': 600, 'Drug Test': 1200, 'Social Media Check': 500, 'Professional License Check': 1800 };
    return costs[this.step2.value.type] || 1000;
  }

  submit() {
    if (this.step1.invalid || this.step2.invalid) return;
    this.isSubmitting = true;
    const payload = { ...this.step1.value, ...this.step2.value, ...this.step3.value };
    this.recordsSvc.create(payload).pipe(finalize(() => this.isSubmitting = false)).subscribe({
      next: r => {
        this.snack.open('Verification request created successfully!', 'View', { duration: 4000 });
        this.router.navigate(['/records', r.data?.id]);
      },
      error: () => this.snack.open('Failed to create request. Try again.', 'Dismiss', { duration: 3000 }),
    });
  }

  cancel() { this.router.navigate(['/records']); }
  riskColor(r: string) { const m: Record<string,string> = {'Low':'var(--status-success)','Medium':'var(--accent-amber)','High':'var(--status-error)','Critical':'#f87171'}; return m[r]||''; }
}
