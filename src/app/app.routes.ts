import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  // Default redirect
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },

  // Unauthenticated / Standalone Routes (OUTSIDE the Shell)
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/auth.component').then((m) => m.AuthComponent),
  },
  {
    path: 'auth',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./features/unauthorized/unauthorized.component').then(
        (m) => m.UnauthorizedComponent
      ),
  },

  // Authenticated Shell Layout (authGuard enforces session)
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'dashboard',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'teacher'] },
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then(
            (m) => m.DASHBOARD_ROUTES
          ),
      },
      {
        path: 'classes',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'teacher'] },
        loadChildren: () =>
          import('./features/classes/classes.routes').then(
            (m) => m.CLASSES_ROUTES
          ),
      },
      {
        path: 'subjects',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadChildren: () =>
          import('./features/subjects/subjects.routes').then(
            (m) => m.SUBJECTS_ROUTES
          ),
      },
      {
        path: 'students',
        canActivate: [roleGuard],
        // Guards are UX only; real security is RLS + the Edge Function admin check
        data: { roles: ['admin', 'teacher'] },
        loadChildren: () =>
          import('./features/students/students.routes').then(
            (m) => m.STUDENTS_ROUTES
          ),
      },
      {
        path: 'teachers',
        canActivate: [roleGuard],
        // Guards are UX only; real security is RLS + the Edge Function admin check
        data: { roles: ['admin'] },
        loadChildren: () =>
          import('./features/teachers/teachers.routes').then(
            (m) => m.TEACHERS_ROUTES
          ),
      },
      {
        path: 'attendance',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'teacher'] },
        loadChildren: () =>
          import('./features/attendance/attendance.routes').then(
            (m) => m.ATTENDANCE_ROUTES
          ),
      },
      {
        path: 'exams',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'teacher'] },
        loadChildren: () =>
          import('./features/exams/exams.routes').then((m) => m.EXAMS_ROUTES),
      },
      {
        path: 'reports',
        canActivate: [roleGuard],
        // Guards are UX only; real security is RLS
        data: { roles: ['admin', 'teacher'] },
        loadChildren: () =>
          import('./features/reports/reports.routes').then(
            (m) => m.REPORTS_ROUTES
          ),
      },
    ],
  },

  // Wildcard 404 Route (OUTSIDE the Shell)
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then(
        (m) => m.NotFoundComponent
      ),
  },
];
