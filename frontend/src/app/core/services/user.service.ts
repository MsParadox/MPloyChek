// ============================================================
// MPloyChek — User Service
// Handles all /api/users calls with async delay support
// ============================================================
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { environment } from '@environments/environment';
import {
  ApiResponse, User, DashboardStats,
  CreateUserPayload, UpdateUserPayload,
} from '../models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly API = `${environment.apiUrl}/users`;

  // ── User list cache ──────────────────────────────────────
  private usersSubject = new BehaviorSubject<User[]>([]);
  public  users$       = this.usersSubject.asObservable();

  constructor(private http: HttpClient) {}

  /** Fetch all users (Admin) or self (General User).
   *  @param delay optional ms delay — showcases async processing */
  getUsers(delay = 0): Observable<ApiResponse<User[]>> {
    const params = delay > 0 ? new HttpParams().set('delay', delay) : undefined;
    return this.http.get<ApiResponse<User[]>>(this.API, { params }).pipe(
      tap(res => { if (res.success && res.data) this.usersSubject.next(res.data); })
    );
  }

  getUserById(id: string): Observable<ApiResponse<User>> {
    return this.http.get<ApiResponse<User>>(`${this.API}/${id}`);
  }

  getStats(): Observable<ApiResponse<DashboardStats>> {
    return this.http.get<ApiResponse<DashboardStats>>(`${this.API}/stats`);
  }

  createUser(payload: CreateUserPayload): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(this.API, payload).pipe(
      tap(res => {
        if (res.success && res.data) {
          const current = this.usersSubject.value;
          this.usersSubject.next([...current, res.data]);
        }
      })
    );
  }

  updateUser(id: string, payload: UpdateUserPayload): Observable<ApiResponse<User>> {
    return this.http.patch<ApiResponse<User>>(`${this.API}/${id}`, payload).pipe(
      tap(res => {
        if (res.success && res.data) {
          const current = this.usersSubject.value;
          this.usersSubject.next(current.map(u => u.id === id ? res.data! : u));
        }
      })
    );
  }

  deleteUser(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.API}/${id}`).pipe(
      tap(res => {
        if (res.success) {
          const current = this.usersSubject.value;
          this.usersSubject.next(current.filter(u => u.id !== id));
        }
      })
    );
  }
}
