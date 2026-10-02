import { describe, it, expect } from 'vitest';
import {
  addDays,
  areTimesOverlapping,
  formatDateDisplay,
  formatMonthDisplay,
  formatTime12Hour,
  getExamStatus,
  getLocalDateString,
  getMonthDateString,
  getMonthStartAndEnd,
  getTodayDateString,
} from './date';

describe('Date Utilities', () => {
  it('should format Date instance to YYYY-MM-DD in local time', () => {
    const d = new Date(2026, 9, 5); // 5 Oct 2026
    expect(getLocalDateString(d)).toBe('2026-10-05');
  });

  it('should return a valid YYYY-MM-DD string for today', () => {
    const today = getTodayDateString();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should add and subtract days accurately without UTC rollover', () => {
    expect(addDays('2026-10-05', 2)).toBe('2026-10-07');
    expect(addDays('2026-10-05', -2)).toBe('2026-10-03');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28'); // 2026 is non-leap year
  });

  it('should format date for display', () => {
    const formatted = formatDateDisplay('2026-10-05');
    expect(formatted).toContain('5 Oct 2026');
  });

  it('should format month for display', () => {
    const formatted = formatMonthDisplay('2026-10');
    expect(formatted).toBe('October 2026');
  });

  it('should calculate month start and end dates', () => {
    const { startDate, endDate } = getMonthStartAndEnd('2026-02');
    expect(startDate).toBe('2026-02-01');
    expect(endDate).toBe('2026-02-28');

    const oct = getMonthStartAndEnd('2026-10');
    expect(oct.startDate).toBe('2026-10-01');
    expect(oct.endDate).toBe('2026-10-31');
  });

  it('should return valid current month string', () => {
    const month = getMonthDateString();
    expect(month).toMatch(/^\d{4}-\d{2}$/);
  });

  it('should format time string to 12-hour AM/PM format', () => {
    expect(formatTime12Hour('09:00:00')).toBe('9:00 AM');
    expect(formatTime12Hour('09:00')).toBe('9:00 AM');
    expect(formatTime12Hour('12:00:00')).toBe('12:00 PM');
    expect(formatTime12Hour('13:30:00')).toBe('1:30 PM');
    expect(formatTime12Hour('00:15:00')).toBe('12:15 AM');
  });

  it('should detect overlapping time intervals accurately', () => {
    // 09:00 - 11:00 vs 10:00 - 12:00 (Overlapping)
    expect(areTimesOverlapping('09:00', '11:00', '10:00', '12:00')).toBe(true);

    // 09:00 - 11:00 vs 11:00 - 13:00 (Back to back, not overlapping)
    expect(areTimesOverlapping('09:00', '11:00', '11:00', '13:00')).toBe(false);

    // 09:00 - 10:00 vs 11:00 - 12:00 (Disjoint, not overlapping)
    expect(areTimesOverlapping('09:00', '10:00', '11:00', '12:00')).toBe(false);

    // 08:00 - 14:00 vs 10:00 - 11:00 (Subsumed, overlapping)
    expect(areTimesOverlapping('08:00', '14:00', '10:00', '11:00')).toBe(true);
  });

  it('should compute exam status based on dates', () => {
    expect(getExamStatus('2026-10-10', '2026-10-20', '2026-10-05')).toBe('upcoming');
    expect(getExamStatus('2026-10-10', '2026-10-20', '2026-10-15')).toBe('ongoing');
    expect(getExamStatus('2026-10-10', '2026-10-20', '2026-10-25')).toBe('finished');
  });
});
