import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { ApiResponse, AnalyticsOverview } from '../models';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly API = `${environment.apiUrl}/analytics`;
  constructor(private http: HttpClient) {}
  getOverview(delay = 0): Observable<ApiResponse<AnalyticsOverview>> {
    const params = delay > 0 ? new HttpParams().set('delay', delay) : undefined;
    return this.http.get<ApiResponse<AnalyticsOverview>>(`${this.API}/overview`, { params });
  }
  getAuditLogs(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.API}/audit-logs`);
  }
}
