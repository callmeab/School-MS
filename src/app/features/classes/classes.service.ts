import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { getFriendlyErrorMessage } from '../../core/utils/db-error';
import {
  ClassSubjectDetail,
  CreateClassDto,
  SchoolClass,
  UpdateClassDto,
} from '../../core/models';

interface RawClassRecord {
  id: string;
  name: string;
  section: string;
  academic_year: string;
  created_at: string;
  class_subjects?: { count: number }[];
}

interface RawClassSubjectRecord {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  subjects?: { name: string; code: string } | null;
  teachers?: {
    employee_code: string;
    profiles?: { full_name: string } | null;
  } | null;
}

@Injectable({
  providedIn: 'root',
})
export class ClassesService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly toastService = inject(ToastService);

  private readonly _items = signal<SchoolClass[]>([]);
  readonly items = this._items.asReadonly();

  private readonly _loading = signal<boolean>(false);
  readonly loading = this._loading.asReadonly();

  private readonly _saving = signal<boolean>(false);
  readonly saving = this._saving.asReadonly();

  private readonly _classSubjects = signal<ClassSubjectDetail[]>([]);
  readonly classSubjects = this._classSubjects.asReadonly();

  private readonly _loadingClassSubjects = signal<boolean>(false);
  readonly loadingClassSubjects = this._loadingClassSubjects.asReadonly();

  async load(): Promise<void> {
    this._loading.set(true);
    try {
      const { data, error } = await this.supabaseService.client
        .from('classes')
        .select('id, name, section, academic_year, created_at, class_subjects(count)')
        .order('name', { ascending: true })
        .order('section', { ascending: true });

      if (error) {
        throw error;
      }

      const raw = (data as unknown as RawClassRecord[]) ?? [];
      const mapped: SchoolClass[] = raw.map((row) => ({
        id: row.id,
        name: row.name,
        section: row.section,
        academic_year: row.academic_year,
        created_at: row.created_at,
        subjects_count: row.class_subjects?.[0]?.count ?? 0,
      }));

      this._items.set(mapped);
    } catch (err) {
      const message = getFriendlyErrorMessage(err, 'Failed to load classes.');
      this.toastService.showError(message);
    } finally {
      this._loading.set(false);
    }
  }

  async create(dto: CreateClassDto): Promise<boolean> {
    this._saving.set(true);
    try {
      const payload = {
        name: dto.name.trim(),
        section: dto.section.trim(),
        academic_year: dto.academic_year.trim(),
      };

      const { data, error } = await this.supabaseService.client
        .from('classes')
        .insert(payload)
        .select('id, name, section, academic_year, created_at')
        .single();

      if (error) {
        throw error;
      }

      const created: SchoolClass = {
        ...(data as SchoolClass),
        subjects_count: 0,
      };

      // Update signal locally
      this._items.update((list) =>
        [...list, created].sort((a, b) => a.name.localeCompare(b.name))
      );

      this.toastService.showSuccess('Class created successfully.');
      return true;
    } catch (err) {
      const message = getFriendlyErrorMessage(err, 'Failed to create class.');
      this.toastService.showError(message);
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async update(id: string, dto: UpdateClassDto): Promise<boolean> {
    this._saving.set(true);
    try {
      const payload = {
        name: dto.name.trim(),
        section: dto.section.trim(),
        academic_year: dto.academic_year.trim(),
      };

      const { data, error } = await this.supabaseService.client
        .from('classes')
        .update(payload)
        .eq('id', id)
        .select('id, name, section, academic_year, created_at')
        .single();

      if (error) {
        throw error;
      }

      const updated = data as SchoolClass;

      // Update signal locally
      this._items.update((list) =>
        list.map((item) =>
          item.id === id
            ? {
                ...item,
                name: updated.name,
                section: updated.section,
                academic_year: updated.academic_year,
              }
            : item
        )
      );

      this.toastService.showSuccess('Class updated successfully.');
      return true;
    } catch (err) {
      const message = getFriendlyErrorMessage(err, 'Failed to update class.');
      this.toastService.showError(message);
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async delete(id: string): Promise<boolean> {
    this._saving.set(true);
    try {
      const { error } = await this.supabaseService.client
        .from('classes')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      // Remove locally from signal
      this._items.update((list) => list.filter((item) => item.id !== id));

      this.toastService.showSuccess('Class deleted successfully.');
      return true;
    } catch (err) {
      const message = getFriendlyErrorMessage(err, 'Failed to delete class.');
      this.toastService.showError(message);
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async remove(id: string): Promise<boolean> {
    return this.delete(id);
  }

  /**
   * Loads subjects assigned to a specific class including teacher assignments.
   */
  async loadClassSubjects(classId: string): Promise<void> {
    this._loadingClassSubjects.set(true);
    try {
      const { data, error } = await this.supabaseService.client
        .from('class_subjects')
        .select(`
          id,
          class_id,
          subject_id,
          teacher_id,
          subjects (
            name,
            code
          ),
          teachers (
            employee_code,
            profiles (
              full_name
            )
          )
        `)
        .eq('class_id', classId);

      if (error) {
        throw error;
      }

      const raw = (data as unknown as RawClassSubjectRecord[]) ?? [];
      const mapped: ClassSubjectDetail[] = raw.map((row) => ({
        id: row.id,
        class_id: row.class_id,
        subject_id: row.subject_id,
        subject_name: row.subjects?.name ?? 'Unknown Subject',
        subject_code: row.subjects?.code ?? '',
        teacher_id: row.teacher_id,
        teacher_name: row.teachers?.profiles?.full_name ?? null,
        teacher_employee_code: row.teachers?.employee_code ?? null,
      }));

      this._classSubjects.set(mapped);
    } catch (err) {
      const message = getFriendlyErrorMessage(err, 'Failed to load class subjects.');
      this.toastService.showError(message);
    } finally {
      this._loadingClassSubjects.set(false);
    }
  }

  /**
   * Assigns a subject to a class in class_subjects table.
   */
  async addSubjectToClass(
    classId: string,
    subjectId: string,
    subjectName: string,
    subjectCode: string
  ): Promise<boolean> {
    this._saving.set(true);
    try {
      const { data, error } = await this.supabaseService.client
        .from('class_subjects')
        .insert({
          class_id: classId,
          subject_id: subjectId,
          teacher_id: null,
        })
        .select('id, class_id, subject_id, teacher_id')
        .single();

      if (error) {
        throw error;
      }

      const newDetail: ClassSubjectDetail = {
        id: data.id,
        class_id: classId,
        subject_id: subjectId,
        subject_name: subjectName,
        subject_code: subjectCode,
        teacher_id: null,
        teacher_name: null,
        teacher_employee_code: null,
      };

      // Update classSubjects signal locally
      this._classSubjects.update((list) => [...list, newDetail]);

      // Increment subjects_count on class item locally
      this._items.update((list) =>
        list.map((c) =>
          c.id === classId ? { ...c, subjects_count: (c.subjects_count ?? 0) + 1 } : c
        )
      );

      this.toastService.showSuccess('Subject added to class.');
      return true;
    } catch (err) {
      const message = getFriendlyErrorMessage(err, 'Failed to assign subject.');
      this.toastService.showError(message);
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  /**
   * Updates teacher_id for an assigned class subject.
   */
  async assignTeacherToSubject(
    classSubjectId: string,
    teacherId: string | null,
    teacherName?: string | null,
    teacherCode?: string | null
  ): Promise<boolean> {
    this._saving.set(true);
    try {
      const { error } = await this.supabaseService.client
        .from('class_subjects')
        .update({ teacher_id: teacherId })
        .eq('id', classSubjectId);

      if (error) {
        throw error;
      }

      // Update signal locally
      this._classSubjects.update((list) =>
        list.map((item) =>
          item.id === classSubjectId
            ? {
                ...item,
                teacher_id: teacherId,
                teacher_name: teacherName || null,
                teacher_employee_code: teacherCode || null,
              }
            : item
        )
      );

      this.toastService.showSuccess(
        teacherId ? 'Faculty teacher assigned to subject.' : 'Subject teacher unassigned.'
      );
      return true;
    } catch (err) {
      const message = getFriendlyErrorMessage(err, 'Failed to update teacher assignment.');
      this.toastService.showError(message);
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  /**
   * Removes subject from a class in class_subjects table.
   */
  async removeSubjectFromClass(classSubjectId: string, classId: string): Promise<boolean> {
    this._saving.set(true);
    try {
      const { error } = await this.supabaseService.client
        .from('class_subjects')
        .delete()
        .eq('id', classSubjectId);

      if (error) {
        throw error;
      }

      // Remove locally from classSubjects
      this._classSubjects.update((list) => list.filter((cs) => cs.id !== classSubjectId));

      // Decrement subjects_count on class item locally
      this._items.update((list) =>
        list.map((c) =>
          c.id === classId ? { ...c, subjects_count: Math.max(0, (c.subjects_count ?? 1) - 1) } : c
        )
      );

      this.toastService.showSuccess('Subject removed from class.');
      return true;
    } catch (err) {
      const message = getFriendlyErrorMessage(err, 'Failed to remove subject.');
      this.toastService.showError(message);
      return false;
    } finally {
      this._saving.set(false);
    }
  }
}
