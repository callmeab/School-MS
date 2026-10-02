export interface Teacher {
  id: string;
  profile_id: string;
  employee_code: string;
  qualification: string | null;
  joining_date: string;
  created_at: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  email?: string;
}

export interface CreateTeacherDto {
  full_name: string;
  email: string;
  password: string;
  phone?: string | null;
  employee_code: string;
  qualification?: string | null;
  joining_date: string;
}

export interface UpdateTeacherDto {
  full_name: string;
  phone?: string | null;
  qualification?: string | null;
  joining_date: string;
}
