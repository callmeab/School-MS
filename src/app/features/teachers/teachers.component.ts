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
import { Teacher } from '../../core/models';
import { TeachersService } from './teachers.service';
import {
  ConfirmDialogComponent,
  CredentialsDialogComponent,
  DialogComponent,
  EmptyStateComponent,
  LoadingSpinnerComponent,
  PageHeaderComponent,
  UserCredentials,
} from '../../shared/components';

@Component({
  selector: 'app-teachers',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    DialogComponent,
    ConfirmDialogComponent,
    CredentialsDialogComponent,
  ],
  templateUrl: './teachers.component.html',
  styleUrl: './teachers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeachersComponent implements OnInit {
  protected readonly teachersService = inject(TeachersService);

  readonly searchQuery = signal<string>('');
  readonly statusFilter = signal<'all' | 'active' | 'inactive'>('all');

  // Dialog toggles
  readonly isCreateDialogOpen = signal<boolean>(false);
  readonly isEditDialogOpen = signal<boolean>(false);
  readonly isResetPasswordOpen = signal<boolean>(false);
  readonly isStatusConfirmOpen = signal<boolean>(false);
  readonly isCredentialsOpen = signal<boolean>(false);

  // Selected records
  readonly selectedTeacher = signal<Teacher | null>(null);
  readonly targetStatusAction = signal<boolean>(true); // true = activate, false = deactivate
  readonly newlyCreatedCredentials = signal<UserCredentials | null>(null);

  // Password visibility signals
  readonly showCreatePassword = signal<boolean>(false);
  readonly showResetPassword = signal<boolean>(false);

  // Forms
  readonly createForm = new FormGroup({
    full_name: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    email: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
    phone: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(20)],
    }),
    employee_code: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(30)],
    }),
    qualification: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    joining_date: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  readonly editForm = new FormGroup({
    full_name: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    phone: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(20)],
    }),
    qualification: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    joining_date: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  readonly resetPasswordControl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(8)],
  });

  readonly filteredTeachers = computed(() => {
    const list = this.teachersService.items();
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();

    return list.filter((t) => {
      const matchesSearch =
        !query ||
        t.full_name.toLowerCase().includes(query) ||
        t.employee_code.toLowerCase().includes(query) ||
        (t.phone && t.phone.toLowerCase().includes(query));

      const matchesStatus =
        status === 'all' ||
        (status === 'active' && t.is_active) ||
        (status === 'inactive' && !t.is_active);

      return matchesSearch && matchesStatus;
    });
  });

  ngOnInit(): void {
    void this.teachersService.load();
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  onStatusFilterChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.statusFilter.set(select.value as 'all' | 'active' | 'inactive');
  }

  generateRandomPassword(forReset = false): void {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    let generated = '';
    for (let i = 0; i < 12; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    if (forReset) {
      this.resetPasswordControl.setValue(generated);
      this.showResetPassword.set(true);
    } else {
      this.createForm.controls.password.setValue(generated);
      this.showCreatePassword.set(true);
    }
  }

  // --- Create Modal ---
  openCreateDialog(): void {
    this.createForm.reset({
      full_name: '',
      email: '',
      password: '',
      phone: '',
      employee_code: '',
      qualification: '',
      joining_date: new Date().toISOString().split('T')[0],
    });
    this.generateRandomPassword(false);
    this.isCreateDialogOpen.set(true);
  }

  closeCreateDialog(): void {
    this.isCreateDialogOpen.set(false);
    this.createForm.reset();
  }

  async onCreateSubmit(): Promise<void> {
    if (this.createForm.invalid || this.teachersService.saving()) {
      this.createForm.markAllAsTouched();
      return;
    }

    const val = this.createForm.getRawValue();
    const created = await this.teachersService.create({
      full_name: val.full_name,
      email: val.email,
      password: val.password,
      phone: val.phone || null,
      employee_code: val.employee_code,
      qualification: val.qualification || null,
      joining_date: val.joining_date,
    });

    if (created) {
      this.closeCreateDialog();
      // Show credentials dialog once
      this.newlyCreatedCredentials.set({
        fullName: created.full_name,
        email: val.email.trim().toLowerCase(),
        password: val.password,
        role: 'teacher',
      });
      this.isCredentialsOpen.set(true);
    }
  }

  // --- Edit Modal ---
  openEditDialog(teacher: Teacher): void {
    this.selectedTeacher.set(teacher);
    this.editForm.setValue({
      full_name: teacher.full_name,
      phone: teacher.phone ?? '',
      qualification: teacher.qualification ?? '',
      joining_date: teacher.joining_date,
    });
    this.isEditDialogOpen.set(true);
  }

  closeEditDialog(): void {
    this.isEditDialogOpen.set(false);
    this.selectedTeacher.set(null);
    this.editForm.reset();
  }

  async onEditSubmit(): Promise<void> {
    const current = this.selectedTeacher();
    if (!current || this.editForm.invalid || this.teachersService.saving()) {
      this.editForm.markAllAsTouched();
      return;
    }

    const val = this.editForm.getRawValue();
    const success = await this.teachersService.update(current.id, current.profile_id, {
      full_name: val.full_name,
      phone: val.phone || null,
      qualification: val.qualification || null,
      joining_date: val.joining_date,
    });

    if (success) {
      this.closeEditDialog();
    }
  }

  // --- Reset Password Modal ---
  openResetPasswordDialog(teacher: Teacher): void {
    this.selectedTeacher.set(teacher);
    this.resetPasswordControl.reset('');
    this.generateRandomPassword(true);
    this.isResetPasswordOpen.set(true);
  }

  closeResetPasswordDialog(): void {
    this.isResetPasswordOpen.set(false);
    this.selectedTeacher.set(null);
    this.resetPasswordControl.reset();
  }

  async onResetPasswordSubmit(): Promise<void> {
    const current = this.selectedTeacher();
    if (!current || this.resetPasswordControl.invalid || this.teachersService.saving()) {
      this.resetPasswordControl.markAsTouched();
      return;
    }

    const newPass = this.resetPasswordControl.value;
    const success = await this.teachersService.resetPassword(current.profile_id, newPass);

    if (success) {
      this.closeResetPasswordDialog();
      // Show credentials dialog with the new password
      this.newlyCreatedCredentials.set({
        fullName: current.full_name,
        email: current.email || 'Registered teacher email',
        password: newPass,
        role: 'teacher',
      });
      this.isCredentialsOpen.set(true);
    }
  }

  // --- Deactivate / Activate Status Dialog ---
  openStatusConfirmDialog(teacher: Teacher, targetActive: boolean): void {
    this.selectedTeacher.set(teacher);
    this.targetStatusAction.set(targetActive);
    this.isStatusConfirmOpen.set(true);
  }

  closeStatusConfirmDialog(): void {
    this.isStatusConfirmOpen.set(false);
    this.selectedTeacher.set(null);
  }

  async onConfirmStatusChange(): Promise<void> {
    const current = this.selectedTeacher();
    if (!current || this.teachersService.saving()) return;

    const success = await this.teachersService.setActive(current, this.targetStatusAction());
    if (success) {
      this.closeStatusConfirmDialog();
    }
  }

  closeCredentialsDialog(): void {
    this.isCredentialsOpen.set(false);
    this.newlyCreatedCredentials.set(null);
  }
}
