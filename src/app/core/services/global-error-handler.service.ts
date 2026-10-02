import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly toastService = inject(ToastService);

  handleError(error: unknown): void {
    let errorMessage = 'An unexpected error occurred. Please try again.';

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    // Display user-friendly notification
    this.toastService.showError(errorMessage);

    // Note: Do not console.log sensitive data or user tokens in production.
  }
}
