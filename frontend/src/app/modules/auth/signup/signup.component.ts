// ============================================================
// MPloyChek — Sign Up Component
// Public self-registration. The server always creates a General User
// (role is never sent from the client) and logs the user in on success.
// Author: Mohit Sharma
// ============================================================
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil, finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss'],
})
export class SignupComponent implements OnInit, OnDestroy {
  signupForm!: FormGroup;
  isLoading    = false;
  showPassword = false;
  errorMsg     = '';
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.signupForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(100)]],
      lastName:  ['', [Validators.required, Validators.maxLength(100)]],
      userId:    ['', [Validators.required, Validators.minLength(4), Validators.pattern(/^\S+$/)]],
      email:     ['', [Validators.required, Validators.email]],
      department: ['General'],
      phone:     [''],
      password:  ['', [Validators.required, Validators.minLength(8),
                       Validators.pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)]],
      confirmPassword: ['', Validators.required],
    }, { validators: this.passwordsMatch });
  }

  private passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const p = group.get('password')?.value;
    const c = group.get('confirmPassword')?.value;
    return p === c ? null : { mismatch: true };
  }

  onSubmit(): void {
    if (this.signupForm.invalid || this.isLoading) return;
    this.isLoading = true;
    this.errorMsg  = '';
    const { firstName, lastName, userId, email, department, phone, password } = this.signupForm.value;

    this.auth.register({ firstName, lastName, userId, email, department, phone, password }).pipe(
      takeUntil(this.destroy$),
      finalize(() => { this.isLoading = false; }),
    ).subscribe({
      next: res => {
        if (res.success && res.data) {
          this.snack.open(`Account created — welcome, ${res.data.user.firstName}! 🎉`, 'Dismiss', { duration: 3000 });
          this.router.navigate(['/dashboard']);
        }
      },
      error: err => {
        const msg = err?.error?.error || (err?.error?.details?.[0]?.message) || 'Registration failed. Please try again.';
        this.errorMsg = msg;
        this.snack.open(msg, 'Dismiss', { duration: 4000, panelClass: 'error-snack' });
      },
    });
  }

  get f() { return this.signupForm.controls; }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
