// ============================================================
// MPloyChek — Reusable Confirm Dialog
// Styled replacement for window.confirm(). Open via MatDialog and
// it resolves to true (confirmed) or false/undefined (cancelled).
// ============================================================
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  icon?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  template: `
    <div class="cd">
      <div class="cd-icon" [class.danger]="data.danger">
        <mat-icon>{{ data.icon || (data.danger ? 'warning' : 'help_outline') }}</mat-icon>
      </div>
      <h2 class="cd-title">{{ data.title }}</h2>
      <p class="cd-msg">{{ data.message }}</p>
      <div class="cd-actions">
        <button type="button" class="cd-btn cd-cancel" (click)="close(false)">{{ data.cancelText || 'Cancel' }}</button>
        <button type="button" class="cd-btn" [class.cd-danger]="data.danger" [class.cd-primary]="!data.danger" (click)="close(true)">
          {{ data.confirmText || 'Confirm' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .cd { padding: 28px 26px 22px; text-align: center; max-width: 380px; }
    .cd-icon {
      width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 16px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(45,212,191,0.12); color: var(--accent-teal);
      mat-icon { font-size: 28px; width: 28px; height: 28px; }
      &.danger { background: rgba(239,68,68,0.12); color: var(--status-error); }
    }
    .cd-title { font-size: 18px; font-weight: 700; color: var(--t-1); margin: 0 0 8px; }
    .cd-msg { font-size: 13.5px; color: var(--t-3); line-height: 1.6; margin: 0 0 24px; }
    .cd-actions { display: flex; gap: 10px; justify-content: center; }
    .cd-btn {
      flex: 1; padding: 11px 18px; border-radius: 10px; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit; transition: all 0.18s; border: 1px solid transparent;
    }
    .cd-cancel { background: var(--fill-1); border-color: var(--line-1); color: var(--t-2);
      &:hover { background: var(--fill-2); } }
    .cd-primary { background: linear-gradient(135deg, var(--accent-teal), #0ea5e9); color: #00131a;
      &:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(45,212,191,0.35); } }
    .cd-danger { background: var(--status-error); color: #fff;
      &:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(239,68,68,0.35); } }
  `],
})
export class ConfirmDialogComponent {
  constructor(
    public ref: MatDialogRef<ConfirmDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData,
  ) {}
  close(result: boolean) { this.ref.close(result); }
}
