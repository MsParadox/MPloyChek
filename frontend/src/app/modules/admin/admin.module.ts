import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatBadgeModule } from '@angular/material/badge';
import { AdminComponent } from './admin.component';
import { UserManagementComponent } from './components/user-management/user-management.component';
import { UserDialogComponent } from './components/user-dialog/user-dialog.component';
import { AuditLogComponent } from './components/audit-log/audit-log.component';

const routes: Routes = [
  { path: '', component: AdminComponent, children: [
    { path: '', redirectTo: 'users', pathMatch: 'full' },
    { path: 'users', component: UserManagementComponent },
    { path: 'audit', component: AuditLogComponent },
  ]},
];

@NgModule({
  declarations: [AdminComponent, UserManagementComponent, UserDialogComponent, AuditLogComponent],
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterModule.forChild(routes),
    MatTableModule, MatSortModule, MatPaginatorModule, MatButtonModule, MatIconModule,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatChipsModule,
    MatTooltipModule, MatSnackBarModule, MatCardModule, MatDividerModule,
    MatProgressBarModule, MatTabsModule, MatBadgeModule,
  ],
})
export class AdminModule {}
