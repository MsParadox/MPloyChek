import { Component, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { SearchService, SearchResult, SearchResponse } from '../../../core/services/search.service';

@Component({
  selector: 'app-global-search',
  template: `
    <div class="gs-wrap" [class.open]="isOpen">
      <div class="gs-input-row">
        <span class="gs-icon">⌕</span>
        <input
          #searchInput
          class="gs-input"
          placeholder="Search records, candidates, users…"
          [(ngModel)]="query"
          (ngModelChange)="onQuery($event)"
          (focus)="isOpen = true"
          (keydown.escape)="close()"
        />
        <kbd class="gs-kbd" *ngIf="!isOpen">⌘K</kbd>
        <button class="gs-clear" *ngIf="query" (click)="clear()">✕</button>
      </div>

      <div class="gs-dropdown" *ngIf="isOpen && (results || isSearching)">
        <div class="gs-loading" *ngIf="isSearching"><div class="gs-spinner"></div>Searching…</div>

        <ng-container *ngIf="!isSearching && results">
          <div class="gs-empty" *ngIf="results && total === 0 && query.length >= 2">
            No results for "<strong>{{ query }}</strong>"
          </div>

          <div class="gs-group" *ngIf="results.records.length > 0">
            <div class="gs-group-label"><span class="gs-dot rec"></span>Records</div>
            <div class="gs-item" *ngFor="let r of results.records" (click)="go(r)">
              <div class="gi-title">{{ r.title }}</div>
              <div class="gi-meta"><span class="gi-type">{{ r.subtitle }}</span><span class="gi-status">{{ r.meta }}</span></div>
            </div>
          </div>

          <div class="gs-group" *ngIf="results.candidates.length > 0">
            <div class="gs-group-label"><span class="gs-dot cand"></span>Candidates</div>
            <div class="gs-item" *ngFor="let c of results.candidates" (click)="go(c)">
              <div class="gi-title">{{ c.title }}</div>
              <div class="gi-meta"><span class="gi-type">{{ c.subtitle }}</span><span class="gi-status">{{ c.meta }}</span></div>
            </div>
          </div>

          <div class="gs-group" *ngIf="results.users.length > 0">
            <div class="gs-group-label"><span class="gs-dot user"></span>Users</div>
            <div class="gs-item" *ngFor="let u of results.users" (click)="go(u)">
              <div class="gi-title">{{ u.title }}</div>
              <div class="gi-meta"><span class="gi-type">{{ u.subtitle }}</span><span class="gi-status">{{ u.meta }}</span></div>
            </div>
          </div>
        </ng-container>

        <div class="gs-hint" *ngIf="!query || query.length < 2">Type at least 2 characters to search…</div>
      </div>
    </div>
  `,
  styles: [`
    .gs-wrap{position:relative;width:340px}
    .gs-input-row{display:flex;align-items:center;gap:8px;background:var(--line-1);border:1px solid var(--line-1);border-radius:10px;padding:7px 12px;transition:all .2s;&:focus-within{border-color:rgba(45,212,191,.35);background:rgba(45,212,191,.04)}}
    .gs-icon{color:var(--t-4);font-size:16px;flex-shrink:0}
    .gs-input{flex:1;background:transparent;border:none;outline:none;color: var(--t-1);font-size:13px;font-family:inherit;&::placeholder{color:var(--t-4)}}
    .gs-kbd{background:var(--line-1);border:1px solid var(--line-2);border-radius:4px;padding:1px 6px;font-size:10px;color:var(--t-4);flex-shrink:0}
    .gs-clear{background:none;border:none;color:var(--t-4);cursor:pointer;font-size:12px;padding:0;flex-shrink:0;&:hover{color: var(--t-1)}}
    .gs-dropdown{position:absolute;top:calc(100% + 8px);left:0;right:0;background:var(--surface-1);border:1px solid var(--line-1);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.5);z-index:9999;max-height:440px;overflow-y:auto;padding:8px 0;
      &::-webkit-scrollbar{width:4px}&::-webkit-scrollbar-thumb{background:var(--line-2);border-radius:2px}}
    .gs-loading{display:flex;align-items:center;gap:10px;padding:16px 16px;color:var(--t-4);font-size:13px}
    .gs-spinner{width:14px;height:14px;border-radius:50%;border:2px solid rgba(45,212,191,.2);border-top-color:var(--accent-teal);animation:spin .7s linear infinite;flex-shrink:0}
    @keyframes spin{to{transform:rotate(360deg)}}
    .gs-empty{padding:24px 16px;text-align:center;font-size:13px;color:var(--t-4);strong{color:var(--t-3)}}
    .gs-group{padding:8px 0}
    .gs-group-label{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--t-4);padding:4px 14px 6px}
    .gs-dot{width:6px;height:6px;border-radius:50%;display:inline-block;&.rec{background:var(--accent-teal)}&.cand{background:var(--accent-amber)}&.user{background:#a78bfa}}
    .gs-item{padding:10px 14px;cursor:pointer;transition:background .15s;&:hover{background:var(--fill-1)}}
    .gi-title{font-size:13px;font-weight:600;color:var(--t-1)}
    .gi-meta{display:flex;gap:8px;margin-top:2px}
    .gi-type{font-size:11px;color:var(--t-4)}
    .gi-status{font-size:11px;color:var(--t-4)}
    .gs-hint{padding:16px;font-size:12px;color:var(--t-4);text-align:center}
  `]
})
export class GlobalSearchComponent implements OnInit, OnDestroy {
  query = '';
  isOpen = false;
  isSearching = false;
  results: SearchResponse | null = null;
  total = 0;
  private destroy$ = new Subject<void>();

  constructor(private searchSvc: SearchService, private router: Router, private el: ElementRef) {}

  ngOnInit() {
    this.searchSvc.search$.pipe(takeUntil(this.destroy$)).subscribe((r: any) => {
      this.isSearching = false;
      if (r?.data) { this.results = r.data; this.total = r.total || 0; }
    });
  }

  onQuery(q: string) {
    if (q.length >= 2) { this.isSearching = true; this.searchSvc.push(q); }
    else { this.results = null; this.isSearching = false; }
  }

  go(r: SearchResult) {
    this.router.navigateByUrl(r.link);
    this.close();
  }

  clear() { this.query = ''; this.results = null; }
  close() { this.isOpen = false; this.clear(); }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event) {
    if (!this.el.nativeElement.contains(e.target)) this.close();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault(); this.isOpen = true;
      setTimeout(() => this.el.nativeElement.querySelector('input')?.focus(), 50);
    }
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }
}
