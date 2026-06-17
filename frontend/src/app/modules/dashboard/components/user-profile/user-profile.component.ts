// MPloyChek — User Profile Component
import { Component, Input } from '@angular/core';
import { User } from '../../../../core/models';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss'],
})
export class UserProfileComponent {
  @Input() user: User | null = null;
  @Input() isLoading = false;
  @Input() recordCount = 0;
  @Input() pendingCount = 0;

  get initials(): string {
    if (!this.user) return '?';
    return `${this.user.firstName[0]}${this.user.lastName[0]}`.toUpperCase();
  }

  get fullName(): string {
    return this.user ? `${this.user.firstName} ${this.user.lastName}` : '';
  }

  get statusColor(): string {
    if (!this.user) return 'var(--t-5)';
    switch (this.user.status) {
      case 'Active':    return 'var(--status-success)';
      case 'Inactive':  return 'var(--status-warning)';
      case 'Suspended': return 'var(--status-error)';
      default:          return 'var(--t-4)';
    }
  }

  get memberSince(): string {
    if (!this.user?.joinDate) return '-';
    return new Date(this.user.joinDate).toLocaleDateString('en-IN', {
      month: 'long', year: 'numeric',
    });
  }

  get lastLoginDisplay(): string {
    if (!this.user?.lastLogin) return 'First login';
    const d = new Date(this.user.lastLogin);
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
