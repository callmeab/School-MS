export interface AdminDashboardStats {
  activeStudents: number;
  activeTeachers: number;
  totalClasses: number;
}

export interface TodayAttendanceSummary {
  present: number;
  absent: number;
  late: number;
  on_leave: number;
  total: number;
}

export interface UnmarkedClassInfo {
  id: string;
  name: string;
  section: string;
  academic_year: string;
}

export interface UpcomingExamItem {
  id: string;
  title: string;
  class_name: string;
  class_section: string;
  start_date: string;
  end_date: string;
}

export interface TeacherClassStatus {
  class_id: string;
  class_name: string;
  class_section: string;
  academic_year: string;
  is_marked_today: boolean;
}
