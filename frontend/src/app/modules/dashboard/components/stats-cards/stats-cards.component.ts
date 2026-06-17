// MPloyChek — Stats Cards Component
import { Component, Input } from '@angular/core';
import { DashboardStats } from '../../../../core/models';

@Component({
  selector: 'app-stats-cards',
  templateUrl: './stats-cards.component.html',
  styleUrls: ['./stats-cards.component.scss'],
})
export class StatsCardsComponent {
  @Input() stats: DashboardStats | null = null;
  @Input() isLoading = false;

  get cards() {
    if (!this.stats) return [];
    return [
      {
        label: 'Total Users',
        value: this.stats.totalUsers,
        sub: `${this.stats.activeUsers} active`,
        icon: '◉',
        color: 'teal',
      },
      {
        label: 'Admin Users',
        value: this.stats.adminUsers,
        sub: `${this.stats.totalUsers - this.stats.adminUsers} general`,
        icon: '◈',
        color: 'amber',
      },
      {
        label: 'Total Records',
        value: this.stats.totalRecords,
        sub: `across all users`,
        icon: '⬡',
        color: 'blue',
      },
      {
        label: 'Completed',
        value: this.stats.completedRecords,
        sub: `${this.stats.failedRecords} failed`,
        icon: '✓',
        color: 'green',
      },
      {
        label: 'In Progress',
        value: this.stats.inProgressRecords,
        sub: `${this.stats.pendingRecords} pending`,
        icon: '●',
        color: 'orange',
      },
    ];
  }
}
