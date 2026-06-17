import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '@environments/environment';
import { ApiResponse, Notification } from '../models';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly API = `${environment.apiUrl}/notifications`;
  private subj  = new BehaviorSubject<Notification[]>([]);
  private unread = new BehaviorSubject<number>(0);
  notifications$ = this.subj.asObservable();
  unreadCount$   = this.unread.asObservable();
  constructor(private http: HttpClient) {}

  load(): Observable<ApiResponse<Notification[]>> {
    return this.http.get<ApiResponse<Notification[]>>(this.API).pipe(
      tap(r => { if (r.data) { this.subj.next(r.data); this.unread.next(r.unread || 0); } })
    );
  }
  markRead(id: string): Observable<ApiResponse<Notification>> {
    return this.http.patch<ApiResponse<Notification>>(`${this.API}/${id}/read`, {}).pipe(
      tap(() => { const ns = this.subj.value.map(n => n.id === id ? { ...n, read: true } : n); this.subj.next(ns); this.unread.next(ns.filter(n => !n.read).length); })
    );
  }
  markAllRead(): Observable<ApiResponse<void>> {
    return this.http.patch<ApiResponse<void>>(`${this.API}/mark-all-read`, {}).pipe(
      tap(() => { this.subj.next(this.subj.value.map(n => ({ ...n, read: true }))); this.unread.next(0); })
    );
  }
  get current() { return this.subj.value; }
}
