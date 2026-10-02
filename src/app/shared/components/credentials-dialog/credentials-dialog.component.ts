import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { DialogComponent } from '../dialog/dialog.component';
import { ToastService } from '../../../core/services/toast.service';

export interface UserCredentials {
  fullName: string;
  email: string;
  password: string;
  role: 'teacher';
}

@Component({
  selector: 'app-credentials-dialog',
  standalone: true,
  imports: [DialogComponent, UpperCasePipe],
  templateUrl: './credentials-dialog.component.html',
  styleUrl: './credentials-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredentialsDialogComponent {
  private readonly toastService = inject(ToastService);

  @Input({ required: true }) isOpen = false;
  @Input() credentials: UserCredentials | null = null;

  @Output() closed = new EventEmitter<void>();

  readonly showPassword = signal<boolean>(false);
  readonly copiedField = signal<string | null>(null);

  togglePasswordVisibility(): void {
    this.showPassword.update((val) => !val);
  }

  async copyToClipboard(text: string, fieldName: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copiedField.set(fieldName);
      this.toastService.showSuccess(`${fieldName} copied to clipboard!`);
      setTimeout(() => this.copiedField.set(null), 2500);
    } catch (_err) {
      this.toastService.showError('Failed to copy to clipboard.');
    }
  }

  async copyAll(): Promise<void> {
    if (!this.credentials) return;
    const text = `School Management System - Login Credentials\nRole: ${this.credentials.role.toUpperCase()}\nName: ${this.credentials.fullName}\nEmail: ${this.credentials.email}\nTemporary Password: ${this.credentials.password}\n\nPlease change your password upon initial login.`;
    await this.copyToClipboard(text, 'All credentials');
  }

  onClose(): void {
    this.showPassword.set(false);
    this.copiedField.set(null);
    this.closed.emit();
  }
}
