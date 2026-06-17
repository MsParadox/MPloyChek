import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { ExportService } from '../../core/services/export.service';
import { ThemeService } from '../../core/services/theme.service';
import { User } from '../../core/models';

@Component({ selector: 'app-profile', templateUrl: './profile.component.html', styleUrls: ['./profile.component.scss'] })
export class ProfileComponent implements OnInit {
  user: User | null = null;
  profileForm!: FormGroup;
  prefForm!: FormGroup;
  pwForm!: FormGroup;
  isSaving = false;
  isChangingPw = false;
  showCurrentPw = false;
  showNewPw = false;
  showConfirmPw = false;
  activeTab = 0;

  constructor(
    public auth: AuthService,
    public theme: ThemeService,
    private userSvc: UserService,
    private exportSvc: ExportService,
    private fb: FormBuilder,
    private snack: MatSnackBar,
  ) {}

  ngOnInit() {
    this.user = this.auth.currentUser;
    // Sync document lang with stored preference so it's always current.
    const lang = this.user?.preferences?.language || localStorage.getItem('mploychek_lang') || 'en';
    document.documentElement.lang = lang;

    this.profileForm = this.fb.group({
      firstName: [this.user?.firstName || '', Validators.required],
      lastName:  [this.user?.lastName  || '', Validators.required],
      email:     [this.user?.email     || '', [Validators.required, Validators.email]],
      phone:     [this.user?.phone     || '', Validators.required],
      bio:       [this.user?.bio       || ''],
    });
    this.prefForm = this.fb.group({
      emailNotifications: [this.user?.preferences?.emailNotifications ?? true],
      smsNotifications:   [this.user?.preferences?.smsNotifications   ?? false],
      language:           [this.user?.preferences?.language           ?? 'en'],
    });
    this.pwForm = this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword:     ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('newPassword')?.value === g.get('confirmPassword')?.value ? null : { mismatch: true };
  }

  saveProfile() {
    if (this.profileForm.invalid || !this.user) return;
    this.isSaving = true;
    this.userSvc.updateUser(this.user.id, this.profileForm.value)
      .pipe(finalize(() => this.isSaving = false)).subscribe({
        next: () => { this.auth.fetchMe().subscribe(); this.snack.open('Profile updated!', 'OK', { duration: 3000 }); },
        error: () => this.snack.open('Update failed.', 'Dismiss', { duration: 3000 }),
      });
  }

  savePrefs() {
    if (!this.user) return;
    this.isSaving = true;
    this.userSvc.updateUser(this.user.id, { preferences: this.prefForm.value } as any)
      .pipe(finalize(() => this.isSaving = false)).subscribe({
        next: () => {
          // Apply language change immediately — set the HTML lang attribute so
          // browsers, screen readers and date/number formatters pick it up.
          const lang = this.prefForm.value.language || 'en';
          document.documentElement.lang = lang;
          localStorage.setItem('mploychek_lang', lang);
          this.snack.open('Preferences saved! Language updated.', 'OK', { duration: 2500 });
        },
        error: () => this.snack.open('Failed to save.', 'Dismiss', { duration: 3000 }),
      });
  }

  changePassword() {
    if (this.pwForm.invalid) return;
    this.isChangingPw = true;
    const { currentPassword, newPassword } = this.pwForm.value;
    this.auth.changePassword(currentPassword, newPassword)
      .pipe(finalize(() => this.isChangingPw = false)).subscribe({
        next: () => {
          this.snack.open('Password changed successfully!', 'OK', { duration: 3000 });
          this.pwForm.reset();
        },
        error: (err) => {
          const msg = err?.error?.error || 'Failed to change password.';
          this.snack.open(msg, 'Dismiss', { duration: 4000 });
        },
      });
  }

  downloadMyData() {
    this.exportSvc.downloadCSV('records', 'my-verification-records.csv');
    this.snack.open('Downloading your records…', 'OK', { duration: 2000 });
  }

  // Password-rule helpers — Angular templates can't use regex literals,
  // so these are exposed as methods and called from the template.
  private get newPw(): string { return this.pwForm?.get('newPassword')?.value || ''; }
  ruleMinLength(): boolean { return this.newPw.length >= 8; }
  ruleUppercase(): boolean { return /[A-Z]/.test(this.newPw); }
  ruleNumber(): boolean { return /[0-9]/.test(this.newPw); }
  ruleSpecial(): boolean { return /[^A-Za-z0-9]/.test(this.newPw); }

  get initials() { return this.user ? `${this.user.firstName[0]}${this.user.lastName[0]}`.toUpperCase() : '?'; }
  get memberSince() { return this.user?.joinDate ? new Date(this.user.joinDate).toLocaleDateString('en-IN', { month:'long', year:'numeric' }) : '—'; }
  get lastLogin()   { return this.user?.lastLogin ? new Date(this.user.lastLogin).toLocaleString('en-IN') : 'Never'; }
  roleColor(r: string) { const m: Record<string,string> = {'Admin':'var(--accent-amber)','Manager':'#a78bfa','Verifier':'#60a5fa','General User':'var(--accent-teal)'}; return m[r]||''; }
  get pwStrength(): number {
    const pw = this.pwForm.get('newPassword')?.value || '';
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  }
  get pwStrengthLabel(): string { return ['','Weak','Fair','Good','Strong'][this.pwStrength]; }
  get pwStrengthColor(): string { return ['','var(--status-error)','var(--accent-amber)','#60a5fa','var(--status-success)'][this.pwStrength]; }
}
