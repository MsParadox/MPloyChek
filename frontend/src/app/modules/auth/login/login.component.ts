// ============================================================
// MPloyChek — Login Component
//   The server assigns the role from the database.
//   The user simply provides userId + password.
// Author: Mohit Sharma
// ============================================================
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil, finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm!: FormGroup;
  isLoading    = false;
  showPassword = false;
  errorMsg     = '';
  processingMs = 0;
  private destroy$ = new Subject<void>();

  // Demo credentials — role is shown as info only, never sent to server
  demoCredentials = [
    { userId: 'admin001', password: 'Admin@123', roleHint: 'Admin' },
    { userId: 'mohit001', password: 'User@123',  roleHint: 'General User' },
    { userId: 'john001',  password: 'User@123',  roleHint: 'Manager' },
    { userId: 'priya001', password: 'Verify@123', roleHint: 'Verifier' },
  ];

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    // FIXED: no role field — userId + password only
    this.loginForm = this.fb.group({
      userId:   ['', [Validators.required, Validators.minLength(4)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      delay:    [800],
    });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['reason'] === 'session_expired') {
        this.errorMsg = 'Your session expired. Please log in again.';
      }
    });
  }

  fillDemo(cred: typeof this.demoCredentials[0]): void {
    // FIXED: only patch userId + password — role is NOT part of the form
    this.loginForm.patchValue({ userId: cred.userId, password: cred.password });
    this.errorMsg = '';
  }

  onSubmit(): void {
    if (this.loginForm.invalid || this.isLoading) return;
    this.isLoading = true;
    this.errorMsg  = '';
    const { userId, password, delay } = this.loginForm.value;
    const start = Date.now();

    // FIXED: sending only userId + password — no role
    this.auth.login({ userId, password }, delay).pipe(
      takeUntil(this.destroy$),
      finalize(() => { this.isLoading = false; })
    ).subscribe({
      next: res => {
        this.processingMs = Date.now() - start;
        if (res.success && res.data) {
          this.snack.open(`Welcome, ${res.data.user.firstName}! 🎉`, 'Dismiss', { duration: 3000 });
          this.router.navigate(['/dashboard']);
        }
      },
      error: err => {
        const msg = err?.error?.error || 'Invalid credentials. Please try again.';
        this.errorMsg = msg;
        this.snack.open(msg, 'Dismiss', { duration: 4000, panelClass: 'error-snack' });
      },
    });
  }

  get f() { return this.loginForm.controls; }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
