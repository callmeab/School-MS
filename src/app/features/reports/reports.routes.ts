import { Routes } from '@angular/router';

/**
 * Attendance & Analytics Reports routing.
 *
 * NOTE: Client-side guards are UX only; real security is enforced by PostgreSQL RLS.
 */
export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    // Guards are UX only; real security is RLS
    loadComponent: () =>
      import('./reports.component').then((m) => m.ReportsComponent),
  },
];
