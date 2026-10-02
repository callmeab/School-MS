import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportsService } from './reports.service';
import { AuthService } from '../../core/services/auth.service';
import { SCHOOL_CONFIG } from '../../core/config/school.config';
import {
  formatDateDisplay,
  formatMonthDisplay,
  getMonthDateString,
} from '../../core/utils/date';
import { downloadCsvFile } from '../../core/utils/csv';
import {
  EmptyStateComponent,
  LoadingSpinnerComponent,
  PageHeaderComponent,
} from '../../shared/components';

type ReportTab = 'class' | 'student' | 'teacher';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent implements OnInit {
  readonly reportsService = inject(ReportsService);
  readonly authService = inject(AuthService);

  readonly schoolName = SCHOOL_CONFIG.name;
  readonly activeTab = signal<ReportTab>('class');
  readonly currentMonth = getMonthDateString();

  // Tab A: Class Monthly Attendance
  readonly classes = this.reportsService.classes;
  readonly loadingClasses = this.reportsService.loadingClasses;
  readonly selectedClassId = this.reportsService.selectedClassId;
  readonly selectedClassMonth = this.reportsService.selectedClassMonth;
  readonly classRows = this.reportsService.classReportRows;
  readonly classTotals = this.reportsService.classReportTotals;
  readonly loadingClass = this.reportsService.loadingClassReport;

  readonly selectedClassMeta = computed(() => {
    const id = this.selectedClassId();
    return this.classes().find((c) => c.id === id) || null;
  });

  readonly formattedClassMonth = computed(() => {
    return formatMonthDisplay(this.selectedClassMonth());
  });

  // Tab B: Student History
  readonly selectedStudentClassId = this.reportsService.selectedStudentClassId;
  readonly classStudents = this.reportsService.classStudents;
  readonly selectedStudentId = this.reportsService.selectedStudentId;
  readonly selectedStudentMonth = this.reportsService.selectedStudentMonth;
  readonly studentDays = this.reportsService.studentHistoryDays;
  readonly studentSummary = this.reportsService.studentHistorySummary;
  readonly loadingStudent = this.reportsService.loadingStudentHistory;

  readonly selectedStudentMeta = computed(() => {
    const id = this.selectedStudentId();
    return this.classStudents().find((s) => s.id === id) || null;
  });

  readonly formattedStudentMonth = computed(() => {
    return formatMonthDisplay(this.selectedStudentMonth());
  });

  readonly studentPercentage = computed(() => {
    const s = this.studentSummary();
    if (!s.total) return 0;
    return Math.round(((s.present + s.late) / s.total) * 1000) / 10;
  });

  // Tab C: Teacher Monthly Attendance
  readonly selectedTeacherMonth = this.reportsService.selectedTeacherMonth;
  readonly teacherRows = this.reportsService.teacherReportRows;
  readonly teacherTotals = this.reportsService.teacherReportTotals;
  readonly loadingTeacher = this.reportsService.loadingTeacherReport;

  readonly formattedTeacherMonth = computed(() => {
    return formatMonthDisplay(this.selectedTeacherMonth());
  });

  async ngOnInit(): Promise<void> {
    await this.reportsService.loadClassesForUser();

    // Initialize default class report
    const initialClassId = this.selectedClassId();
    if (initialClassId) {
      await Promise.all([
        this.reportsService.loadClassMonthlyAttendance(
          initialClassId,
          this.selectedClassMonth()
        ),
        this.reportsService.loadStudentsForClass(initialClassId),
      ]);
    }
  }

  setTab(tab: ReportTab): void {
    this.activeTab.set(tab);

    if (tab === 'class') {
      const classId = this.selectedClassId();
      if (classId) {
        this.reportsService.loadClassMonthlyAttendance(
          classId,
          this.selectedClassMonth()
        );
      }
    } else if (tab === 'student') {
      const studentId = this.selectedStudentId();
      if (studentId) {
        this.reportsService.loadStudentHistory(
          studentId,
          this.selectedStudentMonth()
        );
      }
    } else if (tab === 'teacher' && this.authService.isAdmin()) {
      this.reportsService.loadTeacherMonthlyAttendance(
        this.selectedTeacherMonth()
      );
    }
  }

  // --- Tab A Handlers ---
  async onClassChange(classId: string): Promise<void> {
    this.reportsService.selectedClassId.set(classId);
    await this.reportsService.loadClassMonthlyAttendance(
      classId,
      this.selectedClassMonth()
    );
  }

  async onClassMonthChange(month: string): Promise<void> {
    if (!month) return;
    this.reportsService.selectedClassMonth.set(month);
    const classId = this.selectedClassId();
    if (classId) {
      await this.reportsService.loadClassMonthlyAttendance(classId, month);
    }
  }

  refreshClassReport(): void {
    const classId = this.selectedClassId();
    if (classId) {
      this.reportsService.loadClassMonthlyAttendance(
        classId,
        this.selectedClassMonth(),
        true
      );
    }
  }

  exportClassCsv(): void {
    const cls = this.selectedClassMeta();
    const month = this.selectedClassMonth();
    const rows = this.classRows();
    const totals = this.classTotals();

    const headers = [
      'Roll No',
      'Student Name',
      'Present',
      'Absent',
      'Late',
      'Leave',
      'Total Days',
      'Attendance %',
      'Status',
    ];

    const dataRows = rows.map((r) => [
      r.roll_no,
      r.full_name,
      r.present,
      r.absent,
      r.late,
      r.on_leave,
      r.total_days,
      r.has_records ? `${r.percentage}%` : 'No records',
      r.is_low ? 'Low' : (r.has_records ? 'Normal' : 'No records'),
    ]);

    // Totals line
    dataRows.push([
      '',
      'TOTALS',
      totals.present,
      totals.absent,
      totals.late,
      totals.on_leave,
      totals.total_days,
      `${totals.percentage}%`,
      '',
    ]);

    const classNameClean = cls ? `${cls.name}-${cls.section}`.replace(/\s+/g, '-') : 'Class';
    downloadCsvFile(`attendance-${classNameClean}-${month}.csv`, headers, dataRows);
  }

  // --- Tab B Handlers ---
  async onStudentClassChange(classId: string): Promise<void> {
    this.reportsService.selectedStudentClassId.set(classId);
    await this.reportsService.loadStudentsForClass(classId);
    const studentId = this.selectedStudentId();
    if (studentId) {
      await this.reportsService.loadStudentHistory(
        studentId,
        this.selectedStudentMonth()
      );
    }
  }

  async onStudentSelect(studentId: string): Promise<void> {
    this.reportsService.selectedStudentId.set(studentId);
    if (studentId) {
      await this.reportsService.loadStudentHistory(
        studentId,
        this.selectedStudentMonth()
      );
    }
  }

  async onStudentMonthChange(month: string): Promise<void> {
    if (!month) return;
    this.reportsService.selectedStudentMonth.set(month);
    const studentId = this.selectedStudentId();
    if (studentId) {
      await this.reportsService.loadStudentHistory(studentId, month);
    }
  }

  refreshStudentHistory(): void {
    const studentId = this.selectedStudentId();
    if (studentId) {
      this.reportsService.loadStudentHistory(
        studentId,
        this.selectedStudentMonth(),
        true
      );
    }
  }

  exportStudentHistoryCsv(): void {
    const student = this.selectedStudentMeta();
    const month = this.selectedStudentMonth();
    const days = this.studentDays();
    const summary = this.studentSummary();

    const headers = ['Date', 'Day', 'Attendance Status'];
    const dataRows: (string | number)[][] = days.map((d) => [
      d.date,
      formatDateDisplay(d.date),
      d.status.toUpperCase(),
    ]);

    // Summary lines
    dataRows.push(['', '', '']);
    dataRows.push(['SUMMARY', 'Total Days', summary.total]);
    dataRows.push(['', 'Present', summary.present]);
    dataRows.push(['', 'Absent', summary.absent]);
    dataRows.push(['', 'Late', summary.late]);
    dataRows.push(['', 'Leave', summary.leave]);
    dataRows.push(['', 'Percentage', `${this.studentPercentage()}%`]);

    const studentNameClean = student
      ? student.full_name.replace(/\s+/g, '-')
      : 'Student';
    downloadCsvFile(
      `student-history-${studentNameClean}-${month}.csv`,
      headers,
      dataRows
    );
  }

  // --- Tab C Handlers ---
  async onTeacherMonthChange(month: string): Promise<void> {
    if (!month) return;
    this.reportsService.selectedTeacherMonth.set(month);
    await this.reportsService.loadTeacherMonthlyAttendance(month);
  }

  refreshTeacherReport(): void {
    this.reportsService.loadTeacherMonthlyAttendance(
      this.selectedTeacherMonth(),
      true
    );
  }

  exportTeacherCsv(): void {
    const month = this.selectedTeacherMonth();
    const rows = this.teacherRows();
    const totals = this.teacherTotals();

    const headers = [
      'Emp Code',
      'Teacher Name',
      'Present',
      'Absent',
      'Late',
      'Leave',
      'Total Days',
      'Attendance %',
      'Status',
    ];

    const dataRows = rows.map((r) => [
      r.employee_code,
      r.full_name,
      r.present,
      r.absent,
      r.late,
      r.on_leave,
      r.total_days,
      r.has_records ? `${r.percentage}%` : 'No records',
      r.is_low ? 'Low' : (r.has_records ? 'Normal' : 'No records'),
    ]);

    dataRows.push([
      '',
      'TOTALS',
      totals.present,
      totals.absent,
      totals.late,
      totals.on_leave,
      totals.total_days,
      `${totals.percentage}%`,
      '',
    ]);

    downloadCsvFile(`teacher-attendance-${month}.csv`, headers, dataRows);
  }

  printReport(): void {
    window.print();
  }

  formatDate(dateStr: string): string {
    return formatDateDisplay(dateStr);
  }
}
