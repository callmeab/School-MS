import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';
import { attendanceUnsavedChangesGuard } from '../../core/guards/attendance-unsaved.guard';

/**
 * Attendance routing configuration.
 *
 * NOTE: Client-side guards are UX only; real security is enforced by PostgreSQL RLS.
 */
export const ATTENDANCE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./attendance.component').then((m) => m.AttendanceComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        canDeactivate: [attendanceUnsavedChangesGuard],
        loadComponent: () =>
          import('./student-attendance/student-attendance.component').then(
            (m) => m.StudentAttendanceComponent
          ),
      },
      {
        path: 'teachers',
        canActivate: [roleGuard],
        canDeactivate: [attendanceUnsavedChangesGuard],
        // Guards are UX only; real security is RLS
        data: { roles: ['admin'] },
        loadComponent: () =>
          import('./teacher-attendance/teacher-attendance.component').then(
            (m) => m.TeacherAttendanceComponent
          ),
      },
      {
        path: 'my-attendance',
        canActivate: [roleGuard],
        // Guards are UX only; real security is RLS
        data: { roles: ['teacher'] },
        loadComponent: () =>
          import('./my-attendance/my-attendance.component').then(
            (m) => m.MyAttendanceComponent
          ),
      },
    ],
  },
];
