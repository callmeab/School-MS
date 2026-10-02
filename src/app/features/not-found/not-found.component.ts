import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { getHomeRoute } from '../../core/models/user.model';

@Component({
  selector: 'app-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  goHome(): void {
    if (this.authService.isAuthenticated()) {
      const destination = getHomeRoute(this.authService.role());
      this.router.navigate([destination]);
    } else {
      this.router.navigate(['/login']);
    }
  }
}
