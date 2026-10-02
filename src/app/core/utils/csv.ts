/**
 * Client-side CSV generation & export utilities.
 * Includes UTF-8 BOM for Microsoft Excel compatibility and
 * CSV/Formula injection protection for spreadsheet safety.
 */

/**
 * Sanitizes an individual cell value against CSV formula injection.
 * Formula triggers: =, +, -, @. If present, cell is prefixed with a single quote.
 * Values containing commas, double quotes, or newlines are quoted and internal quotes are escaped.
 */
export function sanitizeCsvCell(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }

  let str = String(val);

  // Protect against CSV / Spreadsheet formula injection
  const trimmed = str.trimStart();
  if (
    trimmed.startsWith('=') ||
    trimmed.startsWith('+') ||
    trimmed.startsWith('-') ||
    trimmed.startsWith('@')
  ) {
    str = `'${str}`;
  }

  // Quote cell if it contains delimiter, double quote, or newlines
  if (
    str.includes('"') ||
    str.includes(',') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Builds standard CSV content with UTF-8 BOM (\uFEFF) for Excel compatibility.
 */
export function generateCsvContent(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const headerLine = headers.map(sanitizeCsvCell).join(',');
  const rowLines = rows
    .map((row) => row.map(sanitizeCsvCell).join(','))
    .join('\r\n');

  // \uFEFF ensures UTF-8 detection in Excel on Windows/Mac
  return `\uFEFF${headerLine}\r\n${rowLines}`;
}

/**
 * Prompts client browser to download CSV file.
 */
export function downloadCsvFile(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const content = generateCsvContent(headers, rows);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', cleanFilename);
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
