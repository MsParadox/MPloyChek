import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { NotificationsComponent } from './notifications.component';

@NgModule({
  declarations: [NotificationsComponent],
  imports: [CommonModule, RouterModule.forChild([{path:'',component:NotificationsComponent}]), MatIconModule, MatButtonModule, MatDividerModule],
})
export class NotificationsModule {}
