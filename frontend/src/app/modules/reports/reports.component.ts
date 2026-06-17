import { Component, OnInit } from '@angular/core';
import { AnalyticsService } from '../../core/services/analytics.service';
import { ExportService } from '../../core/services/export.service';
import { AnalyticsOverview } from '../../core/models';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss'],
})
export class ReportsComponent implements OnInit {
  overview: AnalyticsOverview | null = null;
  isLoading = true;

  constructor(private analyticsSvc: AnalyticsService, private exportSvc: ExportService) {}

  exportRecords() { this.exportSvc.downloadCSV('records', 'mploychek-records-' + new Date().toISOString().split('T')[0] + '.csv'); }
  exportCandidates() { this.exportSvc.downloadCSV('candidates', 'mploychek-candidates-' + new Date().toISOString().split('T')[0] + '.csv'); }
  exportAudit() { this.exportSvc.downloadCSV('audit-logs', 'mploychek-audit-' + new Date().toISOString().split('T')[0] + '.csv'); }

  ngOnInit() {
    this.analyticsSvc.getOverview(500).subscribe({
      next: r => { this.overview = r.data || null; this.isLoading = false; },
      error: () => this.isLoading = false,
    });
  }

  get byStatusEntries() { return this.overview ? Object.entries(this.overview.byStatus) : []; }
  get byTypeEntries()   { return this.overview ? Object.entries(this.overview.byType).slice(0, 6) : []; }
  get totalByType()     { return this.byTypeEntries.reduce((s, [, v]) => s + (v as number), 0) || 1; }
  get totalByStatus()   { return this.byStatusEntries.reduce((s, [, v]) => s + (v as number), 0) || 1; }

  statusColor(s: string): string {
    // FIX: Include all v4.0 workflow states in analytics chart colours
    const m: Record<string, string> = {
      'Completed':            'var(--status-success)',
      'Approved':             'var(--status-success)',
      'In Progress':          '#60a5fa',
      'In Review':            '#60a5fa',
      'Verification Running': '#60a5fa',
      'Pending':              'var(--accent-amber)',
      'On Hold':              'var(--t-4)',
      'Failed':               'var(--status-error)',
      'Rejected':             'var(--status-error)',
      'Cancelled':            'var(--t-5)',
    };
    return m[s] || 'var(--t-4)';
  }
  typeColor(i: number): string {
    const colors = ['var(--accent-teal)', 'var(--accent-amber)', '#60a5fa', 'var(--status-success)', '#a78bfa', '#fb923c'];
    return colors[i % colors.length];
  }
  riskColor(r: string) { const m: Record<string,string> = {'Low':'var(--status-success)','Medium':'var(--accent-amber)','High':'var(--status-error)','Critical':'#f87171'}; return m[r]||''; }
  pct(v: number, t: number) { return t > 0 ? Math.round((v / t) * 100) : 0; }

  // Donut geometry (circumference for r=45 ≈ 282.7). Computed here because
  // Angular template expressions can't contain arrow functions / reduce.
  donutDashArray(value: number): string {
    const seg = this.pct(value, this.totalByStatus) * 2.827;
    return `${seg} ${282.7 - seg}`;
  }
  donutDashOffset(index: number): number {
    const acc = this.byStatusEntries
      .slice(0, index)
      .reduce((sum, e) => sum + this.pct(+e[1], this.totalByStatus) * 2.827, 0);
    return -(acc - 70.675);
  }
  formatCurrency(v: number) { return `₹${(v/1000).toFixed(1)}K`; }
  formatTimestamp(ts: string) { return new Date(ts).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }); }
  actionColor(a: string) { const m: Record<string,string> = {'LOGIN':'var(--accent-teal)','CREATE_RECORD':'var(--status-success)','UPDATE_RECORD':'var(--accent-amber)','CREATE_USER':'#60a5fa','DELETE_USER':'var(--status-error)','EXPORT_DATA':'#a78bfa'}; return m[a]||'var(--t-4)'; }
}
