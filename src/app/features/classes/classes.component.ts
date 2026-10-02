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
import { ClassesService } from './classes.service';
import { SubjectsService } from '../subjects/subjects.service';
import { AuthService } from '../../core/services/auth.service';
import { SchoolClass, Subject } from '../../core/models';
import {
  PageHeaderComponent,
  EmptyStateComponent,
  LoadingSpinnerComponent,
  DialogComponent,
  ConfirmDialogComponent,
  IconComponent,
} from '../../shared/components';

import { TeachersService } from '../teachers/teachers.service';

@Component({
  selector: 'app-classes',
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
  templateUrl: './classes.component.html',
  styleUrl: './classes.component.scss',
})
export class ClassesComponent implements OnInit {
  protected readonly classesService = inject(ClassesService);
  protected readonly subjectsService = inject(SubjectsService);
  protected readonly teachersService = inject(TeachersService);
  protected readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  // Filters
  protected readonly searchTerm = signal<string>('');
  protected readonly selectedYear = signal<string>('ALL');

  // Dialog states
  protected readonly isFormDialogOpen = signal<boolean>(false);
  protected readonly editingClass = signal<SchoolClass | null>(null);

  protected readonly isDeleteDialogOpen = signal<boolean>(false);
  protected readonly targetDeleteClass = signal<SchoolClass | null>(null);

  // Manage Subjects Modal State
  protected readonly isManageSubjectsOpen = signal<boolean>(false);
  protected readonly activeClassForSubjects = signal<SchoolClass | null>(null);
  protected readonly selectedSubjectToAdd = signal<string>('');

  // Class Form
  protected readonly classForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(50)]],
    section: ['', [Validators.required, Validators.maxLength(20)]],
    academic_year: ['2026-2027', [Validators.required, Validators.maxLength(20)]],
  });

  // Unique academic years for filter dropdown
  protected readonly academicYears = computed(() => {
    const years = new Set(this.classesService.items().map((c) => c.academic_year));
    return Array.from(years).sort().reverse();
  });

  // Filtered classes list
  protected readonly filteredClasses = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const year = this.selectedYear();
    const items = this.classesService.items();

    return items.filter((c) => {
      const matchesYear = year === 'ALL' || c.academic_year === year;
      const matchesQuery =
        !query ||
        c.name.toLowerCase().includes(query) ||
        c.section.toLowerCase().includes(query) ||
        c.academic_year.toLowerCase().includes(query);

      return matchesYear && matchesQuery;
    });
  });

  // Subjects available to assign (excluding already assigned subjects)
  protected readonly availableSubjects = computed<Subject[]>(() => {
    const assignedIds = new Set(
      this.classesService.classSubjects().map((cs) => cs.subject_id)
    );
    return this.subjectsService
      .items()
      .filter((s) => !assignedIds.has(s.id));
  });

  ngOnInit(): void {
    this.classesService.load();
    this.subjectsService.load();
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }

  onYearChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedYear.set(select.value);
  }

  openAddDialog(): void {
    if (!this.authService.isAdmin()) return;
    this.editingClass.set(null);
    this.classForm.reset({
      name: '',
      section: '',
      academic_year: this.selectedYear() !== 'ALL' ? this.selectedYear() : '2026-2027',
    });
    this.isFormDialogOpen.set(true);
  }

  openEditDialog(cls: SchoolClass): void {
    if (!this.authService.isAdmin()) return;
    this.editingClass.set(cls);
    this.classForm.reset({
      name: cls.name,
      section: cls.section,
      academic_year: cls.academic_year,
    });
    this.isFormDialogOpen.set(true);
  }

  closeFormDialog(): void {
    if (!this.classesService.saving()) {
      this.isFormDialogOpen.set(false);
      this.editingClass.set(null);
    }
  }

  async saveClass(): Promise<void> {
    if (this.classForm.invalid || this.classesService.saving()) {
      this.classForm.markAllAsTouched();
      return;
    }

    const { name, section, academic_year } = this.classForm.value;
    const dto = {
      name: (name ?? '').trim(),
      section: (section ?? '').trim(),
      academic_year: (academic_year ?? '').trim(),
    };

    const editing = this.editingClass();
    let success = false;

    if (editing) {
      success = await this.classesService.update(editing.id, dto);
    } else {
      success = await this.classesService.create(dto);
    }

    if (success) {
      this.closeFormDialog();
    }
  }

  confirmDelete(cls: SchoolClass): void {
    if (!this.authService.isAdmin()) return;
    this.targetDeleteClass.set(cls);
    this.isDeleteDialogOpen.set(true);
  }

  cancelDelete(): void {
    if (!this.classesService.saving()) {
      this.isDeleteDialogOpen.set(false);
      this.targetDeleteClass.set(null);
    }
  }

  async executeDelete(): Promise<void> {
    const target = this.targetDeleteClass();
    if (!target) return;

    const success = await this.classesService.remove(target.id);
    if (success) {
      this.isDeleteDialogOpen.set(false);
      this.targetDeleteClass.set(null);
    }
  }

  // --- Manage Subjects Logic ---
  openManageSubjects(cls: SchoolClass): void {
    this.activeClassForSubjects.set(cls);
    this.selectedSubjectToAdd.set('');
    this.classesService.loadClassSubjects(cls.id);
    if (this.authService.isAdmin()) {
      void this.teachersService.load();
    }
    this.isManageSubjectsOpen.set(true);
  }

  async onTeacherAssignChange(classSubjectId: string, event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const teacherId = select.value ? select.value : null;
    const teacher = teacherId ? this.teachersService.items().find((t) => t.id === teacherId) : null;

    await this.classesService.assignTeacherToSubject(
      classSubjectId,
      teacherId,
      teacher?.full_name,
      teacher?.employee_code
    );
  }

  closeManageSubjects(): void {
    if (!this.classesService.saving()) {
      this.isManageSubjectsOpen.set(false);
      this.activeClassForSubjects.set(null);
    }
  }

  onSubjectSelectChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedSubjectToAdd.set(select.value);
  }

  async addSubject(): Promise<void> {
    const activeClass = this.activeClassForSubjects();
    const subjectId = this.selectedSubjectToAdd();
    if (!activeClass || !subjectId || this.classesService.saving()) return;

    const subject = this.subjectsService.items().find((s) => s.id === subjectId);
    if (!subject) return;

    const success = await this.classesService.addSubjectToClass(
      activeClass.id,
      subject.id,
      subject.name,
      subject.code
    );

    if (success) {
      this.selectedSubjectToAdd.set('');
    }
  }

  async removeSubject(classSubjectId: string): Promise<void> {
    const activeClass = this.activeClassForSubjects();
    if (!activeClass || this.classesService.saving()) return;

    await this.classesService.removeSubjectFromClass(classSubjectId, activeClass.id);
  }
}
