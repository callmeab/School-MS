import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Student } from '../../core/models';
import { StudentsService } from './students.service';
import { ClassesService } from '../classes/classes.service';
import { AuthService } from '../../core/services/auth.service';
import {
  ConfirmDialogComponent,
  DialogComponent,
  EmptyStateComponent,
  LoadingSpinnerComponent,
  PageHeaderComponent,
} from '../../shared/components';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    DialogComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './students.component.html',
  styleUrl: './students.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentsComponent implements OnInit {
  protected readonly studentsService = inject(StudentsService);
  protected readonly classesService = inject(ClassesService);
  private readonly auth = inject(AuthService);

  readonly isAdmin = this.auth.isAdmin;

  // Filter signals
  readonly searchQuery = signal<string>('');
  readonly selectedClassId = signal<string>('all');
  readonly selectedStatus = signal<'all' | 'active' | 'inactive'>('all');

  // Dialog signals
  readonly isCreateDialogOpen = signal<boolean>(false);
  readonly isEditDialogOpen = signal<boolean>(false);
  readonly isStatusConfirmOpen = signal<boolean>(false);

  // Selected student & status state
  readonly selectedStudent = signal<Student | null>(null);
  readonly targetStatusAction = signal<boolean>(true); // true = activate, false = deactivate

  // Student Form (shared for Create and Edit)
  readonly studentForm = new FormGroup({
    full_name: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    class_id: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    roll_no: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(1)],
    }),
    phone: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(20)],
    }),
    guardian_name: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    guardian_phone: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(20)],
    }),
  });

  readonly filteredStudents = computed(() => {
    const list = this.studentsService.items();
    const query = this.searchQuery().trim().toLowerCase();
    const classId = this.selectedClassId();
    const status = this.selectedStatus();

    return list.filter((s) => {
      const matchesSearch =
        !query ||
        s.full_name.toLowerCase().includes(query) ||
        String(s.roll_no).includes(query) ||
        (s.guardian_phone && s.guardian_phone.includes(query)) ||
        (s.class_name && s.class_name.toLowerCase().includes(query));

      const matchesClass = classId === 'all' || s.class_id === classId;

      const matchesStatus =
        status === 'all' ||
        (status === 'active' && s.is_active) ||
        (status === 'inactive' && !s.is_active);

      return matchesSearch && matchesClass && matchesStatus;
    });
  });

  ngOnInit(): void {
    void this.studentsService.load();
    void this.classesService.load();
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  onClassFilterChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedClassId.set(select.value);
  }

  onStatusFilterChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedStatus.set(select.value as 'all' | 'active' | 'inactive');
  }

  async onLoadMore(): Promise<void> {
    await this.studentsService.loadMore();
  }

  // --- Add Student Modal ---
  openCreateDialog(): void {
    if (!this.isAdmin()) return;
    this.selectedStudent.set(null);
    this.studentForm.reset({
      full_name: '',
      class_id: '',
      roll_no: null,
      phone: '',
      guardian_name: '',
      guardian_phone: '',
    });
    this.isCreateDialogOpen.set(true);
  }

  closeCreateDialog(): void {
    this.isCreateDialogOpen.set(false);
    this.studentForm.reset();
  }

  async onCreateSubmit(): Promise<void> {
    if (this.studentForm.invalid || this.studentsService.saving()) {
      this.studentForm.markAllAsTouched();
      return;
    }

    const val = this.studentForm.getRawValue();
    const selectedClass = this.classesService.items().find((c) => c.id === val.class_id);

    const created = await this.studentsService.create(
      {
        full_name: val.full_name,
        class_id: val.class_id,
        roll_no: Number(val.roll_no),
        phone: val.phone || null,
        guardian_name: val.guardian_name || null,
        guardian_phone: val.guardian_phone || null,
      },
      selectedClass
        ? {
            name: selectedClass.name,
            section: selectedClass.section,
            academic_year: selectedClass.academic_year,
          }
        : undefined
    );

    if (created) {
      this.closeCreateDialog();
    }
  }

  // --- Edit Student Modal ---
  openEditDialog(student: Student): void {
    if (!this.isAdmin()) return;
    this.selectedStudent.set(student);
    this.studentForm.setValue({
      full_name: student.full_name,
      class_id: student.class_id ?? '',
      roll_no: student.roll_no,
      phone: student.phone ?? '',
      guardian_name: student.guardian_name ?? '',
      guardian_phone: student.guardian_phone ?? '',
    });
    this.isEditDialogOpen.set(true);
  }

  closeEditDialog(): void {
    this.isEditDialogOpen.set(false);
    this.selectedStudent.set(null);
    this.studentForm.reset();
  }

  async onEditSubmit(): Promise<void> {
    const current = this.selectedStudent();
    if (!current || this.studentForm.invalid || this.studentsService.saving()) {
      this.studentForm.markAllAsTouched();
      return;
    }

    const val = this.studentForm.getRawValue();
    const selectedClass = this.classesService.items().find((c) => c.id === val.class_id);

    const success = await this.studentsService.update(
      current.id,
      {
        full_name: val.full_name,
        class_id: val.class_id,
        roll_no: Number(val.roll_no),
        phone: val.phone || null,
        guardian_name: val.guardian_name || null,
        guardian_phone: val.guardian_phone || null,
      },
      selectedClass
        ? {
            name: selectedClass.name,
            section: selectedClass.section,
            academic_year: selectedClass.academic_year,
          }
        : undefined
    );

    if (success) {
      this.closeEditDialog();
    }
  }

  // --- Deactivate / Activate Confirmation Modal ---
  openStatusConfirmDialog(student: Student, targetActive: boolean): void {
    if (!this.isAdmin()) return;
    this.selectedStudent.set(student);
    this.targetStatusAction.set(targetActive);
    this.isStatusConfirmOpen.set(true);
  }

  closeStatusConfirmDialog(): void {
    this.isStatusConfirmOpen.set(false);
    this.selectedStudent.set(null);
  }

  async onConfirmStatusChange(): Promise<void> {
    const current = this.selectedStudent();
    if (!current || this.studentsService.saving()) return;

    const success = await this.studentsService.setActive(current, this.targetStatusAction());
    if (success) {
      this.closeStatusConfirmDialog();
    }
  }
}
