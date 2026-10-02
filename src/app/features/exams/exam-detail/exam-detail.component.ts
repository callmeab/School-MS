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
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ExamsService } from '../exams.service';
import { AuthService } from '../../../core/services/auth.service';
import { ExamPaper, Subject } from '../../../core/models';
import { SCHOOL_CONFIG } from '../../../core/config/school.config';
import {
  areTimesOverlapping,
  formatDateDisplay,
  formatTime12Hour,
} from '../../../core/utils/date';
import {
  ConfirmDialogComponent,
  DialogComponent,
  EmptyStateComponent,
  LoadingSpinnerComponent,
} from '../../../shared/components';

@Component({
  selector: 'app-exam-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    EmptyStateComponent,
    LoadingSpinnerComponent,
    DialogComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './exam-detail.component.html',
  styleUrl: './exam-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly examsService = inject(ExamsService);
  readonly authService = inject(AuthService);

  readonly schoolName = SCHOOL_CONFIG.name;

  readonly exam = this.examsService.currentExam;
  readonly papers = this.examsService.papers;
  readonly classSubjects = this.examsService.classSubjects;
  readonly loading = this.examsService.loadingDetail;
  readonly savingPaper = this.examsService.savingPaper;

  // Dialog State Signals for Paper
  readonly showPaperDialog = signal<boolean>(false);
  readonly editingPaper = signal<ExamPaper | null>(null);
  readonly targetDeletePaper = signal<ExamPaper | null>(null);

  // Paper Form Fields
  readonly formSubjectId = signal<string>('');
  readonly formPaperDate = signal<string>('');
  readonly formStartTime = signal<string>('');
  readonly formEndTime = signal<string>('');
  readonly formRoom = signal<string>('');
  readonly formTotalMarks = signal<number>(100);
  readonly formPaperError = signal<string | null>(null);

  // Edit Exam Dialog State
  readonly showEditExamDialog = signal<boolean>(false);
  readonly formExamTitle = signal<string>('');
  readonly formExamStartDate = signal<string>('');
  readonly formExamEndDate = signal<string>('');
  readonly formExamError = signal<string | null>(null);

  // Available subjects for current paper form
  readonly availableSubjects = computed<Subject[]>(() => {
    const all = this.classSubjects();
    const existingPapers = this.papers();
    const current = this.editingPaper();

    return all.filter((s) => {
      if (current && current.subject_id === s.id) {
        return true;
      }
      return !existingPapers.some((p) => p.subject_id === s.id);
    });
  });

  // Dynamic overlap warning inside paper dialog
  readonly paperTimeOverlapWarning = computed<string | null>(() => {
    const date = this.formPaperDate();
    const start = this.formStartTime();
    const end = this.formEndTime();
    const current = this.editingPaper();

    if (!date || !start || !end || end <= start) return null;

    const clash = this.papers().find(
      (p) =>
        p.paper_date === date &&
        p.id !== current?.id &&
        areTimesOverlapping(p.start_time, p.end_time, start, end)
    );

    if (clash) {
      const clashName = clash.subject_name || 'Another Subject';
      const range = `${formatTime12Hour(clash.start_time)} to ${formatTime12Hour(clash.end_time)}`;
      return `Note: Paper for "${clashName}" is also scheduled on this date from ${range} (overlapping time).`;
    }

    return null;
  });

  // Papers scheduled outside current exam start_date..end_date
  readonly papersOutsideDateRange = computed<ExamPaper[]>(() => {
    const ex = this.exam();
    if (!ex) return [];
    return this.papers().filter(
      (p) => p.paper_date < ex.start_date || p.paper_date > ex.end_date
    );
  });

  // Check conflicts if admin updates exam date range in Edit Exam dialog
  readonly examDateChangeConflicts = computed<ExamPaper[]>(() => {
    const start = this.formExamStartDate();
    const end = this.formExamEndDate();
    if (!start || !end || end < start) return [];
    return this.papers().filter(
      (p) => p.paper_date < start || p.paper_date > end
    );
  });

  async ngOnInit(): Promise<void> {
    const examId = this.route.snapshot.paramMap.get('id');
    if (examId) {
      await this.examsService.loadExamDetail(examId);
    } else {
      this.router.navigate(['/exams']);
    }
  }

  // --- Display Formatting Helpers ---
  formatDate(dateStr: string): string {
    return formatDateDisplay(dateStr);
  }

  formatTimeRange(startTime: string, endTime: string): string {
    return `${formatTime12Hour(startTime)} – ${formatTime12Hour(endTime)}`;
  }

  printDateSheet(): void {
    window.print();
  }

  // --- Paper Add/Edit Dialog ---
  openAddPaperDialog(): void {
    const ex = this.exam();
    if (!ex) return;

    this.editingPaper.set(null);
    const available = this.availableSubjects();
    this.formSubjectId.set(available.length > 0 ? available[0].id : '');
    this.formPaperDate.set(ex.start_date);
    this.formStartTime.set('09:00');
    this.formEndTime.set('12:00');
    this.formRoom.set('');
    this.formTotalMarks.set(100);
    this.formPaperError.set(null);
    this.showPaperDialog.set(true);
  }

  openEditPaperDialog(paper: ExamPaper): void {
    this.editingPaper.set(paper);
    this.formSubjectId.set(paper.subject_id);
    this.formPaperDate.set(paper.paper_date);
    this.formStartTime.set(paper.start_time.substring(0, 5));
    this.formEndTime.set(paper.end_time.substring(0, 5));
    this.formRoom.set(paper.room || '');
    this.formTotalMarks.set(paper.total_marks);
    this.formPaperError.set(null);
    this.showPaperDialog.set(true);
  }

  closePaperDialog(): void {
    this.showPaperDialog.set(false);
    this.editingPaper.set(null);
    this.formPaperError.set(null);
  }

  async savePaper(): Promise<void> {
    const ex = this.exam();
    if (!ex) return;

    const subjectId = this.formSubjectId();
    const paperDate = this.formPaperDate();
    const startTime = this.formStartTime();
    const endTime = this.formEndTime();
    const room = this.formRoom().trim() || null;
    const totalMarks = Number(this.formTotalMarks());

    if (!subjectId) {
      this.formPaperError.set('Please select a subject.');
      return;
    }

    if (!paperDate) {
      this.formPaperError.set('Paper date is required.');
      return;
    }

    if (paperDate < ex.start_date || paperDate > ex.end_date) {
      this.formPaperError.set('Paper date must be between the exam start and end date.');
      return;
    }

    if (!startTime || !endTime) {
      this.formPaperError.set('Start time and end time are both required.');
      return;
    }

    if (endTime <= startTime) {
      this.formPaperError.set('End time must be after start time.');
      return;
    }

    if (!totalMarks || totalMarks <= 0) {
      this.formPaperError.set('Total marks must be a positive number greater than 0.');
      return;
    }

    this.formPaperError.set(null);
    const subjectMeta = this.classSubjects().find((s) => s.id === subjectId);

    const current = this.editingPaper();
    if (current) {
      const ok = await this.examsService.updatePaper(
        current.id,
        { subject_id: subjectId, paper_date: paperDate, start_time: startTime, end_time: endTime, room, total_marks: totalMarks },
        subjectMeta
      );
      if (ok) this.closePaperDialog();
    } else {
      const created = await this.examsService.createPaper(
        { exam_id: ex.id, subject_id: subjectId, paper_date: paperDate, start_time: startTime, end_time: endTime, room, total_marks: totalMarks },
        subjectMeta
      );
      if (created) this.closePaperDialog();
    }
  }

  // --- Delete Paper ---
  confirmDeletePaper(paper: ExamPaper): void {
    this.targetDeletePaper.set(paper);
  }

  cancelDeletePaper(): void {
    this.targetDeletePaper.set(null);
  }

  async executeDeletePaper(): Promise<void> {
    const target = this.targetDeletePaper();
    const ex = this.exam();
    if (!target || !ex) return;

    const ok = await this.examsService.deletePaper(target.id, ex.id, target.subject_name);
    if (ok) {
      this.targetDeletePaper.set(null);
    }
  }

  // --- Edit Exam from Detail View ---
  openEditExamDialog(): void {
    const ex = this.exam();
    if (!ex) return;

    this.formExamTitle.set(ex.title);
    this.formExamStartDate.set(ex.start_date);
    this.formExamEndDate.set(ex.end_date);
    this.formExamError.set(null);
    this.showEditExamDialog.set(true);
  }

  closeEditExamDialog(): void {
    this.showEditExamDialog.set(false);
    this.formExamError.set(null);
  }

  async saveExamDates(): Promise<void> {
    const ex = this.exam();
    if (!ex) return;

    const title = this.formExamTitle().trim();
    const startDate = this.formExamStartDate();
    const endDate = this.formExamEndDate();

    if (!title) {
      this.formExamError.set('Exam title is required.');
      return;
    }

    if (!startDate || !endDate) {
      this.formExamError.set('Start date and end date are both required.');
      return;
    }

    if (endDate < startDate) {
      this.formExamError.set('End date must be on or after start date.');
      return;
    }

    const conflicts = this.examDateChangeConflicts();
    if (conflicts.length > 0) {
      this.formExamError.set(
        `Cannot save: ${conflicts.length} paper(s) fall outside this new date range. Please reschedule those papers first.`
      );
      return;
    }

    this.formExamError.set(null);
    const ok = await this.examsService.updateExam(ex.id, {
      title,
      class_id: ex.class_id,
      start_date: startDate,
      end_date: endDate,
    });

    if (ok) {
      this.closeEditExamDialog();
    }
  }
}
