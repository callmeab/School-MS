import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../core/services/toast.service';
import { getFriendlyErrorMessage } from '../../core/utils/db-error';
import { CreateSubjectDto, Subject, UpdateSubjectDto } from '../../core/models';

@Injectable({
  providedIn: 'root',
})
export class SubjectsService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly toastService = inject(ToastService);

  private readonly _items = signal<Subject[]>([]);
  readonly items = this._items.asReadonly();

  private readonly _loading = signal<boolean>(false);
  readonly loading = this._loading.asReadonly();

  private readonly _saving = signal<boolean>(false);
  readonly saving = this._saving.asReadonly();

  async load(): Promise<void> {
    this._loading.set(true);
    try {
      const { data, error } = await this.supabaseService.client
        .from('subjects')
        .select('id, name, code, created_at, updated_at')
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      this._items.set((data as Subject[]) ?? []);
    } catch (err) {
      const message = getFriendlyErrorMessage(err, 'Failed to load subjects.');
      this.toastService.showError(message);
    } finally {
      this._loading.set(false);
    }
  }

  async create(dto: CreateSubjectDto): Promise<boolean> {
    this._saving.set(true);
    try {
      const payload = {
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
      };

      const { data, error } = await this.supabaseService.client
        .from('subjects')
        .insert(payload)
        .select('id, name, code, created_at, updated_at')
        .single();

      if (error) {
        throw error;
      }

      // Update signal locally instead of reloading the entire table
      const newSubject = data as Subject;
      this._items.update((list) =>
        [...list, newSubject].sort((a, b) => a.name.localeCompare(b.name))
      );

      this.toastService.showSuccess('Subject created successfully.');
      return true;
    } catch (err) {
      const message = getFriendlyErrorMessage(err, 'Failed to create subject.');
      this.toastService.showError(message);
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<boolean> {
    this._saving.set(true);
    try {
      const payload = {
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
      };

      const { data, error } = await this.supabaseService.client
        .from('subjects')
        .update(payload)
        .eq('id', id)
        .select('id, name, code, created_at, updated_at')
        .single();

      if (error) {
        throw error;
      }

      const updated = data as Subject;
      this._items.update((list) =>
        list
          .map((item) => (item.id === id ? updated : item))
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      this.toastService.showSuccess('Subject updated successfully.');
      return true;
    } catch (err) {
      const message = getFriendlyErrorMessage(err, 'Failed to update subject.');
      this.toastService.showError(message);
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async remove(id: string): Promise<boolean> {
    this._saving.set(true);
    try {
      const { error } = await this.supabaseService.client
        .from('subjects')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      // Remove locally from signal
      this._items.update((list) => list.filter((item) => item.id !== id));
      this.toastService.showSuccess('Subject deleted successfully.');
      return true;
    } catch (err) {
      const message = getFriendlyErrorMessage(err, 'Failed to delete subject.');
      this.toastService.showError(message);
      return false;
    } finally {
      this._saving.set(false);
    }
  }
}
