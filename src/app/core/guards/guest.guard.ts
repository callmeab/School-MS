import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { getHomeRoute } from '../models/user.model';

/**
 * Prevents authenticated users from navigating to the login screen.
 * Redirects them to their respective role landing page.
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    const homeRoute = getHomeRoute(authService.role());
    return router.createUrlTree([homeRoute]);
  }

  return true;
};
