import { describe, it, expect } from 'vitest';
import { generateCsvContent, sanitizeCsvCell } from './csv';

describe('CSV Utilities', () => {
  it('should sanitize formula injection characters', () => {
    expect(sanitizeCsvCell('=cmd|"/C calc"!A0')).toBe('"\'=cmd|""/C calc""!A0"');
    expect(sanitizeCsvCell('+12345')).toBe("'+12345");
    expect(sanitizeCsvCell('-500')).toBe("'-500");
    expect(sanitizeCsvCell('@SUM(A1:A5)')).toBe("'@SUM(A1:A5)");
    expect(sanitizeCsvCell('  =1+1')).toBe("'  =1+1");
  });

  it('should quote cells with commas, quotes, and newlines', () => {
    expect(sanitizeCsvCell('Hello, World')).toBe('"Hello, World"');
    expect(sanitizeCsvCell('He said "Hello"')).toBe('"He said ""Hello"""');
    expect(sanitizeCsvCell("Line 1\nLine 2")).toBe("\"Line 1\nLine 2\"");
  });

  it('should correctly handle null, undefined, and numbers', () => {
    expect(sanitizeCsvCell(null)).toBe('');
    expect(sanitizeCsvCell(undefined)).toBe('');
    expect(sanitizeCsvCell(42)).toBe('42');
  });

  it('should generate CSV with UTF-8 BOM and correct lines', () => {
    const headers = ['Roll No', 'Name', 'Status'];
    const rows = [
      [1, 'Ali Khan', 'Present'],
      [2, 'عائشہ بی بی', 'Absent'], // Urdu text
      [3, '=HYPERLINK("http://attacker.com")', 'Late'],
    ];

    const csv = generateCsvContent(headers, rows);
    // Starts with \uFEFF BOM
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Roll No,Name,Status');
    expect(csv).toContain('عائشہ بی بی');
    expect(csv).toContain("'=HYPERLINK(\"\"http://attacker.com\"\")");
  });
});
