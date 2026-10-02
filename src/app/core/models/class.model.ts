export interface SchoolClass {
  id: string;
  name: string;
  section: string;
  academic_year: string;
  created_at?: string;
  updated_at?: string;
  subjects_count?: number;
}

export interface CreateClassDto {
  name: string;
  section: string;
  academic_year: string;
}

export interface UpdateClassDto {
  name: string;
  section: string;
  academic_year: string;
}
