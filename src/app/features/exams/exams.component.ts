import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ExamsService } from './exams.service';
import { AuthService } from '../../core/services/auth.service';
import { Exam, SchoolClass } from '../../core/models';
import { formatDateDisplay } from '../../core/utils/date';
import {
  ConfirmDialogComponent,
  DialogComponent,
  EmptyStateComponent,
  LoadingSpinnerComponent,
  PageHeaderComponent,
} from '../../shared/components';

@Component({
  selector: 'app-exams',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    PageHeaderComponent,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    DialogComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './exams.component.html',
  styleUrl: './exams.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamsComponent implements OnInit {
  readonly examsService = inject(ExamsService);
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly items = this.examsService.items;
  readonly loading = this.examsService.loading;
  readonly saving = this.examsService.saving;
  readonly classes = this.examsService.classes;

  // Search & Filter Signals
  readonly searchTerm = signal<string>('');
  readonly selectedClassId = signal<string>('ALL');
  readonly selectedStatus = signal<string>('ALL');

  // Dialog State Signals
  readonly showFormDialog = signal<boolean>(false);
  readonly editingExam = signal<Exam | null>(null);
  readonly targetDeleteExam = signal<Exam | null>(null);

  // Form Fields
  readonly formTitle = signal<string>('');
  readonly formClassId = signal<string>('');
  readonly formStartDate = signal<string>('');
  readonly formEndDate = signal<string>('');
  readonly formError = signal<string | null>(null);

  // Filtered and Sorted Exams
  readonly filteredExams = computed(() => {
    let list = this.items();
    const term = this.searchTerm().trim().toLowerCase();
    const classId = this.selectedClassId();
    const status = this.selectedStatus();

    if (term) {
      list = list.filter((e) => e.title.toLowerCase().includes(term));
    }

    if (classId !== 'ALL') {
      list = list.filter((e) => e.class_id === classId);
    }

    if (status !== 'ALL') {
      list = list.filter((e) => e.status === status);
    }

    return list;
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.examsService.loadClasses(),
      this.examsService.loadExams(),
    ]);
  }

  // --- Filtering Handlers ---
  onSearchChange(term: string): void {
    this.searchTerm.set(term);
  }

  onClassFilterChange(classId: string): void {
    this.selectedClassId.set(classId);
  }

  onStatusFilterChange(status: string): void {
    this.selectedStatus.set(status);
  }

  // --- Navigation ---
  viewSchedule(examId: string): void {
    this.router.navigate(['/exams', examId]);
  }

  // --- Date Range Display ---
  formatDateRange(startDate: string, endDate: string): string {
    return `${formatDateDisplay(startDate)} – ${formatDateDisplay(endDate)}`;
  }

  // --- Create / Edit Dialog ---
  openCreateDialog(): void {
    this.editingExam.set(null);
    this.formTitle.set('');
    this.formClassId.set(this.classes().length > 0 ? this.classes()[0].id : '');
    this.formStartDate.set('');
    this.formEndDate.set('');
    this.formError.set(null);
    this.showFormDialog.set(true);
  }

  openEditDialog(exam: Exam, event?: Event): void {
    if (event) event.stopPropagation();
    this.editingExam.set(exam);
    this.formTitle.set(exam.title);
    this.formClassId.set(exam.class_id);
    this.formStartDate.set(exam.start_date);
    this.formEndDate.set(exam.end_date);
    this.formError.set(null);
    this.showFormDialog.set(true);
  }

  closeFormDialog(): void {
    this.showFormDialog.set(false);
    this.editingExam.set(null);
    this.formError.set(null);
  }

  async saveExam(): Promise<void> {
    const title = this.formTitle().trim();
    const classId = this.formClassId();
    const startDate = this.formStartDate();
    const endDate = this.formEndDate();

    if (!title) {
      this.formError.set('Exam title is required.');
      return;
    }

    if (!classId) {
      this.formError.set('Please select a class for this examination.');
      return;
    }

    if (!startDate || !endDate) {
      this.formError.set('Start date and end date are both required.');
      return;
    }

    if (endDate < startDate) {
      this.formError.set('End date must be on or after start date.');
      return;
    }

    this.formError.set(null);
    const classMeta = this.classes().find((c) => c.id === classId);

    const exam = this.editingExam();
    if (exam) {
      const ok = await this.examsService.updateExam(
        exam.id,
        { title, class_id: classId, start_date: startDate, end_date: endDate },
        classMeta
      );
      if (ok) this.closeFormDialog();
    } else {
      const created = await this.examsService.createExam(
        { title, class_id: classId, start_date: startDate, end_date: endDate },
        classMeta
      );
      if (created) this.closeFormDialog();
    }
  }

  // --- Delete Handling ---
  confirmDelete(exam: Exam, event?: Event): void {
    if (event) event.stopPropagation();
    this.targetDeleteExam.set(exam);
  }

  cancelDelete(): void {
    this.targetDeleteExam.set(null);
  }

  async executeDelete(): Promise<void> {
    const target = this.targetDeleteExam();
    if (!target) return;
    const ok = await this.examsService.deleteExam(target.id, target.title);
    if (ok) {
      this.targetDeleteExam.set(null);
    }
  }
}
