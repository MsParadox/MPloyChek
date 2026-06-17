// MPloyChek — Auth Guard Tests
// Author: Mohit Sharma
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { AuthGuard, AdminGuard, LoginGuard } from '../auth.guard';
import { AuthService } from '../../services/auth.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';

const mockAuthService = (isAuthenticated: boolean, isAdmin = false) => ({
  isAuthenticated,
  isAdmin,
  currentUser: isAuthenticated ? { role: isAdmin ? 'Admin' : 'General User' } : null,
});

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientTestingModule],
      providers: [AuthGuard, AuthService],
    });
    guard  = TestBed.inject(AuthGuard);
    router = TestBed.inject(Router);
  });

  it('should be created', () => expect(guard).toBeTruthy());

  it('should allow authenticated user', () => {
    (guard as any).auth = mockAuthService(true);
    const result = guard.canActivate();
    expect(result).toBeTrue();
  });

  it('should redirect unauthenticated user to /auth/login', () => {
    (guard as any).auth = mockAuthService(false);
    const result = guard.canActivate();
    expect(result).not.toBeTrue();
    expect(result.toString()).toContain('auth/login');
  });
});

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientTestingModule],
      providers: [AdminGuard, AuthService],
    });
    guard = TestBed.inject(AdminGuard);
  });

  it('should allow Admin user', () => {
    (guard as any).auth = mockAuthService(true, true);
    expect(guard.canActivate()).toBeTrue();
  });

  it('should redirect non-admin to /dashboard', () => {
    (guard as any).auth = mockAuthService(true, false);
    const result = guard.canActivate();
    expect(result.toString()).toContain('dashboard');
  });
});

describe('LoginGuard', () => {
  let guard: LoginGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule, HttpClientTestingModule],
      providers: [LoginGuard, AuthService],
    });
    guard = TestBed.inject(LoginGuard);
  });

  it('should allow unauthenticated user to see login page', () => {
    (guard as any).auth = mockAuthService(false);
    expect(guard.canActivate()).toBeTrue();
  });

  it('should redirect authenticated user away from login', () => {
    (guard as any).auth = mockAuthService(true);
    const result = guard.canActivate();
    expect(result.toString()).toContain('dashboard');
  });
});
