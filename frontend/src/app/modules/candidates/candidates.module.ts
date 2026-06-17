import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { CandidatesListComponent } from './list/candidates-list.component';
import { CandidateDetailComponent } from './detail/candidate-detail.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

const routes: Routes = [
  { path: '', component: CandidatesListComponent },
  { path: ':id', component: CandidateDetailComponent },
];

@NgModule({
  declarations: [CandidatesListComponent, CandidateDetailComponent, ConfirmDialogComponent],
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterModule.forChild(routes),
    MatTableModule, MatSortModule, MatPaginatorModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatChipsModule, MatTooltipModule,
    MatCardModule, MatDividerModule, MatProgressBarModule, MatBadgeModule,
    MatDialogModule, MatSnackBarModule, MatTabsModule,
  ],
})
export class CandidatesModule {}
