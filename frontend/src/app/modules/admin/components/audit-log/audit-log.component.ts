import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { AnalyticsService } from '../../../../core/services/analytics.service';
import { AuditLog } from '../../../../core/models';

@Component({
  selector: 'app-audit-log',
  templateUrl: './audit-log.component.html',
  styleUrls: ['./audit-log.component.scss'],
})
export class AuditLogComponent implements OnInit, AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  dataSource = new MatTableDataSource<AuditLog>([]);
  columns = ['timestamp', 'action', 'performedByName', 'targetType', 'details', 'success'];
  isLoading = false;
  filterText = '';

  constructor(private analyticsSvc: AnalyticsService) {}

  ngOnInit() {
    this.isLoading = true;
    this.analyticsSvc.getAuditLogs().subscribe({
      next: r => { this.dataSource.data = r.data || []; this.isLoading = false; },
      error: () => this.isLoading = false,
    });
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = (log, f) =>
      `${log.action} ${log.performedByName} ${log.targetType} ${log.details}`.toLowerCase().includes(f);
  }

  applyFilter(v: string) { this.filterText = v; this.dataSource.filter = v.toLowerCase(); }
  formatTs(ts: string) { return new Date(ts).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  actionColor(a: string) { const m: Record<string,string> = {'LOGIN':'#60a5fa','LOGOUT':'var(--t-4)','CREATE_USER':'var(--status-success)','UPDATE_USER':'var(--accent-amber)','DELETE_USER':'var(--status-error)','CREATE_RECORD':'var(--accent-teal)','UPDATE_RECORD':'var(--accent-amber)','EXPORT_DATA':'#a78bfa','CREATE_CANDIDATE':'var(--status-success)','UPDATE_CANDIDATE':'var(--accent-amber)'}; return m[a]||'var(--t-4)'; }
  actionIcon(a: string) { const m: Record<string,string> = {'LOGIN':'login','LOGOUT':'logout','CREATE_USER':'person_add','UPDATE_USER':'edit','DELETE_USER':'person_remove','CREATE_RECORD':'add_task','UPDATE_RECORD':'task_alt','EXPORT_DATA':'download','CREATE_CANDIDATE':'how_to_reg','UPDATE_CANDIDATE':'manage_accounts'}; return m[a]||'event'; }
}
