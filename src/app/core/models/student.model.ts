export interface Student {
  id: string;
  class_id: string | null;
  roll_no: number;
  full_name: string;
  phone: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  is_active: boolean;
  created_at: string;
  class_name?: string | null;
  class_section?: string | null;
  class_academic_year?: string | null;
}

export interface CreateStudentDto {
  full_name: string;
  class_id: string;
  roll_no: number;
  phone?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
}

export interface UpdateStudentDto {
  full_name: string;
  class_id: string;
  roll_no: number;
  phone?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
}
