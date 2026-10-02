import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import {
  CreateExamDto,
  CreateExamPaperDto,
  Exam,
  ExamPaper,
  SchoolClass,
  Subject,
  UpdateExamDto,
  UpdateExamPaperDto,
} from '../../core/models';
import { getFriendlyErrorMessage } from '../../core/utils/db-error';
import { getExamStatus } from '../../core/utils/date';

interface RawExamRow {
  id: string;
  title: string;
  class_id: string;
  start_date: string;
  end_date: string;
  created_at: string;
  classes?: {
    name: string;
    section: string;
    academic_year: string;
  } | null;
  exam_papers?: { count: number }[];
}

interface RawExamPaperRow {
  id: string;
  exam_id: string;
  subject_id: string;
  paper_date: string;
  start_time: string;
  end_time: string;
  room: string | null;
  total_marks: number;
  created_at: string;
  subjects?: {
    name: string;
    code: string;
  } | null;
}

interface RawClassSubjectRow {
  subject_id: string;
  subjects?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

@Injectable({
  providedIn: 'root',
})
export class ExamsService {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);

  // --- Exams List State ---
  private readonly _items = signal<Exam[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _saving = signal<boolean>(false);
  private readonly _classes = signal<SchoolClass[]>([]);

  readonly items = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly classes = this._classes.asReadonly();
  readonly count = computed(() => this._items().length);

  // --- Exam Detail & Papers State ---
  private readonly _currentExam = signal<Exam | null>(null);
  private readonly _papers = signal<ExamPaper[]>([]);
  private readonly _classSubjects = signal<Subject[]>([]);
  private readonly _loadingDetail = signal<boolean>(false);
  private readonly _savingPaper = signal<boolean>(false);

  readonly currentExam = this._currentExam.asReadonly();
  readonly papers = this._papers.asReadonly();
  readonly classSubjects = this._classSubjects.asReadonly();
  readonly loadingDetail = this._loadingDetail.asReadonly();
  readonly savingPaper = this._savingPaper.asReadonly();

  // =========================================================================
  // Classes Loading
  // =========================================================================

  async loadClasses(): Promise<void> {
    try {
      const { data, error } = await this.supabase.client
        .from('classes')
        .select('id, name, section, academic_year')
        .order('name', { ascending: true })
        .order('section', { ascending: true });

      if (error) throw error;
      this._classes.set((data as SchoolClass[]) ?? []);
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to load classes.'));
    }
  }

  // =========================================================================
  // Exams CRUD
  // =========================================================================

  async loadExams(): Promise<void> {
    this._loading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('exams')
        .select(
          `
          id,
          title,
          class_id,
          start_date,
          end_date,
          created_at,
          classes (
            name,
            section,
            academic_year
          ),
          exam_papers (
            count
          )
        `,
        )
        .order('start_date', { ascending: false });

      if (error) throw error;

      const raw = (data as unknown as RawExamRow[]) ?? [];
      const mapped: Exam[] = raw.map((row) => ({
        id: row.id,
        title: row.title,
        class_id: row.class_id,
        start_date: row.start_date,
        end_date: row.end_date,
        created_at: row.created_at,
        class_name: row.classes?.name ?? null,
        class_section: row.classes?.section ?? null,
        class_academic_year: row.classes?.academic_year ?? null,
        papers_count: row.exam_papers?.[0]?.count ?? 0,
        status: getExamStatus(row.start_date, row.end_date),
      }));

      this._items.set(mapped);
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to load exams.'));
    } finally {
      this._loading.set(false);
    }
  }

  async createExam(dto: CreateExamDto, classMeta?: SchoolClass): Promise<Exam | null> {
    if (this._saving()) return null;
    this._saving.set(true);

    try {
      const trimmedTitle = dto.title.trim();
      const { data, error } = await this.supabase.client
        .from('exams')
        .insert({
          title: trimmedTitle,
          class_id: dto.class_id,
          start_date: dto.start_date,
          end_date: dto.end_date,
        })
        .select('id, title, class_id, start_date, end_date, created_at')
        .single();

      if (error) throw error;

      const created: Exam = {
        id: data.id,
        title: data.title,
        class_id: data.class_id,
        start_date: data.start_date,
        end_date: data.end_date,
        created_at: data.created_at,
        class_name: classMeta?.name,
        class_section: classMeta?.section,
        class_academic_year: classMeta?.academic_year,
        papers_count: 0,
        status: getExamStatus(data.start_date, data.end_date),
      };

      // Add to signal locally
      this._items.update((prev) => [created, ...prev]);
      this.toast.showSuccess(`Exam "${created.title}" created successfully.`);
      return created;
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to create exam.'));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async updateExam(id: string, dto: UpdateExamDto, classMeta?: SchoolClass): Promise<boolean> {
    if (this._saving()) return false;
    this._saving.set(true);

    try {
      const trimmedTitle = dto.title.trim();
      const { error } = await this.supabase.client
        .from('exams')
        .update({
          title: trimmedTitle,
          class_id: dto.class_id,
          start_date: dto.start_date,
          end_date: dto.end_date,
        })
        .eq('id', id);

      if (error) throw error;

      // Update in items signal
      this._items.update((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                title: trimmedTitle,
                class_id: dto.class_id,
                start_date: dto.start_date,
                end_date: dto.end_date,
                status: getExamStatus(dto.start_date, dto.end_date),
                ...(classMeta
                  ? {
                      class_name: classMeta.name,
                      class_section: classMeta.section,
                      class_academic_year: classMeta.academic_year,
                    }
                  : {}),
              }
            : e,
        ),
      );

      // If currentExam is open, update it too
      if (this._currentExam()?.id === id) {
        this._currentExam.update((curr) =>
          curr
            ? {
                ...curr,
                title: trimmedTitle,
                class_id: dto.class_id,
                start_date: dto.start_date,
                end_date: dto.end_date,
                status: getExamStatus(dto.start_date, dto.end_date),
                ...(classMeta
                  ? {
                      class_name: classMeta.name,
                      class_section: classMeta.section,
                      class_academic_year: classMeta.academic_year,
                    }
                  : {}),
              }
            : null,
        );
      }

      this.toast.showSuccess(`Exam "${trimmedTitle}" updated successfully.`);
      return true;
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to update exam.'));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async deleteExam(id: string, title: string): Promise<boolean> {
    if (this._saving()) return false;
    this._saving.set(true);

    try {
      const { error } = await this.supabase.client.from('exams').delete().eq('id', id);

      if (error) throw error;

      // Remove from signal locally
      this._items.update((prev) => prev.filter((e) => e.id !== id));
      this.toast.showSuccess(`Exam "${title}" and its schedule were deleted.`);
      return true;
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to delete exam.'));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  // =========================================================================
  // Exam Detail & Papers CRUD
  // =========================================================================

  async loadExamDetail(examId: string): Promise<boolean> {
    this._loadingDetail.set(true);
    try {
      // 1. Load Exam
      const { data: examData, error: examErr } = await this.supabase.client
        .from('exams')
        .select(
          `
          id,
          title,
          class_id,
          start_date,
          end_date,
          created_at,
          classes (
            name,
            section,
            academic_year
          )
        `,
        )
        .eq('id', examId)
        .single();

      if (examErr || !examData) {
        throw examErr || new Error('Exam not found.');
      }

      const rawExam = examData as unknown as RawExamRow;
      const exam: Exam = {
        id: rawExam.id,
        title: rawExam.title,
        class_id: rawExam.class_id,
        start_date: rawExam.start_date,
        end_date: rawExam.end_date,
        created_at: rawExam.created_at,
        class_name: rawExam.classes?.name,
        class_section: rawExam.classes?.section,
        class_academic_year: rawExam.classes?.academic_year,
        status: getExamStatus(rawExam.start_date, rawExam.end_date),
      };

      this._currentExam.set(exam);

      // 2. Load Papers
      const { data: papersData, error: papersErr } = await this.supabase.client
        .from('exam_papers')
        .select(
          `
          id,
          exam_id,
          subject_id,
          paper_date,
          start_time,
          end_time,
          room,
          total_marks,
          created_at,
          subjects (
            name,
            code
          )
        `,
        )
        .eq('exam_id', examId)
        .order('paper_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (papersErr) throw papersErr;

      const rawPapers = (papersData as unknown as RawExamPaperRow[]) ?? [];
      const mappedPapers: ExamPaper[] = rawPapers.map((p) => ({
        id: p.id,
        exam_id: p.exam_id,
        subject_id: p.subject_id,
        paper_date: p.paper_date,
        start_time: p.start_time,
        end_time: p.end_time,
        room: p.room,
        total_marks: Number(p.total_marks),
        created_at: p.created_at,
        subject_name: p.subjects?.name,
        subject_code: p.subjects?.code,
      }));

      this._papers.set(mappedPapers);

      // 3. Load Assigned Subjects of Class
      const { data: subjectsData, error: subjectsErr } = await this.supabase.client
        .from('class_subjects')
        .select(
          `
          subject_id,
          subjects (
            id,
            name,
            code
          )
        `,
        )
        .eq('class_id', exam.class_id);

      if (subjectsErr) throw subjectsErr;

      const rawSubjects = (subjectsData as unknown as RawClassSubjectRow[]) ?? [];
      const mappedSubjects: Subject[] = rawSubjects
        .filter((row) => !!row.subjects)
        .map((row) => ({
          id: row.subjects!.id,
          name: row.subjects!.name,
          code: row.subjects!.code,
          created_at: '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      this._classSubjects.set(mappedSubjects);
      return true;
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to load exam details.'));
      return false;
    } finally {
      this._loadingDetail.set(false);
    }
  }

  async createPaper(dto: CreateExamPaperDto, subjectMeta?: Subject): Promise<ExamPaper | null> {
    if (this._savingPaper()) return null;
    this._savingPaper.set(true);

    try {
      const trimmedRoom = dto.room ? dto.room.trim() : null;
      const { data, error } = await this.supabase.client
        .from('exam_papers')
        .insert({
          exam_id: dto.exam_id,
          subject_id: dto.subject_id,
          paper_date: dto.paper_date,
          start_time: dto.start_time,
          end_time: dto.end_time,
          room: trimmedRoom,
          total_marks: dto.total_marks,
        })
        .select(
          'id, exam_id, subject_id, paper_date, start_time, end_time, room, total_marks, created_at',
        )
        .single();

      if (error) throw error;

      const created: ExamPaper = {
        id: data.id,
        exam_id: data.exam_id,
        subject_id: data.subject_id,
        paper_date: data.paper_date,
        start_time: data.start_time,
        end_time: data.end_time,
        room: data.room,
        total_marks: Number(data.total_marks),
        created_at: data.created_at,
        subject_name: subjectMeta?.name,
        subject_code: subjectMeta?.code,
      };

      // Add & sort papers signal locally
      this._papers.update((prev) =>
        [...prev, created].sort(
          (a, b) =>
            a.paper_date.localeCompare(b.paper_date) || a.start_time.localeCompare(b.start_time),
        ),
      );

      // Increment papers_count in items list
      this._items.update((prev) =>
        prev.map((e) =>
          e.id === dto.exam_id ? { ...e, papers_count: (e.papers_count ?? 0) + 1 } : e,
        ),
      );

      this.toast.showSuccess(
        `Paper for "${created.subject_name || 'Subject'}" scheduled successfully.`,
      );
      return created;
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to add exam paper.'));
      return null;
    } finally {
      this._savingPaper.set(false);
    }
  }

  async updatePaper(
    paperId: string,
    dto: UpdateExamPaperDto,
    subjectMeta?: Subject,
  ): Promise<boolean> {
    if (this._savingPaper()) return false;
    this._savingPaper.set(true);

    try {
      const trimmedRoom = dto.room ? dto.room.trim() : null;
      const { error } = await this.supabase.client
        .from('exam_papers')
        .update({
          subject_id: dto.subject_id,
          paper_date: dto.paper_date,
          start_time: dto.start_time,
          end_time: dto.end_time,
          room: trimmedRoom,
          total_marks: dto.total_marks,
        })
        .eq('id', paperId);

      if (error) throw error;

      // Update & sort papers locally
      this._papers.update((prev) =>
        prev
          .map((p) =>
            p.id === paperId
              ? {
                  ...p,
                  subject_id: dto.subject_id,
                  paper_date: dto.paper_date,
                  start_time: dto.start_time,
                  end_time: dto.end_time,
                  room: trimmedRoom,
                  total_marks: Number(dto.total_marks),
                  ...(subjectMeta
                    ? {
                        subject_name: subjectMeta.name,
                        subject_code: subjectMeta.code,
                      }
                    : {}),
                }
              : p,
          )
          .sort(
            (a, b) =>
              a.paper_date.localeCompare(b.paper_date) || a.start_time.localeCompare(b.start_time),
          ),
      );

      this.toast.showSuccess('Exam paper updated successfully.');
      return true;
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to update exam paper.'));
      return false;
    } finally {
      this._savingPaper.set(false);
    }
  }

  async deletePaper(paperId: string, examId: string, subjectName?: string | null): Promise<boolean> {
    if (this._savingPaper()) return false;
    this._savingPaper.set(true);

    try {
      const { error } = await this.supabase.client.from('exam_papers').delete().eq('id', paperId);

      if (error) throw error;

      // Remove locally from papers
      this._papers.update((prev) => prev.filter((p) => p.id !== paperId));

      // Decrement papers_count in items list
      this._items.update((prev) =>
        prev.map((e) =>
          e.id === examId ? { ...e, papers_count: Math.max(0, (e.papers_count ?? 1) - 1) } : e,
        ),
      );

      this.toast.showSuccess(`Paper "${subjectName || ''}" deleted from schedule.`);
      return true;
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to delete paper.'));
      return false;
    } finally {
      this._savingPaper.set(false);
    }
  }
}
