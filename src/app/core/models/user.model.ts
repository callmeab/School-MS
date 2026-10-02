export type UserRole = 'admin' | 'teacher';

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  is_active: boolean;
  created_at?: string;
}

/**
 * Returns the landing route for each role after successful login.
 */
export function getHomeRoute(role?: UserRole | null): string {
  switch (role) {
    case 'admin':
      return '/dashboard';
    case 'teacher':
      return '/attendance';
    default:
      return '/login';
  }
}
