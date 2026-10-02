import { UserRole } from '../models/user.model';

export interface NavItem {
  label: string;
  route: string;
  icon: string;
  allowedRoles: UserRole[];
}

/**
 * Central navigation configuration.
 *
 * NOTE: Client-side menu filtering and guards are UX only;
 * real database security and privacy boundaries are strictly enforced by Supabase Row Level Security (RLS).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  // --- Admin Menu Items ---
  {
    label: 'Dashboard',
    route: '/dashboard',
    icon: 'dashboard',
    allowedRoles: ['admin'],
  },
  {
    label: 'Classes',
    route: '/classes',
    icon: 'classes',
    allowedRoles: ['admin'],
  },
  {
    label: 'Subjects',
    route: '/subjects',
    icon: 'subjects',
    allowedRoles: ['admin'],
  },
  {
    label: 'Students',
    route: '/students',
    icon: 'students',
    allowedRoles: ['admin'],
  },
  {
    label: 'Teachers',
    route: '/teachers',
    icon: 'teachers',
    allowedRoles: ['admin'],
  },
  {
    label: 'Attendance',
    route: '/attendance',
    icon: 'attendance',
    allowedRoles: ['admin'],
  },
  {
    label: 'Teacher Attendance',
    route: '/attendance/teachers',
    icon: 'attendance',
    allowedRoles: ['admin'],
  },
  {
    label: 'Exams',
    route: '/exams',
    icon: 'exams',
    allowedRoles: ['admin'],
  },
  {
    label: 'Reports',
    route: '/reports',
    icon: 'reports',
    allowedRoles: ['admin'],
  },

  // --- Teacher Menu Items (Read-only classes/students, daily attendance, personal attendance, reports) ---
  {
    label: 'Dashboard',
    route: '/dashboard',
    icon: 'dashboard',
    allowedRoles: ['teacher'],
  },
  {
    label: 'Classes',
    route: '/classes',
    icon: 'classes',
    allowedRoles: ['teacher'],
  },
  {
    label: 'Students',
    route: '/students',
    icon: 'students',
    allowedRoles: ['teacher'],
  },
  {
    label: 'Attendance',
    route: '/attendance',
    icon: 'attendance',
    allowedRoles: ['teacher'],
  },
  {
    label: 'My Attendance',
    route: '/attendance/my-attendance',
    icon: 'attendance',
    allowedRoles: ['teacher'],
  },
  {
    label: 'Exams (read only)',
    route: '/exams',
    icon: 'exams',
    allowedRoles: ['teacher'],
  },
  {
    label: 'Reports',
    route: '/reports',
    icon: 'reports',
    allowedRoles: ['teacher'],
  },
] as const;
