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
import { MatStepperModule } from '@angular/material/stepper';
import { RecordsListComponent } from './list/records-list.component';
import { RecordDetailComponent } from './detail/record-detail.component';
import { NewRequestComponent } from './new-request/new-request.component';

const routes: Routes = [
  { path: '', component: RecordsListComponent },
  { path: 'new', component: NewRequestComponent },
  { path: ':id', component: RecordDetailComponent },
];

@NgModule({
  declarations: [RecordsListComponent, RecordDetailComponent, NewRequestComponent],
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterModule.forChild(routes),
    MatTableModule, MatSortModule, MatPaginatorModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatChipsModule, MatTooltipModule,
    MatCardModule, MatDividerModule, MatProgressBarModule, MatBadgeModule, MatDialogModule,
    MatSnackBarModule, MatTabsModule, MatStepperModule,
  ],
})
export class RecordsModule {}
