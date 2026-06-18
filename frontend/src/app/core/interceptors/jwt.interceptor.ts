// ============================================================
// MPloyChek v4.0 — JWT HTTP Interceptor
// Author: Mohit Sharma
// ============================================================
import { Injectable } from '@angular/core';
import {
  HttpEvent, HttpHandler, HttpInterceptor,
  HttpRequest, HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, catchError, filter, switchMap, take, timeout, TimeoutError } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '@environments/environment';

const REQUEST_TIMEOUT_MS = 65_000; // 12s — Render cold start takes ~60s; short timeout shows error fast so user can retry

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshDone$ = new BehaviorSubject<string | null>(null);

  constructor(private router: Router) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token   = localStorage.getItem(environment.tokenKey);
    const authReq = token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

    return next.handle(authReq).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      catchError((err: HttpErrorResponse | TimeoutError) => {
        if (err instanceof TimeoutError) {
          return throwError(() => ({ error: { error: 'Server is waking up — please try again in a few seconds.' }, status: 0 }));
        }
        if (err.status === 401 && !req.url.includes('/auth/')) {
          return this.handle401(req, next as HttpHandler);
        }
        if (err.status === 401) {
          this.clearAndRedirect();
        }
        return throwError(() => err);
      })
    );
  }

  private handle401(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (this.isRefreshing) {
      // Queue requests while refresh is in-flight (handles parallel 401s)
      return this.refreshDone$.pipe(
        filter(t  => t !== null),
        take(1),
        switchMap(t => next.handle(req.clone({ setHeaders: { Authorization: `Bearer ${t}` } })))
      );
    }

    this.isRefreshing = true;
    this.refreshDone$.next(null);

    // FIX 9: Use environment.refreshKey (not hardcoded 'mploychek_rt')
    const rt = localStorage.getItem(environment.refreshKey);
    if (!rt) {
      this.clearAndRedirect();
      return throwError(() => new Error('No refresh token'));
    }

    return new Observable(observer => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      fetch(`${environment.apiUrl}/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken: rt }),
        signal:  ctrl.signal,
      })
      .then(r => { clearTimeout(timer); return r.json(); })
      .then(data => {
        if (data.success && data.data) {
          const newToken = data.data.accessToken;
          // FIX 9: Use environment keys throughout
          localStorage.setItem(environment.tokenKey,   newToken);
          localStorage.setItem(environment.refreshKey, data.data.refreshToken);
          this.refreshDone$.next(newToken);
          this.isRefreshing = false;

          const retried = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
          next.handle(retried).subscribe({
            next:     v => observer.next(v),
            error:    e => observer.error(e),
            complete: () => observer.complete(),
          });
        } else {
          this.isRefreshing = false;
          this.clearAndRedirect();
          observer.error(new Error('Token refresh failed'));
        }
      })
      .catch(() => {
        this.isRefreshing = false;
        this.clearAndRedirect();
        observer.error(new Error('Token refresh network error'));
      });
    });
  }

  private clearAndRedirect(): void {
    // FIX 9: Use environment keys (no hardcoded strings)
    [environment.tokenKey, environment.userKey, environment.refreshKey]
      .forEach(k => localStorage.removeItem(k));
    this.router.navigate(['/auth/login'], { queryParams: { reason: 'session_expired' } });
  }
}
