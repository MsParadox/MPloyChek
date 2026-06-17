import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '@environments/environment';
import { ApiResponse, Candidate } from '../models';

@Injectable({ providedIn: 'root' })
export class CandidatesService {
  private readonly API = `${environment.apiUrl}/candidates`;
  private subj = new BehaviorSubject<Candidate[]>([]);
  candidates$ = this.subj.asObservable();
  constructor(private http: HttpClient) {}

  load(delay = 0): Observable<ApiResponse<Candidate[]>> {
    const params = delay > 0 ? new HttpParams().set('delay', delay) : undefined;
    return this.http.get<ApiResponse<Candidate[]>>(this.API, { params }).pipe(
      tap(r => { if (r.data) this.subj.next(r.data); })
    );
  }
  getById(id: string): Observable<ApiResponse<Candidate>> {
    return this.http.get<ApiResponse<Candidate>>(`${this.API}/${id}`);
  }
  create(payload: any): Observable<ApiResponse<Candidate>> {
    return this.http.post<ApiResponse<Candidate>>(this.API, payload).pipe(
      tap(r => { if (r.data) this.subj.next([...this.subj.value, r.data]); })
    );
  }
  update(id: string, patch: any): Observable<ApiResponse<Candidate>> {
    return this.http.patch<ApiResponse<Candidate>>(`${this.API}/${id}`, patch).pipe(
      tap(r => { if (r.data) this.subj.next(this.subj.value.map(c => c.id === id ? r.data! : c)); })
    );
  }
  delete(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/${id}`).pipe(
      tap(r => { if (r.success) this.subj.next(this.subj.value.filter(c => c.id !== id)); })
    );
  }
  get current() { return this.subj.value; }
}
