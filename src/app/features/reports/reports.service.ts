import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import {
  AttendanceStatus,
  AttendanceSummary,
  ClassAttendanceSummaryRow,
  ReportTotals,
  SchoolClass,
  Student,
  StudentAttendanceHistoryDay,
  TeacherAttendanceSummaryRow,
} from '../../core/models';
import { getFriendlyErrorMessage } from '../../core/utils/db-error';
import { getMonthDateString, getMonthStartAndEnd } from '../../core/utils/date';

interface RawClassSubjectRow {
  class_id: string;
  classes: {
    id: string;
    name: string;
    section: string;
    academic_year: string;
  } | null;
}

interface RawStudentSummaryRpc {
  student_id: string;
  present: number | string;
  absent: number | string;
  late: number | string;
  on_leave: number | string;
}

interface RawTeacherSummaryRpc {
  teacher_id: string;
  present: number | string;
  absent: number | string;
  late: number | string;
  on_leave: number | string;
}

interface RawTeacherWithProfile {
  id: string;
  employee_code: string;
  profiles: {
    full_name: string;
    is_active: boolean;
  } | null;
}

@Injectable({
  providedIn: 'root',
})
export class ReportsService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  // --- Classes for Reports ---
  readonly classes = signal<SchoolClass[]>([]);
  readonly loadingClasses = signal<boolean>(false);

  // --- Tab A: Class Monthly Attendance ---
  readonly selectedClassId = signal<string>('');
  readonly selectedClassMonth = signal<string>(getMonthDateString());
  readonly classReportRows = signal<ClassAttendanceSummaryRow[]>([]);
  readonly loadingClassReport = signal<boolean>(false);
  private lastClassKey = '';

  readonly classReportTotals = computed<ReportTotals>(() => {
    const list = this.classReportRows();
    let present = 0;
    let absent = 0;
    let late = 0;
    let on_leave = 0;
    let total_days = 0;

    for (const r of list) {
      present += r.present;
      absent += r.absent;
      late += r.late;
      on_leave += r.on_leave;
      total_days += r.total_days;
    }

    const percentage = total_days > 0 ? Math.round(((present + late) / total_days) * 1000) / 10 : 0;
    return { present, absent, late, on_leave, total_days, percentage };
  });

  // --- Tab B: Student History ---
  readonly selectedStudentClassId = signal<string>('');
  readonly classStudents = signal<Student[]>([]);
  readonly selectedStudentId = signal<string>('');
  readonly selectedStudentMonth = signal<string>(getMonthDateString());
  readonly studentHistoryDays = signal<StudentAttendanceHistoryDay[]>([]);
  readonly loadingStudentHistory = signal<boolean>(false);
  private lastStudentKey = '';

  readonly studentHistorySummary = computed<AttendanceSummary>(() => {
    const days = this.studentHistoryDays();
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;

    for (const d of days) {
      if (d.status === 'present') present++;
      else if (d.status === 'absent') absent++;
      else if (d.status === 'late') late++;
      else if (d.status === 'leave') leave++;
    }

    return {
      present,
      absent,
      late,
      leave,
      total: days.length,
    };
  });

  // --- Tab C: Teacher Monthly Attendance (Admin Only) ---
  readonly selectedTeacherMonth = signal<string>(getMonthDateString());
  readonly teacherReportRows = signal<TeacherAttendanceSummaryRow[]>([]);
  readonly loadingTeacherReport = signal<boolean>(false);
  private lastTeacherKey = '';

  readonly teacherReportTotals = computed<ReportTotals>(() => {
    const list = this.teacherReportRows();
    let present = 0;
    let absent = 0;
    let late = 0;
    let on_leave = 0;
    let total_days = 0;

    for (const r of list) {
      present += r.present;
      absent += r.absent;
      late += r.late;
      on_leave += r.on_leave;
      total_days += r.total_days;
    }

    const percentage = total_days > 0 ? Math.round(((present + late) / total_days) * 1000) / 10 : 0;
    return { present, absent, late, on_leave, total_days, percentage };
  });

  // =========================================================================
  // Classes Loader
  // =========================================================================

  async loadClassesForUser(): Promise<void> {
    this.loadingClasses.set(true);
    try {
      const user = this.auth.profile();
      if (!user) return;

      if (this.auth.isAdmin()) {
        const { data, error } = await this.supabase.client
          .from('classes')
          .select('id, name, section, academic_year')
          .order('name', { ascending: true })
          .order('section', { ascending: true });

        if (error) throw error;
        const list = (data as SchoolClass[]) ?? [];
        this.classes.set(list);

        if (list.length > 0 && !this.selectedClassId()) {
          this.selectedClassId.set(list[0].id);
          this.selectedStudentClassId.set(list[0].id);
        }
      } else if (this.auth.isTeacher()) {
        const { data: teacherRec } = await this.supabase.client
          .from('teachers')
          .select('id')
          .eq('profile_id', user.id)
          .single();

        if (!teacherRec) {
          this.classes.set([]);
          return;
        }

        const { data: csData, error: csErr } = await this.supabase.client
          .from('class_subjects')
          .select('class_id, classes!inner(id, name, section, academic_year)')
          .eq('teacher_id', teacherRec.id);

        if (csErr) throw csErr;

        const raw = (csData as unknown as RawClassSubjectRow[]) ?? [];
        const uniqueClassesMap = new Map<string, SchoolClass>();

        for (const item of raw) {
          if (item.classes && !uniqueClassesMap.has(item.classes.id)) {
            uniqueClassesMap.set(item.classes.id, item.classes as SchoolClass);
          }
        }

        const distinctList = Array.from(uniqueClassesMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name) || a.section.localeCompare(b.section)
        );

        this.classes.set(distinctList);

        if (distinctList.length > 0 && !this.selectedClassId()) {
          this.selectedClassId.set(distinctList[0].id);
          this.selectedStudentClassId.set(distinctList[0].id);
        }
      }
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to load classes.'));
    } finally {
      this.loadingClasses.set(false);
    }
  }

  // =========================================================================
  // Tab A: Class Monthly Attendance Report
  // =========================================================================

  async loadClassMonthlyAttendance(classId: string, monthStr: string, force = false): Promise<void> {
    if (!classId) return;

    const cacheKey = `${classId}_${monthStr}`;
    if (!force && this.lastClassKey === cacheKey && this.classReportRows().length > 0) {
      return;
    }

    this.loadingClassReport.set(true);
    try {
      // 1. Fetch active students in this class
      const { data: studentsData, error: studentsErr } = await this.supabase.client
        .from('students')
        .select('id, roll_no, full_name')
        .eq('class_id', classId)
        .eq('is_active', true)
        .order('roll_no', { ascending: true });

      if (studentsErr) throw studentsErr;

      const activeStudents = (studentsData as { id: string; roll_no: number; full_name: string }[]) ?? [];
      const summaryMap = new Map<
        string,
        { present: number; absent: number; late: number; on_leave: number }
      >();

      // 2. Call SQL function class_attendance_summary(p_class_id, p_month)
      const pMonth = `${monthStr}-01`;
      const { data: rpcData, error: rpcErr } = await this.supabase.client.rpc(
        'class_attendance_summary',
        { p_class_id: classId, p_month: pMonth }
      );

      if (!rpcErr && rpcData) {
        const rows = rpcData as RawStudentSummaryRpc[];
        for (const r of rows) {
          summaryMap.set(r.student_id, {
            present: Number(r.present ?? 0),
            absent: Number(r.absent ?? 0),
            late: Number(r.late ?? 0),
            on_leave: Number(r.on_leave ?? 0),
          });
        }
      } else {
        // Fallback query if SQL function is not created
        const { startDate, endDate } = getMonthStartAndEnd(monthStr);
        const { data: saRows } = await this.supabase.client
          .from('student_attendance')
          .select('student_id, status')
          .eq('class_id', classId)
          .gte('date', startDate)
          .lte('date', endDate);

        for (const r of saRows ?? []) {
          const curr = summaryMap.get(r.student_id) || { present: 0, absent: 0, late: 0, on_leave: 0 };
          if (r.status === 'present') curr.present++;
          else if (r.status === 'absent') curr.absent++;
          else if (r.status === 'late') curr.late++;
          else if (r.status === 'leave') curr.on_leave++;
          summaryMap.set(r.student_id, curr);
        }
      }

      // 3. Map with active students
      const mapped: ClassAttendanceSummaryRow[] = activeStudents.map((s) => {
        const sum = summaryMap.get(s.id) || { present: 0, absent: 0, late: 0, on_leave: 0 };
        const total_days = sum.present + sum.absent + sum.late + sum.on_leave;
        const percentage =
          total_days > 0
            ? Math.round(((sum.present + sum.late) / total_days) * 1000) / 10
            : 0;

        return {
          student_id: s.id,
          roll_no: s.roll_no,
          full_name: s.full_name,
          present: sum.present,
          absent: sum.absent,
          late: sum.late,
          on_leave: sum.on_leave,
          total_days,
          percentage,
          has_records: total_days > 0,
          is_low: total_days > 0 && percentage < 75.0,
        };
      });

      this.classReportRows.set(mapped);
      this.lastClassKey = cacheKey;
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to generate class attendance report.'));
    } finally {
      this.loadingClassReport.set(false);
    }
  }

  // =========================================================================
  // Tab B: Student History Report
  // =========================================================================

  async loadStudentsForClass(classId: string): Promise<void> {
    if (!classId) {
      this.classStudents.set([]);
      this.selectedStudentId.set('');
      return;
    }

    try {
      const { data, error } = await this.supabase.client
        .from('students')
        .select('id, roll_no, full_name, class_id, is_active, created_at')
        .eq('class_id', classId)
        .eq('is_active', true)
        .order('roll_no', { ascending: true });

      if (error) throw error;

      const list = (data as Student[]) ?? [];
      this.classStudents.set(list);

      if (list.length > 0 && !this.selectedStudentId()) {
        this.selectedStudentId.set(list[0].id);
      }
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to load students for class.'));
    }
  }

  async loadStudentHistory(studentId: string, monthStr: string, force = false): Promise<void> {
    if (!studentId) {
      this.studentHistoryDays.set([]);
      return;
    }

    const cacheKey = `${studentId}_${monthStr}`;
    if (!force && this.lastStudentKey === cacheKey && this.studentHistoryDays().length > 0) {
      return;
    }

    this.loadingStudentHistory.set(true);
    try {
      const { startDate, endDate } = getMonthStartAndEnd(monthStr);

      const { data, error } = await this.supabase.client
        .from('student_attendance')
        .select('date, status')
        .eq('student_id', studentId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;

      this.studentHistoryDays.set((data as StudentAttendanceHistoryDay[]) ?? []);
      this.lastStudentKey = cacheKey;
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to load student attendance history.'));
    } finally {
      this.loadingStudentHistory.set(false);
    }
  }

  // =========================================================================
  // Tab C: Teacher Monthly Attendance Report (Admin Only)
  // =========================================================================

  async loadTeacherMonthlyAttendance(monthStr: string, force = false): Promise<void> {
    const cacheKey = `teachers_${monthStr}`;
    if (!force && this.lastTeacherKey === cacheKey && this.teacherReportRows().length > 0) {
      return;
    }

    this.loadingTeacherReport.set(true);
    try {
      // 1. Fetch active teachers
      const { data: teachersData, error: teachersErr } = await this.supabase.client
        .from('teachers')
        .select(`
          id,
          employee_code,
          profiles!inner (
            full_name,
            is_active
          )
        `)
        .order('employee_code', { ascending: true });

      if (teachersErr) throw teachersErr;

      const rawTeachers = (teachersData as unknown as RawTeacherWithProfile[]) ?? [];
      const activeTeachers = rawTeachers.filter((t) => t.profiles?.is_active === true);
      const summaryMap = new Map<
        string,
        { present: number; absent: number; late: number; on_leave: number }
      >();

      // 2. Call SQL function teacher_attendance_summary(p_month)
      const pMonth = `${monthStr}-01`;
      const { data: rpcData, error: rpcErr } = await this.supabase.client.rpc(
        'teacher_attendance_summary',
        { p_month: pMonth }
      );

      if (!rpcErr && rpcData) {
        const rows = rpcData as RawTeacherSummaryRpc[];
        for (const r of rows) {
          summaryMap.set(r.teacher_id, {
            present: Number(r.present ?? 0),
            absent: Number(r.absent ?? 0),
            late: Number(r.late ?? 0),
            on_leave: Number(r.on_leave ?? 0),
          });
        }
      } else {
        // Fallback query if RPC does not exist
        const { startDate, endDate } = getMonthStartAndEnd(monthStr);
        const { data: taRows } = await this.supabase.client
          .from('teacher_attendance')
          .select('teacher_id, status')
          .gte('date', startDate)
          .lte('date', endDate);

        for (const r of taRows ?? []) {
          const curr = summaryMap.get(r.teacher_id) || { present: 0, absent: 0, late: 0, on_leave: 0 };
          if (r.status === 'present') curr.present++;
          else if (r.status === 'absent') curr.absent++;
          else if (r.status === 'late') curr.late++;
          else if (r.status === 'leave') curr.on_leave++;
          summaryMap.set(r.teacher_id, curr);
        }
      }

      // 3. Map with active teachers
      const mapped: TeacherAttendanceSummaryRow[] = activeTeachers.map((t) => {
        const sum = summaryMap.get(t.id) || { present: 0, absent: 0, late: 0, on_leave: 0 };
        const total_days = sum.present + sum.absent + sum.late + sum.on_leave;
        const percentage =
          total_days > 0
            ? Math.round(((sum.present + sum.late) / total_days) * 1000) / 10
            : 0;

        return {
          teacher_id: t.id,
          employee_code: t.employee_code,
          full_name: t.profiles?.full_name ?? 'Unknown Teacher',
          present: sum.present,
          absent: sum.absent,
          late: sum.late,
          on_leave: sum.on_leave,
          total_days,
          percentage,
          has_records: total_days > 0,
          is_low: total_days > 0 && percentage < 75.0,
        };
      });

      this.teacherReportRows.set(mapped);
      this.lastTeacherKey = cacheKey;
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to generate teacher attendance report.'));
    } finally {
      this.loadingTeacherReport.set(false);
    }
  }
}
