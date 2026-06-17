// ============================================================
// MPloyChek — User Dialog Component (Create / Edit)
// ============================================================
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import { UserService } from '../../../../core/services/user.service';
import { User, UserRole, DEPARTMENTS, USER_ROLES } from '../../../../core/models';

export interface DialogData {
  mode: 'create' | 'edit';
  user?: User;
}

@Component({
  selector: 'app-user-dialog',
  templateUrl: './user-dialog.component.html',
  styleUrls: ['./user-dialog.component.scss'],
})
export class UserDialogComponent implements OnInit {
  form!: FormGroup;
  isLoading   = false;
  showPassword = false;
  roles: UserRole[]   = USER_ROLES;
  departments: string[] = DEPARTMENTS;

  constructor(
    private fb:      FormBuilder,
    private userSvc: UserService,
    private snack:   MatSnackBar,
    public  dialogRef: MatDialogRef<UserDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) {}

  get isEdit(): boolean { return this.data.mode === 'edit'; }
  get title(): string   { return this.isEdit ? 'Edit User' : 'Create New User'; }

  ngOnInit(): void {
    this.form = this.fb.group({
      userId:     [this.data.user?.userId     || '', [Validators.required, Validators.minLength(4), Validators.pattern(/^\S+$/)]],
      firstName:  [this.data.user?.firstName  || '', [Validators.required]],
      lastName:   [this.data.user?.lastName   || '', [Validators.required]],
      email:      [this.data.user?.email      || '', [Validators.required, Validators.email]],
      role:       [this.data.user?.role       || 'General User', Validators.required],
      department: [this.data.user?.department || 'Engineering',  Validators.required],
      phone:      [this.data.user?.phone      || '', [Validators.required]],
      status:     [this.data.user?.status     || 'Active'],
      password:   ['', this.isEdit ? [] : [Validators.required, Validators.minLength(8)]],
    });

    // Disable userId in edit mode
    if (this.isEdit) this.form.get('userId')?.disable();
  }

  onSubmit(): void {
    if (this.form.invalid || this.isLoading) return;
    this.isLoading = true;
    const raw = this.form.getRawValue();

    const obs = this.isEdit
      ? this.userSvc.updateUser(this.data.user!.id, {
          firstName: raw.firstName,
          lastName:  raw.lastName,
          email:     raw.email,
          role:      raw.role,
          department:raw.department,
          phone:     raw.phone,
          status:    raw.status,
        })
      : this.userSvc.createUser(raw);

    obs.pipe(finalize(() => (this.isLoading = false))).subscribe({
      next: res => {
        if (res.success) {
          this.snack.open(
            this.isEdit ? 'User updated successfully' : 'User created successfully',
            'OK', { duration: 3000 }
          );
          this.dialogRef.close(true);
        }
      },
      error: err => {
        const msg = err?.error?.error || 'Operation failed';
        this.snack.open(msg, 'Dismiss', { duration: 4000 });
      },
    });
  }

  cancel(): void { this.dialogRef.close(false); }
  get f() { return this.form.controls; }
}
