export interface Subject {
  id: string;
  name: string;
  code: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateSubjectDto {
  name: string;
  code: string;
}

export interface UpdateSubjectDto {
  name: string;
  code: string;
}
