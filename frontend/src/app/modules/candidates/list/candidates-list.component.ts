import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil, finalize } from 'rxjs';
import { CandidatesService } from '../../../core/services/candidates.service';
import { AuthService } from '../../../core/services/auth.service';
import { Candidate } from '../../../core/models';

@Component({
  selector: 'app-candidates-list',
  templateUrl: './candidates-list.component.html',
  styleUrls: ['./candidates-list.component.scss'],
})
export class CandidatesListComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  dataSource = new MatTableDataSource<Candidate>([]);
  columns = ['name', 'email', 'nationality', 'riskLevel', 'status', 'consent', 'tags', 'actions'];
  isLoading = false;
  filterText = '';
  statusFilter = '';
  riskFilter = '';
  showNewForm = false;
  isCreating = false;

  newCandidate = { firstName: '', lastName: '', email: '', phone: '', nationality: 'Indian', currentAddress: '', dateOfBirth: '', notes: '' };

  private destroy$ = new Subject<void>();

  constructor(
    public auth: AuthService,
    private candidatesSvc: CandidatesService,
    private router: Router,
    private snack: MatSnackBar,
  ) {}

  ngOnInit() { this.load(); }
  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = (c, f) => {
      const txt = `${c.firstName} ${c.lastName} ${c.email} ${c.nationality} ${c.tags.join(' ')}`.toLowerCase();
      const sf = this.statusFilter ? c.status === this.statusFilter : true;
      const rf = this.riskFilter ? c.riskLevel === this.riskFilter : true;
      return txt.includes(f.split('|')[0]) && sf && rf;
    };
  }

  load() {
    this.isLoading = true;
    this.candidatesSvc.load().pipe(takeUntil(this.destroy$), finalize(() => this.isLoading = false))
      .subscribe({ next: r => { if (r.data) this.dataSource.data = r.data; } });
  }

  applyFilter() {
    this.dataSource.filter = `${this.filterText.toLowerCase()}|${this.statusFilter}|${this.riskFilter}`;
  }

  openDetail(c: Candidate) { this.router.navigate(['/candidates', c.id]); }

  createCandidate() {
    if (!this.newCandidate.firstName || !this.newCandidate.lastName || !this.newCandidate.email) {
      this.snack.open('First name, last name and email are required.', 'OK', { duration: 3000 });
      return;
    }
    this.isCreating = true;
    this.candidatesSvc.create(this.newCandidate).pipe(finalize(() => this.isCreating = false))
      .subscribe({
        next: r => {
          this.snack.open('Candidate created successfully!', 'View', { duration: 3000 });
          this.showNewForm = false;
          this.newCandidate = { firstName: '', lastName: '', email: '', phone: '', nationality: 'Indian', currentAddress: '', dateOfBirth: '', notes: '' };
        },
        error: () => this.snack.open('Failed to create candidate.', 'Dismiss', { duration: 3000 }),
      });
  }

  riskColor(r: string) { const m: Record<string, string> = { 'Low': 'var(--status-success)', 'Medium': 'var(--accent-amber)', 'High': 'var(--status-error)', 'Critical': '#f87171' }; return m[r] || ''; }
  statusClass(s: string) { const m: Record<string, string> = { 'Active': 's-active', 'Flagged': 's-flagged', 'Archived': 's-archived' }; return m[s] || ''; }
  get totalCount() { return this.dataSource.data.length; }
  get activeCount() { return this.dataSource.data.filter(c => c.status === 'Active').length; }
  get flaggedCount() { return this.dataSource.data.filter(c => c.status === 'Flagged').length; }
  get highRiskCount() { return this.dataSource.data.filter(c => c.riskLevel === 'High' || c.riskLevel === 'Critical').length; }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }
}
