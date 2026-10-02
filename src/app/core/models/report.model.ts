import { AttendanceStatus } from './attendance.model';

export interface ClassAttendanceSummaryRow {
  student_id: string;
  roll_no: number;
  full_name: string;
  present: number;
  absent: number;
  late: number;
  on_leave: number;
  total_days: number;
  percentage: number;
  has_records: boolean;
  is_low: boolean;
}

export interface StudentAttendanceHistoryDay {
  date: string;
  status: AttendanceStatus;
}

export interface TeacherAttendanceSummaryRow {
  teacher_id: string;
  employee_code: string;
  full_name: string;
  present: number;
  absent: number;
  late: number;
  on_leave: number;
  total_days: number;
  percentage: number;
  has_records: boolean;
  is_low: boolean;
}

export interface ReportTotals {
  present: number;
  absent: number;
  late: number;
  on_leave: number;
  total_days: number;
  percentage: number;
}
