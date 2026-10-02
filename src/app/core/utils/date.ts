/**
 * Safe local date utility functions.
 * CRITICAL: NEVER use toISOString() for calendar dates to avoid timezone UTC bugs.
 */

/**
 * Formats a Date object into 'YYYY-MM-DD' using local system time.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date formatted as 'YYYY-MM-DD' from local time.
 */
export function getTodayDateString(): string {
  return getLocalDateString(new Date());
}

/**
 * Safely adds or subtracts days from a 'YYYY-MM-DD' string in local time.
 */
export function addDays(dateStr: string, days: number): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return dateStr;
  }
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
}

/**
 * Formats a 'YYYY-MM-DD' string for user-friendly display (e.g. 'Mon, 5 Oct 2026').
 */
export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Returns the current month formatted as 'YYYY-MM' from local time.
 */
export function getMonthDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Formats a 'YYYY-MM' string for display (e.g. 'October 2026').
 */
export function formatMonthDisplay(monthStr: string): string {
  if (!monthStr) return '';
  const parts = monthStr.split('-').map(Number);
  if (parts.length < 2 || parts.some(isNaN)) return monthStr;
  const [year, month] = parts;
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Calculates start and end dates of a given 'YYYY-MM' month in 'YYYY-MM-DD' format.
 */
export function getMonthStartAndEnd(monthStr: string): { startDate: string; endDate: string } {
  const parts = monthStr.split('-').map(Number);
  const year = parts[0] || new Date().getFullYear();
  const month = parts[1] || new Date().getMonth() + 1;
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { startDate, endDate };
}

/**
 * Formats a time string (e.g. '09:00:00' or '14:30') into 12-hour format with AM/PM (e.g. '9:00 AM', '2:30 PM').
 */
export function formatTime12Hour(timeStr: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hour = parseInt(parts[0], 10);
  const minute = parts[1].padStart(2, '0');
  if (isNaN(hour)) return timeStr;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${ampm}`;
}

/**
 * Converts a time string 'HH:mm' or 'HH:mm:ss' to minutes from midnight.
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

/**
 * Determines whether two time intervals on the same day overlap.
 * Overlap condition: start1 < end2 AND end1 > start2.
 */
export function areTimesOverlapping(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  if (!start1 || !end1 || !start2 || !end2) return false;
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && e1 > s2;
}

export type ExamStatus = 'upcoming' | 'ongoing' | 'finished';

/**
 * Determines the status of an exam based on start_date, end_date and today's date.
 */
export function getExamStatus(
  startDate: string,
  endDate: string,
  today: string = getTodayDateString()
): ExamStatus {
  if (!startDate || !endDate) return 'upcoming';
  if (today < startDate) return 'upcoming';
  if (today > endDate) return 'finished';
  return 'ongoing';
}
