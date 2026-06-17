// ============================================================
// MPloyChek v4.0 — Angular AuthService
// Author: Mohit Sharma
// ============================================================
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  BehaviorSubject, Observable,
  tap, catchError, throwError, finalize,
} from 'rxjs';
import { environment } from '@environments/environment';
import { ApiResponse, LoginRequest, RegisterRequest, LoginResponse, User } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY   = environment.tokenKey;
  private readonly USER_KEY    = environment.userKey;
  private readonly REFRESH_KEY = environment.refreshKey;  // FIX 10: use env constant
  private readonly API         = `${environment.apiUrl}/auth`;

  private userSubject = new BehaviorSubject<User | null>(this.loadUser());
  private loadingSubj = new BehaviorSubject<boolean>(false);

  currentUser$ = this.userSubject.asObservable();
  loading$     = this.loadingSubj.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  get currentUser()     { return this.userSubject.value; }
  get isAuthenticated() { return !!this.token && !!this.currentUser; }
  get isAdmin()         { return this.currentUser?.role === 'Admin'; }
  get isManager()       { return this.currentUser?.role === 'Manager'; }
  get isVerifier()      { return this.currentUser?.role === 'Verifier'; }
  get token()           { return localStorage.getItem(this.TOKEN_KEY); }

  login(cred: LoginRequest, delay = environment.defaultDelay): Observable<ApiResponse<LoginResponse>> {
    this.loadingSubj.next(true);
    const p = delay > 0 ? `?delay=${delay}` : '';
    return this.http.post<ApiResponse<LoginResponse>>(`${this.API}/login${p}`, cred).pipe(
      tap(r => { if (r.success && r.data) this.storeSession(r.data); }),
      catchError(e => throwError(() => e)),
      finalize(() => this.loadingSubj.next(false)),
    );
  }

  // Public self-registration → logs the new General User in immediately.
  register(payload: RegisterRequest): Observable<ApiResponse<LoginResponse>> {
    this.loadingSubj.next(true);
    return this.http.post<ApiResponse<LoginResponse>>(`${this.API}/register`, payload).pipe(
      tap(r => { if (r.success && r.data) this.storeSession(r.data); }),
      catchError(e => throwError(() => e)),
      finalize(() => this.loadingSubj.next(false)),
    );
  }

  refreshAccessToken(): Observable<ApiResponse<LoginResponse>> {
    const refreshToken = localStorage.getItem(this.REFRESH_KEY);
    if (!refreshToken) return throwError(() => new Error('No refresh token'));

    return this.http.post<ApiResponse<LoginResponse>>(`${this.API}/refresh`, { refreshToken }).pipe(
      tap(r => {
        if (r.success && r.data) {
          // FIX 10: use accessToken (API field name)
          localStorage.setItem(this.TOKEN_KEY,   r.data.accessToken);
          localStorage.setItem(this.REFRESH_KEY, r.data.refreshToken);
        }
      }),
    );
  }

  logout(): void {
    this.http.post(`${this.API}/logout`, {}).pipe(
      catchError(() => throwError(() => null)),
      finalize(() => {
        this.clearSession();
        this.router.navigate(['/auth/login']);
      }),
    ).subscribe();
  }

  fetchMe(): Observable<ApiResponse<User>> {
    return this.http.get<ApiResponse<User>>(`${this.API}/me`).pipe(
      tap(r => {
        if (r.data) {
          this.storeUser(r.data);
          this.userSubject.next(r.data);
        }
      }),
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.API}/change-password`, {
      currentPassword, newPassword,
    });
  }

  hasRole(...roles: string[]): boolean {
    return roles.includes(this.currentUser?.role || '');
  }

  private storeSession(d: LoginResponse): void {
    // FIX 10: d.accessToken not d.token (LoginResponse now correctly typed)
    localStorage.setItem(this.TOKEN_KEY,   d.accessToken);
    localStorage.setItem(this.REFRESH_KEY, d.refreshToken);
    this.storeUser(d.user);
    this.userSubject.next(d.user);
  }

  private storeUser(u: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(u));
  }

  private clearSession(): void {
    [this.TOKEN_KEY, this.USER_KEY, this.REFRESH_KEY].forEach(k => localStorage.removeItem(k));
    this.userSubject.next(null);
  }

  private loadUser(): User | null {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
}
