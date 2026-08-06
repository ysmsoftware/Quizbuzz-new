/**
 * CSV download helpers.
 *
 * Lifted out of app/org/contests/[id]/results/page.tsx so every export path shares
 * one implementation of quoting and blob download rather than each rolling its own.
 */

/** Quote a cell only when it contains a delimiter, quote or newline; escape inner quotes. */
export function csvCell(value: unknown): string {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Serialise rows to CSV and trigger a browser download. */
export function downloadCsv(filename: string, rows: unknown[][]): void {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
