import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, finalize } from 'rxjs';
import { environment } from '@environments/environment';
import { ApiResponse, VerificationRecord } from '../models';

@Injectable({ providedIn: 'root' })
export class RecordsService {
  private readonly API = `${environment.apiUrl}/records`;
  private subj    = new BehaviorSubject<VerificationRecord[]>([]);
  private loading = new BehaviorSubject<boolean>(false);
  records$  = this.subj.asObservable();
  loading$  = this.loading.asObservable();
  constructor(private http: HttpClient) {}

  loadRecords(delay = environment.defaultDelay, filters: any = {}): Observable<ApiResponse<VerificationRecord[]>> {
    this.loading.next(true);
    let params = new HttpParams();
    if (delay > 0) params = params.set('delay', delay);
    Object.entries(filters).forEach(([k,v]) => { if (v) params = params.set(k, v as string); });
    return this.http.get<ApiResponse<VerificationRecord[]>>(this.API, { params }).pipe(
      tap(r => { if (r.data) this.subj.next(r.data); }),
      finalize(() => this.loading.next(false))
    );
  }
  getById(id: string): Observable<ApiResponse<VerificationRecord>> {
    return this.http.get<ApiResponse<VerificationRecord>>(`${this.API}/${id}`);
  }
  create(payload: any): Observable<ApiResponse<VerificationRecord>> {
    return this.http.post<ApiResponse<VerificationRecord>>(this.API, payload).pipe(
      tap(r => { if (r.data) this.subj.next([r.data, ...this.subj.value]); })
    );
  }
  update(id: string, patch: any): Observable<ApiResponse<VerificationRecord>> {
    return this.http.patch<ApiResponse<VerificationRecord>>(`${this.API}/${id}`, patch).pipe(
      tap(r => { if (r.data) this.subj.next(this.subj.value.map(r2 => r2.id === id ? r.data! : r2)); })
    );
  }
  getSummary(): Observable<ApiResponse<unknown>> {
    return this.http.get<ApiResponse<unknown>>(`${this.API}/summary`);
  }
  get current() { return this.subj.value; }
  get isLoading() { return this.loading.value; }
}
