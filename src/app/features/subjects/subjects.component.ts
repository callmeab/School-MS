import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SubjectsService } from './subjects.service';
import { Subject } from '../../core/models';
import {
  PageHeaderComponent,
  EmptyStateComponent,
  LoadingSpinnerComponent,
  DialogComponent,
  ConfirmDialogComponent,
  IconComponent,
} from '../../shared/components';

@Component({
  selector: 'app-subjects',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PageHeaderComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    DialogComponent,
    ConfirmDialogComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './subjects.component.html',
  styleUrl: './subjects.component.scss',
})
export class SubjectsComponent implements OnInit {
  protected readonly subjectsService = inject(SubjectsService);
  private readonly fb = inject(FormBuilder);

  // Search filter
  protected readonly searchTerm = signal<string>('');

  // Dialog states
  protected readonly isFormDialogOpen = signal<boolean>(false);
  protected readonly editingSubject = signal<Subject | null>(null);

  protected readonly isDeleteDialogOpen = signal<boolean>(false);
  protected readonly targetDeleteSubject = signal<Subject | null>(null);

  // Form
  protected readonly subjectForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    code: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(20)]],
  });

  // Filtered subjects computed signal
  protected readonly filteredSubjects = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const items = this.subjectsService.items();
    if (!query) return items;

    return items.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.code.toLowerCase().includes(query)
    );
  });

  ngOnInit(): void {
    this.subjectsService.load();
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  openAddDialog(): void {
    this.editingSubject.set(null);
    this.subjectForm.reset({ name: '', code: '' });
    this.isFormDialogOpen.set(true);
  }

  openEditDialog(subject: Subject): void {
    this.editingSubject.set(subject);
    this.subjectForm.reset({
      name: subject.name,
      code: subject.code,
    });
    this.isFormDialogOpen.set(true);
  }

  closeFormDialog(): void {
    if (!this.subjectsService.saving()) {
      this.isFormDialogOpen.set(false);
      this.editingSubject.set(null);
    }
  }

  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const upper = input.value.toUpperCase();
    this.subjectForm.patchValue({ code: upper }, { emitEvent: false });
  }

  async saveSubject(): Promise<void> {
    if (this.subjectForm.invalid || this.subjectsService.saving()) {
      this.subjectForm.markAllAsTouched();
      return;
    }

    const { name, code } = this.subjectForm.value;
    const dto = {
      name: (name ?? '').trim(),
      code: (code ?? '').trim().toUpperCase(),
    };

    const editing = this.editingSubject();
    let success = false;

    if (editing) {
      success = await this.subjectsService.update(editing.id, dto);
    } else {
      success = await this.subjectsService.create(dto);
    }

    if (success) {
      this.closeFormDialog();
    }
  }

  confirmDelete(subject: Subject): void {
    this.targetDeleteSubject.set(subject);
    this.isDeleteDialogOpen.set(true);
  }

  cancelDelete(): void {
    if (!this.subjectsService.saving()) {
      this.isDeleteDialogOpen.set(false);
      this.targetDeleteSubject.set(null);
    }
  }

  async executeDelete(): Promise<void> {
    const target = this.targetDeleteSubject();
    if (!target) return;

    const success = await this.subjectsService.remove(target.id);
    if (success) {
      this.isDeleteDialogOpen.set(false);
      this.targetDeleteSubject.set(null);
    }
  }
}
