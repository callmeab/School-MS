import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { CreateTeacherDto, Teacher, UpdateTeacherDto } from '../../core/models';
import { getFriendlyErrorMessage } from '../../core/utils/db-error';

interface RawTeacherRow {
  id: string;
  profile_id: string;
  employee_code: string;
  qualification: string | null;
  joining_date: string;
  created_at: string;
  profiles: {
    full_name: string;
    phone: string | null;
    is_active: boolean;
  } | null;
}

@Injectable({
  providedIn: 'root',
})
export class TeachersService {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);

  private readonly _items = signal<Teacher[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _saving = signal<boolean>(false);

  readonly items = this._items.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly count = computed(() => this._items().length);

  readonly activeTeachers = computed(() =>
    this._items().filter((t) => t.is_active)
  );

  async load(): Promise<void> {
    this._loading.set(true);
    try {
      const { data, error } = await this.supabase.client
        .from('teachers')
        .select(`
          id,
          profile_id,
          employee_code,
          qualification,
          joining_date,
          created_at,
          profiles!inner (
            full_name,
            phone,
            is_active
          )
        `)
        .order('employee_code', { ascending: true });

      if (error) throw error;

      const raw = (data as unknown as RawTeacherRow[]) ?? [];
      const mapped: Teacher[] = raw.map((row) => ({
        id: row.id,
        profile_id: row.profile_id,
        employee_code: row.employee_code,
        qualification: row.qualification,
        joining_date: row.joining_date,
        created_at: row.created_at,
        full_name: row.profiles?.full_name ?? 'Unknown Teacher',
        phone: row.profiles?.phone ?? null,
        is_active: row.profiles?.is_active ?? true,
      }));

      this._items.set(mapped);
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to load teachers.'));
    } finally {
      this._loading.set(false);
    }
  }

  async create(dto: CreateTeacherDto): Promise<Teacher | null> {
    if (this._saving()) return null;
    this._saving.set(true);

    try {
      const { data, error } = await this.supabase.client.functions.invoke('admin-users', {
        body: {
          action: 'create_teacher',
          email: dto.email.trim().toLowerCase(),
          password: dto.password,
          full_name: dto.full_name.trim(),
          phone: dto.phone ? dto.phone.trim() : null,
          employee_code: dto.employee_code.trim().toUpperCase(),
          qualification: dto.qualification ? dto.qualification.trim() : null,
          joining_date: dto.joining_date,
        },
      });

      if (error) {
        // FunctionsHttpError might contain response body
        let msg = error.message;
        if ('context' in error && (error as any).context?.json) {
          const bodyJson = await (error as any).context.json();
          msg = bodyJson?.error || msg;
        }
        throw new Error(msg);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const created: Teacher = {
        id: data.data.id,
        profile_id: data.data.profile_id,
        employee_code: data.data.employee_code,
        qualification: data.data.qualification,
        joining_date: data.data.joining_date,
        created_at: data.data.created_at,
        full_name: data.data.full_name,
        phone: data.data.phone,
        is_active: data.data.is_active,
        email: data.data.email,
      };

      // Update signal locally
      this._items.update((prev) =>
        [...prev, created].sort((a, b) => a.full_name.localeCompare(b.full_name))
      );

      this.toast.showSuccess(data.message || `Teacher "${created.full_name}" registered successfully.`);
      return created;
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to create teacher account.'));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async update(id: string, profileId: string, dto: UpdateTeacherDto): Promise<boolean> {
    if (this._saving()) return false;
    this._saving.set(true);

    try {
      const trimmedName = dto.full_name.trim();
      const trimmedPhone = dto.phone ? dto.phone.trim() : null;
      const trimmedQual = dto.qualification ? dto.qualification.trim() : null;

      // Update profile
      const { error: profileErr } = await this.supabase.client
        .from('profiles')
        .update({
          full_name: trimmedName,
          phone: trimmedPhone,
        })
        .eq('id', profileId);

      if (profileErr) throw profileErr;

      // Update teacher specifics
      const { error: teacherErr } = await this.supabase.client
        .from('teachers')
        .update({
          qualification: trimmedQual,
          joining_date: dto.joining_date,
        })
        .eq('id', id);

      if (teacherErr) throw teacherErr;

      // Update signal locally
      this._items.update((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                full_name: trimmedName,
                phone: trimmedPhone,
                qualification: trimmedQual,
                joining_date: dto.joining_date,
              }
            : t
        )
      );

      this.toast.showSuccess(`Teacher "${trimmedName}" updated successfully.`);
      return true;
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to update teacher information.'));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async setActive(teacher: Teacher, isActive: boolean): Promise<boolean> {
    if (this._saving()) return false;
    this._saving.set(true);

    try {
      const { data, error } = await this.supabase.client.functions.invoke('admin-users', {
        body: {
          action: 'set_active',
          user_id: teacher.profile_id,
          is_active: isActive,
        },
      });

      if (error) {
        let msg = error.message;
        if ('context' in error && (error as any).context?.json) {
          const bodyJson = await (error as any).context.json();
          msg = bodyJson?.error || msg;
        }
        throw new Error(msg);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Update signal locally
      this._items.update((prev) =>
        prev.map((t) =>
          t.profile_id === teacher.profile_id ? { ...t, is_active: isActive } : t
        )
      );

      this.toast.showSuccess(data.message || `Account for "${teacher.full_name}" status updated.`);
      return true;
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to update account status.'));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async resetPassword(profileId: string, newPassword: string): Promise<boolean> {
    if (this._saving()) return false;
    this._saving.set(true);

    try {
      const { data, error } = await this.supabase.client.functions.invoke('admin-users', {
        body: {
          action: 'reset_password',
          user_id: profileId,
          password: newPassword,
        },
      });

      if (error) {
        let msg = error.message;
        if ('context' in error && (error as any).context?.json) {
          const bodyJson = await (error as any).context.json();
          msg = bodyJson?.error || msg;
        }
        throw new Error(msg);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      this.toast.showSuccess(data.message || 'Password updated successfully.');
      return true;
    } catch (err) {
      this.toast.showError(getFriendlyErrorMessage(err, 'Failed to reset password.'));
      return false;
    } finally {
      this._saving.set(false);
    }
  }
}
