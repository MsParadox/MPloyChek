import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationsService } from '../../core/services/notifications.service';
import { Notification } from '../../core/models';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss'],
})
export class NotificationsComponent implements OnInit {
  notifications: Notification[] = [];
  isLoading = true;
  filter: 'all' | 'unread' | 'info' | 'success' | 'warning' | 'error' = 'all';

  constructor(private notifSvc: NotificationsService, private router: Router) {}

  ngOnInit() {
    this.notifSvc.load().subscribe({ next: () => { this.notifications = this.notifSvc.current; this.isLoading = false; }, error: () => this.isLoading = false });
    this.notifSvc.notifications$.subscribe(n => this.notifications = n);
  }

  get filtered() {
    if (this.filter === 'all') return this.notifications;
    if (this.filter === 'unread') return this.notifications.filter(n => !n.read);
    return this.notifications.filter(n => n.type === this.filter);
  }

  markRead(n: Notification) { if (!n.read) this.notifSvc.markRead(n.id).subscribe(); }
  markAllRead() { this.notifSvc.markAllRead().subscribe(); }
  openLink(n: Notification) { this.markRead(n); if (n.link) this.router.navigateByUrl(n.link); }

  get unreadCount() { return this.notifications.filter(n => !n.read).length; }
  typeIcon(t: string) { const m: Record<string,string> = {'info':'info','success':'check_circle','warning':'warning','error':'error'}; return m[t]||'notifications'; }
  typeColor(t: string) { const m: Record<string,string> = {'info':'#60a5fa','success':'var(--status-success)','warning':'var(--accent-amber)','error':'var(--status-error)'}; return m[t]||''; }
  formatTime(ts: string) { const d = new Date(ts); const now = Date.now(); const diff = now - d.getTime(); if (diff < 3600000) return `${Math.round(diff/60000)}m ago`; if (diff < 86400000) return `${Math.round(diff/3600000)}h ago`; return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' }); }
}
