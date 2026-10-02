import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { CreateStudentDto, Student, UpdateStudentDto } from '../../core/models';
import { getFriendlyErrorMessage } from '../../core/utils/db-error';

interface RawStudentRow {
  id: string;
  class_id: string | null;
  roll_no: number;
  full_name: string;
  phone: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  is_active: boolean;
  created_at: string;
  classes: {
    name: string;
    section: string;
    academic_year: string;
  } | null;
}

@Injectable({
  providedIn: 'root',
})
export class StudentsService {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);

  private readonly PAGE_SIZE = 20;

  private readonly _items = signal<Student[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _loadingMore = signal<boolean>(false);
  private readonly _saving = signal<boolean>(false);
  private readonly _hasMore = signal<boolean>(false);
  private readonly _page = signal<number>(0);
  private readonly _totalCount = signal<number>(0);

  readonly items = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loadingMore = this._loadingMore.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly hasMore = this._hasMore.asReadonly();
  readonly totalCount = this._totalCount.asReadonly();
  readonly count = computed(() => this._items().length);

  async load(page = 0, append = false): Promise<void> {
    if (append) {
      this._loadingMore.set(true);
    } else {
      this._loading.set(true);
    }

    try {
      const from = page * this.PAGE_SIZE;
      const to = from + this.PAGE_SIZE - 1;

      const { data, count, error } = await this.supabase.client
        .from('students')
        .select(
          `
          id,
          class_id,
          roll_no,
          full_name,
          phone,
          guardian_name,
          guardian_phone,
          is_active,
          created_at,
          classes (
            name,
            section,
            academic_year
          )
        `,
          { count: 'exact' }
        )
        .order('roll_no', { ascending: true })
        .range(from, to);

      if (error) throw error;

      const raw = (data as unknown as RawStudentRow[]) ?? [];
      const mapped: Student[] = raw.map((row) => ({
        id: row.id,
        class_id: row.class_id,
        roll_no: row.roll_no,
        full_name: row.full_name,
        phone: row.phone ?? null,
        guardian_name: row.guardian_name,
        guardian_phone: row.guardian_phone,
        is_active: row.is_active ?? true,
        created_at: row.created_at,
        class_name: row.classes?.name ?? null,
        class_section: row.classes?.section ?? null,
        class_academic_year: row.classes?.academic_year ?? null,
      }));

      if (append) {
        this._items.update((prev) => [...prev, ...mapped]);
      } else {
        this._items.set(mapped);
      }

      this._totalCount.set(count ?? mapped.length);
      this._page.set(page);
      this._hasMore.set((count ?? 0) > (page + 1) * this.PAGE_SIZE);
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to load students.'));
    } finally {
      this._loading.set(false);
      this._loadingMore.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (this._loadingMore() || !this._hasMore()) return;
    await this.load(this._page() + 1, true);
  }

  async create(dto: CreateStudentDto, classMeta?: { name: string; section: string; academic_year: string }): Promise<Student | null> {
    if (this._saving()) return null;
    this._saving.set(true);

    try {
      const trimmedName = dto.full_name.trim();
      const trimmedPhone = dto.phone ? dto.phone.trim() : null;
      const trimmedGName = dto.guardian_name ? dto.guardian_name.trim() : null;
      const trimmedGPhone = dto.guardian_phone ? dto.guardian_phone.trim() : null;

      const { data, error } = await this.supabase.client
        .from('students')
        .insert({
          full_name: trimmedName,
          class_id: dto.class_id,
          roll_no: Number(dto.roll_no),
          phone: trimmedPhone,
          guardian_name: trimmedGName,
          guardian_phone: trimmedGPhone,
          is_active: true,
        })
        .select('id, class_id, roll_no, full_name, phone, guardian_name, guardian_phone, is_active, created_at')
        .single();

      if (error) throw error;

      const created: Student = {
        id: data.id,
        class_id: data.class_id,
        roll_no: data.roll_no,
        full_name: data.full_name,
        phone: data.phone,
        guardian_name: data.guardian_name,
        guardian_phone: data.guardian_phone,
        is_active: data.is_active,
        created_at: data.created_at,
        class_name: classMeta?.name ?? null,
        class_section: classMeta?.section ?? null,
        class_academic_year: classMeta?.academic_year ?? null,
      };

      // Add locally to items list
      this._items.update((prev) => [created, ...prev]);
      this._totalCount.update((cnt) => cnt + 1);

      this.toast.showSuccess(`Student "${created.full_name}" registered successfully.`);
      return created;
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to create student record.'));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async update(
    id: string,
    dto: UpdateStudentDto,
    classMeta?: { name: string; section: string; academic_year: string }
  ): Promise<boolean> {
    if (this._saving()) return false;
    this._saving.set(true);

    try {
      const trimmedName = dto.full_name.trim();
      const trimmedPhone = dto.phone ? dto.phone.trim() : null;
      const trimmedGName = dto.guardian_name ? dto.guardian_name.trim() : null;
      const trimmedGPhone = dto.guardian_phone ? dto.guardian_phone.trim() : null;

      const { error } = await this.supabase.client
        .from('students')
        .update({
          full_name: trimmedName,
          class_id: dto.class_id,
          roll_no: Number(dto.roll_no),
          phone: trimmedPhone,
          guardian_name: trimmedGName,
          guardian_phone: trimmedGPhone,
        })
        .eq('id', id);

      if (error) throw error;

      // Update signal locally
      this._items.update((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                full_name: trimmedName,
                class_id: dto.class_id,
                roll_no: Number(dto.roll_no),
                phone: trimmedPhone,
                guardian_name: trimmedGName,
                guardian_phone: trimmedGPhone,
                ...(classMeta
                  ? {
                      class_name: classMeta.name,
                      class_section: classMeta.section,
                      class_academic_year: classMeta.academic_year,
                    }
                  : {}),
              }
            : s
        )
      );

      this.toast.showSuccess(`Student "${trimmedName}" updated successfully.`);
      return true;
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to update student.'));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async setActive(student: Student, isActive: boolean): Promise<boolean> {
    if (this._saving()) return false;
    this._saving.set(true);

    try {
      const { error } = await this.supabase.client
        .from('students')
        .update({ is_active: isActive })
        .eq('id', student.id);

      if (error) throw error;

      // Update signal locally
      this._items.update((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, is_active: isActive } : s))
      );

      const statusWord = isActive ? 'activated' : 'deactivated';
      this.toast.showSuccess(`Student "${student.full_name}" has been ${statusWord}.`);
      return true;
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to update student status.'));
      return false;
    } finally {
      this._saving.set(false);
    }
  }
}
