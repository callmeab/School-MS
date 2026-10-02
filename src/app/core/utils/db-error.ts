/**
 * Friendly Database & Edge Function Error Mapper.
 * Converts technical PostgreSQL error codes and Edge Function responses into clear,
 * actionable messages for non-technical users. Never exposes raw technical database details.
 */
export function getFriendlyErrorMessage(error: unknown, fallbackMessage = 'An unexpected error occurred. Please try again.'): string {
  if (!error) {
    return fallbackMessage;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return mapMessageToFriendly(error, fallbackMessage);
  }

  // Handle error objects
  const errObj = error as {
    code?: string;
    message?: string;
    error?: string;
    details?: string;
    status?: number;
  };

  const code = errObj.code ?? '';
  const message = (errObj.error ?? errObj.message ?? '').trim();

  // 1. Postgres 23505: Unique constraint violation
  if (code === '23505' || message.includes('duplicate key') || message.includes('unique constraint')) {
    if (message.includes('uq_class_roll_no') || message.toLowerCase().includes('roll_no') || message.toLowerCase().includes('roll number')) {
      return 'Roll number is already used in this class. Please choose a different roll number.';
    }
    if (message.includes('employee_code') || message.toLowerCase().includes('employee code')) {
      return 'Employee code already exists. Please choose a unique employee code.';
    }
    if (message.toLowerCase().includes('email')) {
      return 'This email address is already registered in the system.';
    }
    if (message.includes('uq_class_section_year')) {
      return 'A class with this Name, Section, and Academic Year already exists.';
    }
    if (message.includes('uq_class_subject')) {
      return 'This subject is already assigned to this class.';
    }
    if (message.includes('uq_exam_subject') || (message.includes('exam_papers') && message.includes('subject_id'))) {
      return "This subject is already in this exam's schedule.";
    }
    return 'This record already exists. Please verify the information and try again.';
  }

  // 2. Postgres 23503: Foreign key violation
  if (code === '23503' || message.includes('foreign key constraint') || message.includes('is still referenced')) {
    return 'Cannot delete: it is being used elsewhere (students, attendance, subjects, or exams).';
  }

  // 3. Postgres 42501: Insufficient privilege / RLS / Admin restriction
  if (
    code === '42501' ||
    message.toLowerCase().includes('permission') ||
    message.toLowerCase().includes('unauthorized') ||
    message.toLowerCase().includes('forbidden') ||
    message.toLowerCase().includes('row-level security') ||
    message.toLowerCase().includes('violates row-level security')
  ) {
    if (
      message.toLowerCase().includes('attendance') ||
      message.toLowerCase().includes('student_attendance') ||
      message.toLowerCase().includes('teacher_attendance')
    ) {
      return 'You are not allowed to mark attendance for this class or date.';
    }
    return "You don't have permission to perform this action.";
  }

  // 4. Postgres 23514: Check constraint violation
  if (code === '23514' || message.includes('check constraint')) {
    if (message.includes('roll_no')) {
      return 'Roll number must be a positive integer greater than 0.';
    }
    if (message.includes('chk_paper_times') || message.includes('end_time > start_time') || message.includes('end_time')) {
      return 'End time must be after start time.';
    }
    if (message.includes('total_marks') || message.includes('chk_total_marks')) {
      return 'Total marks must be a positive number greater than 0.';
    }
    if (message.includes('chk_exam_dates') || message.includes('end_date >= start_date') || message.includes('end_date')) {
      return 'End date must be on or after start date.';
    }
    return 'One or more fields do not meet the required format or value constraints.';
  }

  // 5. Edge Function, Triggers & Business Logic messages
  if (message) {
    return mapMessageToFriendly(message, fallbackMessage);
  }

  return fallbackMessage;
}

function mapMessageToFriendly(msg: string, fallback: string): string {
  const lower = msg.toLowerCase();

  if (lower.includes('paper date must be within the exam dates') || (lower.includes('paper date') && lower.includes('exam dates'))) {
    return 'Paper date must be between the exam start and end date.';
  }
  if (lower.includes('uq_exam_subject') || (lower.includes('subject') && lower.includes('already') && lower.includes('exam'))) {
    return "This subject is already in this exam's schedule.";
  }
  if (lower.includes('chk_paper_times') || lower.includes('end time must be after start time')) {
    return 'End time must be after start time.';
  }
  if (lower.includes('chk_exam_dates') || lower.includes('end date must be on or after start date')) {
    return 'End date must be on or after start date.';
  }
  if (lower.includes('total_marks') && lower.includes('greater than 0')) {
    return 'Total marks must be a positive number greater than 0.';
  }
  if (lower.includes('roll number') || lower.includes('roll_no')) {
    return 'Roll number is already used in this class. Please choose a different roll number.';
  }
  if (lower.includes('employee code') || lower.includes('employee_code')) {
    return 'Employee code already exists. Please choose a different employee code.';
  }
  if (lower.includes('already registered') || (lower.includes('email') && lower.includes('exists'))) {
    return 'This email address is already registered in the system.';
  }
  if (lower.includes('cannot deactivate your own') || lower.includes('own administrator account')) {
    return 'You cannot deactivate your own administrator account.';
  }
  if (lower.includes('administrator accounts')) {
    return 'Cannot modify administrator accounts via this panel.';
  }
  if (lower.includes('password must be at least 8')) {
    return 'Password must be at least 8 characters long.';
  }
  if (lower.includes('invalid or expired session')) {
    return 'Your session has expired. Please log in again.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Network connection error. Please verify your internet and try again.';
  }

  // If the message is already a clean sentence from our Edge Function, return it
  if (!msg.includes('{') && !msg.includes('Error:') && !msg.includes('pg_') && msg.length < 150) {
    return msg;
  }

  return fallback;
}
