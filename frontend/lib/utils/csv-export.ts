import type { Registration, QuizResult } from '@/lib/types';

export function registrationsToCSV(registrations: Registration[]): string {
  const headers = [
    'Participant ID',
    'Full Name',
    'Email',
    'Phone',
    'Institution',
    'City',
    'State',
    'Country',
    'Status',
    'Payment Status',
    'Registered At'
  ];

  const rows = registrations.map(r => [
    r.participantId,
    r.participantDetails.fullName,
    r.participantDetails.email,
    r.participantDetails.phone,
    r.participantDetails.institution || '',
    r.participantDetails.city || '',
    r.participantDetails.state || '',
    r.participantDetails.country,
    r.status,
    r.paymentStatus,
    new Date(r.registeredAt).toLocaleDateString()
  ]);

  return formatAsCSV(headers, rows);
}

export function resultsToCSV(results: QuizResult[]): string {
  const headers = [
    'Rank',
    'Participant ID',
    'Participant Name',
    'Score',
    'Total Marks',
    'Correct Answers',
    'Wrong Answers',
    'Unattempted',
    'Time Taken',
    'Percentile',
    'Status'
  ];

  const rows = results.map(r => [
    r.rank.toString(),
    r.participantId,
    r.participantName,
    r.score.toString(),
    r.totalMarks.toString(),
    r.correctAnswers.toString(),
    r.wrongAnswers.toString(),
    r.unattempted.toString(),
    r.timeTaken,
    r.percentile.toFixed(2),
    r.isPassed ? 'Passed' : 'Failed'
  ]);

  return formatAsCSV(headers, rows);
}

function formatAsCSV(headers: string[], rows: (string | undefined)[][]): string {
  const escapedHeaders = headers.map(h => `"${h}"`).join(',');
  const escapedRows = rows.map(row =>
    row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')
  );

  return [escapedHeaders, ...escapedRows].join('\n');
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
