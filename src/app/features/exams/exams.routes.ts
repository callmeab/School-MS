import { Routes } from '@angular/router';

/**
 * Examinations & Schedules routing.
 *
 * NOTE: Client-side guards are UX only; real security is enforced by PostgreSQL RLS.
 */
export const EXAMS_ROUTES: Routes = [
  {
    path: '',
    // Guards are UX only; real security is RLS
    loadComponent: () =>
      import('./exams.component').then((m) => m.ExamsComponent),
  },
  {
    path: ':id',
    // Guards are UX only; real security is RLS
    loadComponent: () =>
      import('./exam-detail/exam-detail.component').then(
        (m) => m.ExamDetailComponent
      ),
  },
];
