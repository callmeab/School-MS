import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { AttendanceService } from '../../features/attendance/attendance.service';

/**
 * Prevents accidental loss of marked attendance by alerting user before route navigation.
 */
export const attendanceUnsavedChangesGuard: CanDeactivateFn<unknown> = () => {
  const attendanceService = inject(AttendanceService);
  if (
    attendanceService.hasUnsavedStudentChanges() ||
    attendanceService.hasUnsavedTeacherChanges()
  ) {
    return window.confirm(
      'You have unsaved attendance changes. Are you sure you want to leave without saving?'
    );
  }
  return true;
};
