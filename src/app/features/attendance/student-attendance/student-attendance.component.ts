import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService } from '../attendance.service';
import { AuthService } from '../../../core/services/auth.service';
import { AttendanceStatus } from '../../../core/models';
import { formatDateDisplay } from '../../../core/utils/date';
import {
  EmptyStateComponent,
  LoadingSpinnerComponent,
} from '../../../shared/components';

@Component({
  selector: 'app-student-attendance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EmptyStateComponent,
    LoadingSpinnerComponent,
  ],
  templateUrl: './student-attendance.component.html',
  styleUrl: './student-attendance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentAttendanceComponent implements OnInit {
  readonly attendanceService = inject(AttendanceService);
  readonly authService = inject(AuthService);

  readonly classes = this.attendanceService.classes;
  readonly loadingClasses = this.attendanceService.loadingClasses;
  readonly teacherHasNoClasses = this.attendanceService.teacherHasNoClasses;

  readonly selectedClassId = this.attendanceService.selectedClassId;
  readonly selectedDate = this.attendanceService.selectedDate;
  readonly students = this.attendanceService.students;
  readonly loadingStudents = this.attendanceService.loadingStudents;
  readonly saving = this.attendanceService.savingStudentAttendance;
  readonly isExistingAttendance = this.attendanceService.isExistingStudentAttendance;
  readonly hasUnsavedChanges = this.attendanceService.hasUnsavedStudentChanges;
  readonly summary = this.attendanceService.studentSummary;

  readonly minDate = this.attendanceService.studentMinDate;
  readonly maxDate = this.attendanceService.studentMaxDate;

  readonly formattedSelectedDate = computed(() => {
    return formatDateDisplay(this.selectedDate());
  });

  async ngOnInit(): Promise<void> {
    await this.attendanceService.loadClassesForUser();
    const currentClassId = this.selectedClassId();
    const currentDate = this.selectedDate();
    if (currentClassId) {
      await this.attendanceService.loadStudentAttendance(currentClassId, currentDate);
    }
  }

  async onClassSelect(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const newClassId = select.value;

    if (this.hasUnsavedChanges()) {
      const confirmDiscard = window.confirm(
        'You have unsaved attendance changes. Discard them and switch class?'
      );
      if (!confirmDiscard) {
        // Revert select dropdown to previous selection
        select.value = this.selectedClassId();
        return;
      }
    }

    this.attendanceService.setSelectedClassId(newClassId);
    if (newClassId) {
      await this.attendanceService.loadStudentAttendance(newClassId, this.selectedDate());
    }
  }

  async onDateSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const newDate = input.value;

    if (!newDate) return;

    if (this.hasUnsavedChanges()) {
      const confirmDiscard = window.confirm(
        'You have unsaved attendance changes. Discard them and switch date?'
      );
      if (!confirmDiscard) {
        // Revert date picker to previous selection
        input.value = this.selectedDate();
        return;
      }
    }

    this.attendanceService.setSelectedDate(newDate);
    const classId = this.selectedClassId();
    if (classId) {
      await this.attendanceService.loadStudentAttendance(classId, newDate);
    }
  }

  setStatus(studentId: string, status: AttendanceStatus): void {
    if (this.saving()) return;
    this.attendanceService.updateStudentStatus(studentId, status);
  }

  markAllPresent(): void {
    if (this.saving() || this.students().length === 0) return;
    this.attendanceService.markAllStudentsPresent();
  }

  async save(): Promise<void> {
    if (this.saving() || this.students().length === 0) return;
    await this.attendanceService.saveStudentAttendance();
  }
}
