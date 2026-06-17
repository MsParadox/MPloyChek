import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard, AdminGuard, LoginGuard } from './core/guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'auth', canActivate: [LoginGuard], loadChildren: () => import('./modules/auth/auth.module').then(m => m.AuthModule) },
  { path: 'dashboard', canActivate: [AuthGuard], loadChildren: () => import('./modules/dashboard/dashboard.module').then(m => m.DashboardModule) },
  { path: 'records',   canActivate: [AuthGuard], loadChildren: () => import('./modules/records/records.module').then(m => m.RecordsModule) },
  { path: 'candidates',canActivate: [AuthGuard], loadChildren: () => import('./modules/candidates/candidates.module').then(m => m.CandidatesModule) },
  { path: 'reports',   canActivate: [AuthGuard], loadChildren: () => import('./modules/reports/reports.module').then(m => m.ReportsModule) },
  { path: 'profile',   canActivate: [AuthGuard], loadChildren: () => import('./modules/profile/profile.module').then(m => m.ProfileModule) },
  { path: 'notifications', canActivate: [AuthGuard], loadChildren: () => import('./modules/notifications/notifications.module').then(m => m.NotificationsModule) },
  { path: 'admin',     canActivate: [AdminGuard], loadChildren: () => import('./modules/admin/admin.module').then(m => m.AdminModule) },
  { path: '**', redirectTo: 'dashboard' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
