import { ExamStatus } from '../utils/date';

export type { ExamStatus };

export interface Exam {
  id: string;
  title: string;
  class_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  created_at: string;
  class_name?: string | null;
  class_section?: string | null;
  class_academic_year?: string | null;
  papers_count?: number;
  status?: ExamStatus;
}

export interface CreateExamDto {
  title: string;
  class_id: string;
  start_date: string;
  end_date: string;
}

export interface UpdateExamDto {
  title: string;
  class_id: string;
  start_date: string;
  end_date: string;
}

export interface ExamPaper {
  id: string;
  exam_id: string;
  subject_id: string;
  paper_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm:ss or HH:mm
  end_time: string; // HH:mm:ss or HH:mm
  room: string | null;
  total_marks: number;
  created_at: string;
  subject_name?: string | null;
  subject_code?: string | null;
}

export interface CreateExamPaperDto {
  exam_id: string;
  subject_id: string;
  paper_date: string;
  start_time: string;
  end_time: string;
  room?: string | null;
  total_marks: number;
}

export interface UpdateExamPaperDto {
  subject_id: string;
  paper_date: string;
  start_time: string;
  end_time: string;
  room?: string | null;
  total_marks: number;
}
