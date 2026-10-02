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
import { AttendanceStatus } from '../../../core/models';
import { formatDateDisplay, getTodayDateString } from '../../../core/utils/date';
import {
  EmptyStateComponent,
  LoadingSpinnerComponent,
} from '../../../shared/components';

@Component({
  selector: 'app-teacher-attendance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EmptyStateComponent,
    LoadingSpinnerComponent,
  ],
  templateUrl: './teacher-attendance.component.html',
  styleUrl: './teacher-attendance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherAttendanceComponent implements OnInit {
  readonly attendanceService = inject(AttendanceService);

  readonly teachers = this.attendanceService.teachers;
  readonly loading = this.attendanceService.loadingTeachers;
  readonly saving = this.attendanceService.savingTeacherAttendance;
  readonly date = this.attendanceService.teacherDate;
  readonly isExisting = this.attendanceService.isExistingTeacherAttendance;
  readonly hasUnsavedChanges = this.attendanceService.hasUnsavedTeacherChanges;
  readonly summary = this.attendanceService.teacherSummary;

  readonly maxDate = getTodayDateString();

  readonly formattedDate = computed(() => {
    return formatDateDisplay(this.date());
  });

  async ngOnInit(): Promise<void> {
    await this.attendanceService.loadTeacherAttendance(this.date());
  }

  async onDateSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const newDate = input.value;

    if (!newDate) return;

    if (this.hasUnsavedChanges()) {
      const confirmDiscard = window.confirm(
        'You have unsaved teacher attendance changes. Discard them and switch date?'
      );
      if (!confirmDiscard) {
        input.value = this.date();
        return;
      }
    }

    this.attendanceService.setTeacherDate(newDate);
    await this.attendanceService.loadTeacherAttendance(newDate);
  }

  setStatus(teacherId: string, status: AttendanceStatus): void {
    if (this.saving()) return;
    this.attendanceService.updateTeacherStatus(teacherId, status);
  }

  markAllPresent(): void {
    if (this.saving() || this.teachers().length === 0) return;
    this.attendanceService.markAllTeachersPresent();
  }

  async save(): Promise<void> {
    if (this.saving() || this.teachers().length === 0) return;
    await this.attendanceService.saveTeacherAttendance();
  }
}
