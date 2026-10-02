export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave';

export interface StudentAttendance {
  id: string;
  student_id: string;
  class_id: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  marked_by: string | null;
  created_at: string;
}

export interface TeacherAttendance {
  id: string;
  teacher_id: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  marked_by: string | null;
  created_at: string;
}

/**
 * UI State representation for student attendance row.
 */
export interface StudentAttendanceItem {
  student_id: string;
  roll_no: number;
  full_name: string;
  status: AttendanceStatus;
  attendance_id?: string;
  is_existing: boolean;
}

/**
 * UI State representation for teacher attendance row.
 */
export interface TeacherAttendanceItem {
  teacher_id: string;
  employee_code: string;
  full_name: string;
  status: AttendanceStatus;
  attendance_id?: string;
  is_existing: boolean;
}

/**
 * Teacher's personal monthly attendance record.
 */
export interface MyAttendanceRecord {
  id: string;
  date: string;
  status: AttendanceStatus;
  created_at: string;
}

/**
 * Summary counts for active attendance sheet.
 */
export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  leave: number;
  total: number;
}
