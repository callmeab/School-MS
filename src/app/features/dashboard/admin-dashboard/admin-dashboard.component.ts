import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DashboardService } from '../dashboard.service';
import { formatDateDisplay } from '../../../core/utils/date';
import { LoadingSpinnerComponent } from '../../../shared/components';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, LoadingSpinnerComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardComponent implements OnInit {
  readonly dashboardService = inject(DashboardService);

  readonly stats = this.dashboardService.stats;
  readonly loadingStats = this.dashboardService.loadingStats;
  readonly errorStats = this.dashboardService.errorStats;

  readonly todayAttendance = this.dashboardService.todayAttendance;
  readonly loadingTodayAttendance = this.dashboardService.loadingTodayAttendance;
  readonly errorTodayAttendance = this.dashboardService.errorTodayAttendance;

  readonly unmarkedClasses = this.dashboardService.unmarkedClasses;
  readonly loadingUnmarkedClasses = this.dashboardService.loadingUnmarkedClasses;
  readonly errorUnmarkedClasses = this.dashboardService.errorUnmarkedClasses;

  readonly teacherAttendanceMarkedToday = this.dashboardService.teacherAttendanceMarkedToday;
  readonly teacherAttendanceMarkedCount = this.dashboardService.teacherAttendanceMarkedCount;
  readonly loadingTeacherAttendanceToday = this.dashboardService.loadingTeacherAttendanceToday;

  readonly upcomingExams = this.dashboardService.upcomingExams;
  readonly loadingUpcomingExams = this.dashboardService.loadingUpcomingExams;
  readonly errorUpcomingExams = this.dashboardService.errorUpcomingExams;

  // Percentage segments for CSS progress bar
  readonly attendancePercentages = computed(() => {
    const s = this.todayAttendance();
    if (!s.total) return { present: 0, absent: 0, late: 0, leave: 0 };
    return {
      present: Math.round((s.present / s.total) * 100),
      absent: Math.round((s.absent / s.total) * 100),
      late: Math.round((s.late / s.total) * 100),
      leave: Math.round((s.on_leave / s.total) * 100),
    };
  });

  async ngOnInit(): Promise<void> {
    await this.dashboardService.initAdminDashboard();
  }

  formatDate(dateStr: string): string {
    return formatDateDisplay(dateStr);
  }

  retryStats(): void {
    this.dashboardService.loadAdminStats();
  }

  retryAttendanceToday(): void {
    this.dashboardService.loadTodayAttendanceSummary();
  }

  retryUnmarkedClasses(): void {
    this.dashboardService.loadUnmarkedClassesToday();
  }

  retryExams(): void {
    this.dashboardService.loadUpcomingExams();
  }
}
