export interface ClassSubject {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id?: string | null;
  created_at?: string;
}

export interface ClassSubjectDetail {
  id: string;
  class_id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  teacher_id?: string | null;
  teacher_name?: string | null;
  teacher_employee_code?: string | null;
}

export interface CreateClassSubjectDto {
  class_id: string;
  subject_id: string;
  teacher_id?: string | null;
}
