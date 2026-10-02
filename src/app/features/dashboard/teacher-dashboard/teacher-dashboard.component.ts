import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DashboardService } from '../dashboard.service';
import { formatDateDisplay } from '../../../core/utils/date';
import { EmptyStateComponent, LoadingSpinnerComponent } from '../../../shared/components';

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, EmptyStateComponent, LoadingSpinnerComponent],
  templateUrl: './teacher-dashboard.component.html',
  styleUrl: './teacher-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherDashboardComponent implements OnInit {
  readonly dashboardService = inject(DashboardService);

  readonly myClasses = this.dashboardService.myClasses;
  readonly loadingMyClasses = this.dashboardService.loadingMyClasses;
  readonly errorMyClasses = this.dashboardService.errorMyClasses;

  readonly todayAttendance = this.dashboardService.todayAttendance;
  readonly loadingTodayAttendance = this.dashboardService.loadingTodayAttendance;
  readonly errorTodayAttendance = this.dashboardService.errorTodayAttendance;

  readonly upcomingExams = this.dashboardService.upcomingExams;
  readonly loadingUpcomingExams = this.dashboardService.loadingUpcomingExams;
  readonly errorUpcomingExams = this.dashboardService.errorUpcomingExams;

  async ngOnInit(): Promise<void> {
    await this.dashboardService.initTeacherDashboard();
  }

  formatDate(dateStr: string): string {
    return formatDateDisplay(dateStr);
  }

  retryMyClasses(): void {
    this.dashboardService.loadTeacherClasses();
  }

  retryAttendance(): void {
    this.dashboardService.loadTodayAttendanceSummary();
  }

  retryExams(): void {
    this.dashboardService.loadUpcomingExams();
  }
}
