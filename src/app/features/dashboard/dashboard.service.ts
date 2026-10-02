import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/services/auth.service';
import {
  AdminDashboardStats,
  TeacherClassStatus,
  TodayAttendanceSummary,
  UnmarkedClassInfo,
  UpcomingExamItem,
} from '../../core/models';
import { getTodayDateString } from '../../core/utils/date';

interface RawAttendanceSummaryRpc {
  present: number | string;
  absent: number | string;
  late: number | string;
  on_leave: number | string;
}

interface RawExamWithClass {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  classes?: {
    name: string;
    section: string;
  } | null;
}

interface RawClassSubjectRow {
  class_id: string;
  classes: {
    id: string;
    name: string;
    section: string;
    academic_year: string;
  } | null;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  // --- Admin Dashboard State ---
  readonly stats = signal<AdminDashboardStats>({
    activeStudents: 0,
    activeTeachers: 0,
    totalClasses: 0,
  });
  readonly loadingStats = signal<boolean>(false);
  readonly errorStats = signal<boolean>(false);

  readonly todayAttendance = signal<TodayAttendanceSummary>({
    present: 0,
    absent: 0,
    late: 0,
    on_leave: 0,
    total: 0,
  });
  readonly loadingTodayAttendance = signal<boolean>(false);
  readonly errorTodayAttendance = signal<boolean>(false);

  readonly unmarkedClasses = signal<UnmarkedClassInfo[]>([]);
  readonly loadingUnmarkedClasses = signal<boolean>(false);
  readonly errorUnmarkedClasses = signal<boolean>(false);

  readonly teacherAttendanceMarkedToday = signal<boolean>(false);
  readonly teacherAttendanceMarkedCount = signal<number>(0);
  readonly loadingTeacherAttendanceToday = signal<boolean>(false);

  readonly upcomingExams = signal<UpcomingExamItem[]>([]);
  readonly loadingUpcomingExams = signal<boolean>(false);
  readonly errorUpcomingExams = signal<boolean>(false);

  // --- Teacher Dashboard State ---
  readonly myClasses = signal<TeacherClassStatus[]>([]);
  readonly loadingMyClasses = signal<boolean>(false);
  readonly errorMyClasses = signal<boolean>(false);

  // =========================================================================
  // Admin Data Loaders
  // =========================================================================

  async loadAdminStats(): Promise<void> {
    this.loadingStats.set(true);
    this.errorStats.set(false);

    try {
      const [studentsRes, teachersRes, classesRes] = await Promise.all([
        this.supabase.client
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true),
        this.supabase.client
          .from('teachers')
          .select('id, profiles!inner(is_active)', { count: 'exact', head: true })
          .eq('profiles.is_active', true),
        this.supabase.client
          .from('classes')
          .select('*', { count: 'exact', head: true }),
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (teachersRes.error) throw teachersRes.error;
      if (classesRes.error) throw classesRes.error;

      this.stats.set({
        activeStudents: studentsRes.count ?? 0,
        activeTeachers: teachersRes.count ?? 0,
        totalClasses: classesRes.count ?? 0,
      });
    } catch {
      this.errorStats.set(true);
    } finally {
      this.loadingStats.set(false);
    }
  }

  async loadTodayAttendanceSummary(): Promise<void> {
    this.loadingTodayAttendance.set(true);
    this.errorTodayAttendance.set(false);

    const today = getTodayDateString();

    try {
      // 1. Try SQL RPC attendance_today_summary
      const { data, error } = await this.supabase.client.rpc(
        'attendance_today_summary',
        { p_date: today }
      );

      if (!error && data) {
        const row = Array.isArray(data) ? (data[0] as RawAttendanceSummaryRpc) : (data as RawAttendanceSummaryRpc);
        const present = Number(row?.present ?? 0);
        const absent = Number(row?.absent ?? 0);
        const late = Number(row?.late ?? 0);
        const on_leave = Number(row?.on_leave ?? 0);
        const total = present + absent + late + on_leave;

        this.todayAttendance.set({ present, absent, late, on_leave, total });
        return;
      }

      // 2. Resilient fallback query if RPC function does not exist
      const { data: rows, error: fbErr } = await this.supabase.client
        .from('student_attendance')
        .select('status')
        .eq('date', today);

      if (fbErr) throw fbErr;

      let p = 0;
      let a = 0;
      let l = 0;
      let lv = 0;

      for (const r of rows ?? []) {
        if (r.status === 'present') p++;
        else if (r.status === 'absent') a++;
        else if (r.status === 'late') l++;
        else if (r.status === 'leave') lv++;
      }

      this.todayAttendance.set({
        present: p,
        absent: a,
        late: l,
        on_leave: lv,
        total: p + a + l + lv,
      });
    } catch {
      this.errorTodayAttendance.set(true);
    } finally {
      this.loadingTodayAttendance.set(false);
    }
  }

  async loadUnmarkedClassesToday(): Promise<void> {
    this.loadingUnmarkedClasses.set(true);
    this.errorUnmarkedClasses.set(false);

    const today = getTodayDateString();

    try {
      const [classesRes, markedRes] = await Promise.all([
        this.supabase.client
          .from('classes')
          .select('id, name, section, academic_year')
          .order('name', { ascending: true })
          .order('section', { ascending: true }),
        this.supabase.client
          .from('student_attendance')
          .select('class_id')
          .eq('date', today),
      ]);

      if (classesRes.error) throw classesRes.error;
      if (markedRes.error) throw markedRes.error;

      const markedClassIds = new Set(
        (markedRes.data ?? []).map((row) => row.class_id)
      );

      const all = (classesRes.data as UnmarkedClassInfo[]) ?? [];
      const unmarked = all.filter((c) => !markedClassIds.has(c.id));

      this.unmarkedClasses.set(unmarked);
    } catch {
      this.errorUnmarkedClasses.set(true);
    } finally {
      this.loadingUnmarkedClasses.set(false);
    }
  }

  async loadTeacherAttendanceTodayStatus(): Promise<void> {
    this.loadingTeacherAttendanceToday.set(true);
    const today = getTodayDateString();

    try {
      const { count, error } = await this.supabase.client
        .from('teacher_attendance')
        .select('id', { count: 'exact', head: true })
        .eq('date', today);

      if (error) throw error;

      const cnt = count ?? 0;
      this.teacherAttendanceMarkedCount.set(cnt);
      this.teacherAttendanceMarkedToday.set(cnt > 0);
    } catch {
      this.teacherAttendanceMarkedToday.set(false);
    } finally {
      this.loadingTeacherAttendanceToday.set(false);
    }
  }

  async loadUpcomingExams(): Promise<void> {
    this.loadingUpcomingExams.set(true);
    this.errorUpcomingExams.set(false);

    const today = getTodayDateString();

    try {
      const { data, error } = await this.supabase.client
        .from('exams')
        .select(`
          id,
          title,
          start_date,
          end_date,
          classes (
            name,
            section
          )
        `)
        .gte('end_date', today)
        .order('start_date', { ascending: true })
        .limit(5);

      if (error) throw error;

      const raw = (data as unknown as RawExamWithClass[]) ?? [];
      const mapped: UpcomingExamItem[] = raw.map((e) => ({
        id: e.id,
        title: e.title,
        class_name: e.classes?.name ?? '—',
        class_section: e.classes?.section ?? '—',
        start_date: e.start_date,
        end_date: e.end_date,
      }));

      this.upcomingExams.set(mapped);
    } catch {
      this.errorUpcomingExams.set(true);
    } finally {
      this.loadingUpcomingExams.set(false);
    }
  }

  // =========================================================================
  // Teacher Data Loaders
  // =========================================================================

  async loadTeacherClasses(): Promise<void> {
    this.loadingMyClasses.set(true);
    this.errorMyClasses.set(false);

    const today = getTodayDateString();
    const user = this.auth.profile();

    if (!user) {
      this.loadingMyClasses.set(false);
      return;
    }

    try {
      // 1. Get teacher id
      const { data: teacherRec, error: teacherErr } = await this.supabase.client
        .from('teachers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (teacherErr || !teacherRec) {
        this.myClasses.set([]);
        return;
      }

      // 2. Get assigned classes
      const { data: csData, error: csErr } = await this.supabase.client
        .from('class_subjects')
        .select('class_id, classes!inner(id, name, section, academic_year)')
        .eq('teacher_id', teacherRec.id);

      if (csErr) throw csErr;

      const raw = (csData as unknown as RawClassSubjectRow[]) ?? [];
      const uniqueClassesMap = new Map<
        string,
        { id: string; name: string; section: string; academic_year: string }
      >();

      for (const item of raw) {
        if (item.classes && !uniqueClassesMap.has(item.classes.id)) {
          uniqueClassesMap.set(item.classes.id, item.classes);
        }
      }

      const assignedClasses = Array.from(uniqueClassesMap.values());
      if (assignedClasses.length === 0) {
        this.myClasses.set([]);
        return;
      }

      const classIds = assignedClasses.map((c) => c.id);

      // 3. Check which classes have attendance marked for today
      const { data: markedData, error: markedErr } = await this.supabase.client
        .from('student_attendance')
        .select('class_id')
        .eq('date', today)
        .in('class_id', classIds);

      if (markedErr) throw markedErr;

      const markedSet = new Set((markedData ?? []).map((m) => m.class_id));

      const result: TeacherClassStatus[] = assignedClasses.map((c) => ({
        class_id: c.id,
        class_name: c.name,
        class_section: c.section,
        academic_year: c.academic_year,
        is_marked_today: markedSet.has(c.id),
      }));

      this.myClasses.set(result);
    } catch {
      this.errorMyClasses.set(true);
    } finally {
      this.loadingMyClasses.set(false);
    }
  }

  // =========================================================================
  // Master Initializers
  // =========================================================================

  async initAdminDashboard(): Promise<void> {
    await Promise.all([
      this.loadAdminStats(),
      this.loadTodayAttendanceSummary(),
      this.loadUnmarkedClassesToday(),
      this.loadTeacherAttendanceTodayStatus(),
      this.loadUpcomingExams(),
    ]);
  }

  async initTeacherDashboard(): Promise<void> {
    await Promise.all([
      this.loadTeacherClasses(),
      this.loadTodayAttendanceSummary(),
      this.loadUpcomingExams(),
    ]);
  }
}
