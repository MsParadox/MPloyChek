// ============================================================
// MPloyChek v4.0 — AuthService Unit Tests
// Author: Mohit Sharma
// ============================================================
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthService } from '../auth.service';
import { environment } from '@environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  const mockUser = {
    id: 'usr_1', userId: 'mohit001', firstName: 'Mohit', lastName: 'Sharma',
    role: 'General User' as any, email: 'm@test.com',
    department: 'Engineering', phone: '123',
    joinDate: '2024-01-01', status: 'Active' as any, lastLogin: null,
    preferences: { theme: 'dark' as any, emailNotifications: true, smsNotifications: false, language: 'en' },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [AuthService],
    });
    service  = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => { httpMock.verify(); localStorage.clear(); });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should not be authenticated initially', () => {
    expect(service.isAuthenticated).toBeFalse();
    expect(service.currentUser).toBeNull();
  });

  it('login() should store token and user on success', () => {
    // FIXED: no role in request body; FIXED: response uses accessToken not token
    const mockResponse = {
      success: true,
      data: { accessToken: 'mock.jwt.access', refreshToken: 'mock.refresh', user: mockUser, expiresIn: 28800 },
      timestamp: new Date().toISOString(),
    };

    // FIXED: login({ userId, password }) — no role
    service.login({ userId: 'mohit001', password: 'User@123' }, 0).subscribe(res => {
      expect(res.success).toBeTrue();
      // FIXED: token stored from accessToken field
      expect(localStorage.getItem(environment.tokenKey)).toBe('mock.jwt.access');
      expect(service.currentUser).toEqual(mockUser);
      expect(service.isAuthenticated).toBeTrue();
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    // FIXED: body should NOT contain role
    expect(req.request.body).toEqual({ userId: 'mohit001', password: 'User@123' });
    expect(req.request.body).not.toHaveProperty('role');
    req.flush(mockResponse);
  });

  it('login() with wrong credentials should return 401 error', () => {
    // FIXED: no role field
    service.login({ userId: 'bad', password: 'bad' }, 0).subscribe({
      error: err => expect(err.status).toBe(401),
    });
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    req.flush({ success: false, error: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
  });

  it('isAdmin should return false for non-admin user', () => {
    // FIXED: private subject is `userSubject`, not `currentUserSubject`
    (service as any).userSubject.next({ role: 'General User' });
    expect(service.isAdmin).toBeFalse();
  });

  it('isAdmin should return true for Admin role', () => {
    (service as any).userSubject.next({ role: 'Admin' });
    expect(service.isAdmin).toBeTrue();
  });

  it('isManager should return true for Manager role', () => {
    (service as any).userSubject.next({ role: 'Manager' });
    expect(service.isManager).toBeTrue();
  });

  it('isVerifier should return true for Verifier role', () => {
    (service as any).userSubject.next({ role: 'Verifier' });
    expect(service.isVerifier).toBeTrue();
  });

  it('logout() should clear localStorage', () => {
    localStorage.setItem(environment.tokenKey,   'some.token');
    localStorage.setItem(environment.refreshKey, 'some.refresh');
    localStorage.setItem(environment.userKey,    JSON.stringify(mockUser));

    service.logout();

    // logout fires HTTP POST then clears — intercept so httpMock.verify() passes
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/logout`);
    req.flush({ success: true });

    expect(localStorage.getItem(environment.tokenKey)).toBeNull();
    expect(service.currentUser).toBeNull();
    expect(service.isAuthenticated).toBeFalse();
  });

  it('changePassword() should POST to correct endpoint with correct body', () => {
    const mockResp = { success: true, message: 'Password changed', timestamp: new Date().toISOString() };
    service.changePassword('old123', 'New@1234').subscribe(res => expect(res.success).toBeTrue());
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/change-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ currentPassword: 'old123', newPassword: 'New@1234' });
    req.flush(mockResp);
  });

  it('token getter returns null when not logged in', () => {
    expect(service.token).toBeNull();
  });
});
