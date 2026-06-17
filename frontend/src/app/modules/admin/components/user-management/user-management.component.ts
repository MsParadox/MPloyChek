// ============================================================
// MPloyChek — User Management Component (Admin only)
// Full CRUD: Create, Read, Update, Delete users
// ============================================================
import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator }       from '@angular/material/paginator';
import { MatSort }            from '@angular/material/sort';
import { MatDialog }          from '@angular/material/dialog';
import { MatSnackBar }        from '@angular/material/snack-bar';
import { Subject, takeUntil, finalize } from 'rxjs';
import { UserService }          from '../../../../core/services/user.service';
import { UserDialogComponent }  from '../user-dialog/user-dialog.component';
import { User, UserStatus }     from '../../../../core/models';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss'],
})
export class UserManagementComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort)      sort!: MatSort;

  dataSource  = new MatTableDataSource<User>([]);
  displayedColumns = ['userId', 'name', 'role', 'department', 'status', 'joinDate', 'lastLogin', 'actions'];
  filterValue = '';
  isLoading   = false;
  deletingId: string | null = null;
  asyncDelay  = 500;

  private destroy$ = new Subject<void>();

  constructor(
    private userSvc: UserService,
    private dialog:  MatDialog,
    private snack:   MatSnackBar,
  ) {}

  ngOnInit(): void    { this.loadUsers(); }
  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort      = this.sort;
    this.dataSource.filterPredicate = (user, filter) => {
      const text = `${user.userId} ${user.firstName} ${user.lastName} ${user.email} ${user.department} ${user.role}`.toLowerCase();
      return text.includes(filter);
    };
  }

  loadUsers(): void {
    this.isLoading = true;
    this.userSvc.getUsers(this.asyncDelay).pipe(
      takeUntil(this.destroy$),
      finalize(() => (this.isLoading = false))
    ).subscribe({
      next: res => {
        if (res.data) {
          this.dataSource.data = res.data;
        }
      },
      error: () => this.snack.open('Failed to load users', 'Dismiss', { duration: 3000 }),
    });
  }

  applyFilter(value: string): void {
    this.filterValue = value;
    this.dataSource.filter = value.trim().toLowerCase();
  }

  // ── Create ───────────────────────────────────────────────
  openCreateDialog(): void {
    const ref = this.dialog.open(UserDialogComponent, {
      width: '540px',
      data: { mode: 'create' },
      panelClass: 'dark-dialog',
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.loadUsers();
    });
  }

  // ── Edit ─────────────────────────────────────────────────
  openEditDialog(user: User): void {
    const ref = this.dialog.open(UserDialogComponent, {
      width: '540px',
      data: { mode: 'edit', user },
      panelClass: 'dark-dialog',
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.loadUsers();
    });
  }

  // ── Delete ───────────────────────────────────────────────
  deleteUser(user: User): void {
    if (!confirm(`Delete user "${user.userId}"? This cannot be undone.`)) return;
    this.deletingId = user.id;
    this.userSvc.deleteUser(user.id).pipe(
      takeUntil(this.destroy$),
      finalize(() => (this.deletingId = null))
    ).subscribe({
      next: () => this.snack.open(`User "${user.userId}" deleted`, 'Dismiss', { duration: 3000 }),
      error: () => this.snack.open('Failed to delete user', 'Dismiss', { duration: 3000 }),
    });
  }

  // ── Toggle status ────────────────────────────────────────
  toggleStatus(user: User): void {
    const newStatus: UserStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    this.userSvc.updateUser(user.id, { status: newStatus }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => this.snack.open(`Status updated to ${newStatus}`, 'OK', { duration: 2000 }),
      error: () => this.snack.open('Update failed', 'Dismiss', { duration: 3000 }),
    });
  }

  statusClass(s: string): string {
    switch (s) {
      case 'Active':    return 'status-active';
      case 'Inactive':  return 'status-inactive';
      case 'Suspended': return 'status-suspended';
      default: return '';
    }
  }

  formatDate(d: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  get totalUsers(): number   { return this.dataSource.data.length; }
  get activeUsers(): number  { return this.dataSource.data.filter(u => u.status === 'Active').length; }
  get adminUsers(): number   { return this.dataSource.data.filter(u => u.role === 'Admin').length; }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
