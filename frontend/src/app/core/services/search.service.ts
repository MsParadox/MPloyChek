// MPloyChek — Global Search Service
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { environment } from '@environments/environment';

export interface SearchResult { id: string; title: string; subtitle: string; meta: string; type: string; link: string; }
export interface SearchResponse { records: SearchResult[]; candidates: SearchResult[]; users: SearchResult[]; }

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly API = `${environment.apiUrl}/search`;
  private searchSubject = new Subject<string>();
  search$: Observable<any>;

  constructor(private http: HttpClient) {
    this.search$ = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => q.length >= 2 ? this.query(q) : of({ success:true, data:{ records:[], candidates:[], users:[] }, total:0 }))
    );
  }

  push(q: string) { this.searchSubject.next(q); }
  query(q: string): Observable<any> {
    return this.http.get(this.API, { params: new HttpParams().set('q', q) });
  }
}
