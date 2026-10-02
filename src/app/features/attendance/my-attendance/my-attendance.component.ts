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
import { formatDateDisplay, formatMonthDisplay, getMonthDateString } from '../../../core/utils/date';
import {
  EmptyStateComponent,
  LoadingSpinnerComponent,
} from '../../../shared/components';

@Component({
  selector: 'app-my-attendance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EmptyStateComponent,
    LoadingSpinnerComponent,
  ],
  templateUrl: './my-attendance.component.html',
  styleUrl: './my-attendance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyAttendanceComponent implements OnInit {
  readonly attendanceService = inject(AttendanceService);

  readonly month = this.attendanceService.myMonth;
  readonly records = this.attendanceService.myAttendance;
  readonly loading = this.attendanceService.loadingMyAttendance;
  readonly summary = this.attendanceService.mySummary;

  readonly maxMonth = getMonthDateString();

  readonly formattedMonth = computed(() => {
    return formatMonthDisplay(this.month());
  });

  async ngOnInit(): Promise<void> {
    await this.attendanceService.loadMyAttendance(this.month());
  }

  async onMonthSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const newMonth = input.value;
    if (!newMonth) return;

    this.attendanceService.setMyMonth(newMonth);
    await this.attendanceService.loadMyAttendance(newMonth);
  }

  formatDate(dateStr: string): string {
    return formatDateDisplay(dateStr);
  }
}
