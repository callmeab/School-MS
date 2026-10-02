import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

/**
 * Checks if current user's role is allowed on this route.
 *
 * NOTE: Client-side guards only prevent accidental UI navigation.
 * All API operations and table access are strictly governed by PostgreSQL RLS policies.
 */
export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const allowedRoles = route.data?.['roles'] as UserRole[] | undefined;
  const currentRole = authService.role();

  if (!allowedRoles || (currentRole && allowedRoles.includes(currentRole))) {
    return true;
  }

  return router.createUrlTree(['/unauthorized']);
};
