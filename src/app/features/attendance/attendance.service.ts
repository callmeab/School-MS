import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import {
  AttendanceStatus,
  AttendanceSummary,
  MyAttendanceRecord,
  SchoolClass,
  StudentAttendanceItem,
  TeacherAttendanceItem,
} from '../../core/models';
import { getFriendlyErrorMessage } from '../../core/utils/db-error';
import {
  addDays,
  getMonthDateString,
  getMonthStartAndEnd,
  getTodayDateString,
} from '../../core/utils/date';

interface RawStudentAttendanceRow {
  id: string;
  student_id: string;
  status: AttendanceStatus;
}

interface RawTeacherAttendanceRow {
  id: string;
  teacher_id: string;
  status: AttendanceStatus;
}

interface RawTeacherWithProfile {
  id: string;
  employee_code: string;
  profiles: {
    full_name: string;
    is_active: boolean;
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
export class AttendanceService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  // --- Classes State ---
  private readonly _classes = signal<SchoolClass[]>([]);
  private readonly _loadingClasses = signal<boolean>(false);
  readonly classes = this._classes.asReadonly();
  readonly loadingClasses = this._loadingClasses.asReadonly();

  readonly teacherHasNoClasses = computed(() => {
    return !this._loadingClasses() && this.auth.isTeacher() && this._classes().length === 0;
  });

  // --- Student Attendance State ---
  private readonly _selectedClassId = signal<string>('');
  private readonly _selectedDate = signal<string>(getTodayDateString());
  private readonly _students = signal<StudentAttendanceItem[]>([]);
  private readonly _loadingStudents = signal<boolean>(false);
  private readonly _savingStudentAttendance = signal<boolean>(false);
  private readonly _isExistingStudentAttendance = signal<boolean>(false);
  private readonly _hasUnsavedStudentChanges = signal<boolean>(false);

  readonly selectedClassId = this._selectedClassId.asReadonly();
  readonly selectedDate = this._selectedDate.asReadonly();
  readonly students = this._students.asReadonly();
  readonly loadingStudents = this._loadingStudents.asReadonly();
  readonly savingStudentAttendance = this._savingStudentAttendance.asReadonly();
  readonly isExistingStudentAttendance = this._isExistingStudentAttendance.asReadonly();
  readonly hasUnsavedStudentChanges = this._hasUnsavedStudentChanges.asReadonly();

  readonly studentSummary = computed<AttendanceSummary>(() => {
    const list = this._students();
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;

    for (const item of list) {
      if (item.status === 'present') present++;
      else if (item.status === 'absent') absent++;
      else if (item.status === 'late') late++;
      else if (item.status === 'leave') leave++;
    }

    return {
      present,
      absent,
      late,
      leave,
      total: list.length,
    };
  });

  readonly studentMinDate = computed<string>(() => {
    // Teachers can only mark attendance between today-2 and today
    if (this.auth.isTeacher()) {
      return addDays(getTodayDateString(), -2);
    }
    return ''; // Admins have no past date restrictions
  });

  readonly studentMaxDate = computed<string>(() => {
    return getTodayDateString(); // No future dates allowed
  });

  // --- Teacher Attendance State (Admin Only) ---
  private readonly _teacherDate = signal<string>(getTodayDateString());
  private readonly _teachers = signal<TeacherAttendanceItem[]>([]);
  private readonly _loadingTeachers = signal<boolean>(false);
  private readonly _savingTeacherAttendance = signal<boolean>(false);
  private readonly _isExistingTeacherAttendance = signal<boolean>(false);
  private readonly _hasUnsavedTeacherChanges = signal<boolean>(false);

  readonly teacherDate = this._teacherDate.asReadonly();
  readonly teachers = this._teachers.asReadonly();
  readonly loadingTeachers = this._loadingTeachers.asReadonly();
  readonly savingTeacherAttendance = this._savingTeacherAttendance.asReadonly();
  readonly isExistingTeacherAttendance = this._isExistingTeacherAttendance.asReadonly();
  readonly hasUnsavedTeacherChanges = this._hasUnsavedTeacherChanges.asReadonly();

  readonly teacherSummary = computed<AttendanceSummary>(() => {
    const list = this._teachers();
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;

    for (const item of list) {
      if (item.status === 'present') present++;
      else if (item.status === 'absent') absent++;
      else if (item.status === 'late') late++;
      else if (item.status === 'leave') leave++;
    }

    return {
      present,
      absent,
      late,
      leave,
      total: list.length,
    };
  });

  // --- My Attendance State (Teacher Only) ---
  private readonly _myMonth = signal<string>(getMonthDateString());
  private readonly _myAttendance = signal<MyAttendanceRecord[]>([]);
  private readonly _loadingMyAttendance = signal<boolean>(false);

  readonly myMonth = this._myMonth.asReadonly();
  readonly myAttendance = this._myAttendance.asReadonly();
  readonly loadingMyAttendance = this._loadingMyAttendance.asReadonly();

  readonly mySummary = computed<AttendanceSummary>(() => {
    const list = this._myAttendance();
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;

    for (const item of list) {
      if (item.status === 'present') present++;
      else if (item.status === 'absent') absent++;
      else if (item.status === 'late') late++;
      else if (item.status === 'leave') leave++;
    }

    return {
      present,
      absent,
      late,
      leave,
      total: list.length,
    };
  });

  // =========================================================================
  // Classes Loading Logic
  // =========================================================================

  /**
   * Loads classes according to caller role.
   * Admin: all classes.
   * Teacher: ONLY classes assigned to this teacher in class_subjects.
   */
  async loadClassesForUser(): Promise<void> {
    this._loadingClasses.set(true);
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
        this._classes.set(list);

        if (list.length > 0 && !this._selectedClassId()) {
          this._selectedClassId.set(list[0].id);
        }
      } else if (this.auth.isTeacher()) {
        // 1. Get logged-in teacher's teacher.id
        const { data: teacherRec, error: teacherErr } = await this.supabase.client
          .from('teachers')
          .select('id')
          .eq('profile_id', user.id)
          .single();

        if (teacherErr || !teacherRec) {
          this._classes.set([]);
          return;
        }

        // 2. Query class_subjects where teacher is assigned
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

        this._classes.set(distinctList);

        if (distinctList.length > 0 && !this._selectedClassId()) {
          this._selectedClassId.set(distinctList[0].id);
        }
      }
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to load classes.'));
    } finally {
      this._loadingClasses.set(false);
    }
  }

  // =========================================================================
  // Student Attendance Actions
  // =========================================================================

  setSelectedClassId(classId: string): void {
    this._selectedClassId.set(classId);
  }

  setSelectedDate(dateStr: string): void {
    this._selectedDate.set(dateStr);
  }

  /**
   * Loads active students for the selected class and joins existing attendance for that date.
   */
  async loadStudentAttendance(classId: string, date: string): Promise<void> {
    if (!classId) {
      this._students.set([]);
      this._isExistingStudentAttendance.set(false);
      this._hasUnsavedStudentChanges.set(false);
      return;
    }

    this._loadingStudents.set(true);
    try {
      // 1. Fetch active students in this class
      const { data: studentsData, error: studentsErr } = await this.supabase.client
        .from('students')
        .select('id, roll_no, full_name')
        .eq('class_id', classId)
        .eq('is_active', true)
        .order('roll_no', { ascending: true });

      if (studentsErr) throw studentsErr;

      // 2. Fetch any existing attendance rows for this class and date
      const { data: attendanceData, error: attendanceErr } = await this.supabase.client
        .from('student_attendance')
        .select('id, student_id, status')
        .eq('class_id', classId)
        .eq('date', date);

      if (attendanceErr) throw attendanceErr;

      const rawAttendance = (attendanceData as RawStudentAttendanceRow[]) ?? [];
      const attendanceMap = new Map<string, RawStudentAttendanceRow>();
      for (const row of rawAttendance) {
        attendanceMap.set(row.student_id, row);
      }

      const rawStudents = (studentsData as { id: string; roll_no: number; full_name: string }[]) ?? [];
      const mapped: StudentAttendanceItem[] = rawStudents.map((s) => {
        const exist = attendanceMap.get(s.id);
        return {
          student_id: s.id,
          roll_no: s.roll_no,
          full_name: s.full_name,
          status: exist ? exist.status : 'present', // New unmarked students default to Present
          attendance_id: exist?.id,
          is_existing: !!exist,
        };
      });

      this._students.set(mapped);
      this._isExistingStudentAttendance.set(rawAttendance.length > 0);
      this._hasUnsavedStudentChanges.set(false);
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to load student attendance.'));
    } finally {
      this._loadingStudents.set(false);
    }
  }

  updateStudentStatus(studentId: string, status: AttendanceStatus): void {
    this._students.update((list) =>
      list.map((item) => (item.student_id === studentId ? { ...item, status } : item))
    );
    this._hasUnsavedStudentChanges.set(true);
  }

  markAllStudentsPresent(): void {
    this._students.update((list) => list.map((item) => ({ ...item, status: 'present' })));
    this._hasUnsavedStudentChanges.set(true);
  }

  /**
   * Saves student attendance in a single batch upsert call.
   */
  async saveStudentAttendance(): Promise<boolean> {
    const list = this._students();
    const classId = this._selectedClassId();
    const date = this._selectedDate();
    const currentUserId = this.auth.profile()?.id;

    if (!classId || !date || list.length === 0 || !currentUserId) {
      return false;
    }

    this._savingStudentAttendance.set(true);
    try {
      const rows = list.map((item) => ({
        student_id: item.student_id,
        class_id: classId,
        date: date,
        status: item.status,
        marked_by: currentUserId,
      }));

      // Single upsert call using composite unique constraint: UNIQUE(student_id, date)
      const { error } = await this.supabase.client
        .from('student_attendance')
        .upsert(rows, { onConflict: 'student_id,date' });

      if (error) {
        throw error;
      }

      this._hasUnsavedStudentChanges.set(false);
      this._isExistingStudentAttendance.set(true);
      this.toast.showSuccess(`Attendance successfully saved for ${rows.length} students.`);
      return true;
    } catch (err) {
      // Keep modified in-memory records so user can retry without losing their markings
      const friendlyMsg = getFriendlyErrorMessage(
        err,
        'You are not allowed to mark attendance for this class or date.'
      );
      this.toast.showError(friendlyMsg);
      return false;
    } finally {
      this._savingStudentAttendance.set(false);
    }
  }

  // =========================================================================
  // Teacher Attendance Actions (Admin Only)
  // =========================================================================

  setTeacherDate(dateStr: string): void {
    this._teacherDate.set(dateStr);
  }

  /**
   * Loads active teachers and any existing attendance for the selected date.
   */
  async loadTeacherAttendance(date: string): Promise<void> {
    this._loadingTeachers.set(true);
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

      // 2. Fetch existing teacher attendance rows for this date
      const { data: attendanceData, error: attendanceErr } = await this.supabase.client
        .from('teacher_attendance')
        .select('id, teacher_id, status')
        .eq('date', date);

      if (attendanceErr) throw attendanceErr;

      const rawAttendance = (attendanceData as RawTeacherAttendanceRow[]) ?? [];
      const attendanceMap = new Map<string, RawTeacherAttendanceRow>();
      for (const row of rawAttendance) {
        attendanceMap.set(row.teacher_id, row);
      }

      const rawTeachers = (teachersData as unknown as RawTeacherWithProfile[]) ?? [];
      const activeTeachers = rawTeachers.filter((t) => t.profiles?.is_active === true);

      const mapped: TeacherAttendanceItem[] = activeTeachers.map((t) => {
        const exist = attendanceMap.get(t.id);
        return {
          teacher_id: t.id,
          employee_code: t.employee_code,
          full_name: t.profiles?.full_name ?? 'Unknown Teacher',
          status: exist ? exist.status : 'present', // New unmarked teachers default to Present
          attendance_id: exist?.id,
          is_existing: !!exist,
        };
      });

      this._teachers.set(mapped);
      this._isExistingTeacherAttendance.set(rawAttendance.length > 0);
      this._hasUnsavedTeacherChanges.set(false);
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to load teacher attendance.'));
    } finally {
      this._loadingTeachers.set(false);
    }
  }

  updateTeacherStatus(teacherId: string, status: AttendanceStatus): void {
    this._teachers.update((list) =>
      list.map((item) => (item.teacher_id === teacherId ? { ...item, status } : item))
    );
    this._hasUnsavedTeacherChanges.set(true);
  }

  markAllTeachersPresent(): void {
    this._teachers.update((list) => list.map((item) => ({ ...item, status: 'present' })));
    this._hasUnsavedTeacherChanges.set(true);
  }

  /**
   * Saves teacher attendance in a single batch upsert call.
   */
  async saveTeacherAttendance(): Promise<boolean> {
    const list = this._teachers();
    const date = this._teacherDate();
    const currentUserId = this.auth.profile()?.id;

    if (!date || list.length === 0 || !currentUserId) {
      return false;
    }

    this._savingTeacherAttendance.set(true);
    try {
      const rows = list.map((item) => ({
        teacher_id: item.teacher_id,
        date: date,
        status: item.status,
        marked_by: currentUserId,
      }));

      // Single upsert call using composite unique constraint: UNIQUE(teacher_id, date)
      const { error } = await this.supabase.client
        .from('teacher_attendance')
        .upsert(rows, { onConflict: 'teacher_id,date' });

      if (error) {
        throw error;
      }

      this._hasUnsavedTeacherChanges.set(false);
      this._isExistingTeacherAttendance.set(true);
      this.toast.showSuccess(`Teacher attendance saved for ${rows.length} teachers.`);
      return true;
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to save teacher attendance.'));
      return false;
    } finally {
      this._savingTeacherAttendance.set(false);
    }
  }

  // =========================================================================
  // My Attendance Actions (Teacher Only)
  // =========================================================================

  setMyMonth(monthStr: string): void {
    this._myMonth.set(monthStr);
  }

  /**
   * Loads monthly attendance records for the currently authenticated teacher.
   */
  async loadMyAttendance(monthStr: string): Promise<void> {
    const user = this.auth.profile();
    if (!user) return;

    this._loadingMyAttendance.set(true);
    try {
      // 1. Find teacher's ID
      const { data: teacherRec, error: teacherErr } = await this.supabase.client
        .from('teachers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (teacherErr || !teacherRec) {
        this._myAttendance.set([]);
        return;
      }

      // 2. Compute date boundaries for month
      const { startDate, endDate } = getMonthStartAndEnd(monthStr);

      const { data, error } = await this.supabase.client
        .from('teacher_attendance')
        .select('id, date, status, created_at')
        .eq('teacher_id', teacherRec.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;

      this._myAttendance.set((data as MyAttendanceRecord[]) ?? []);
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to load your attendance records.'));
    } finally {
      this._loadingMyAttendance.set(false);
    }
  }
}
