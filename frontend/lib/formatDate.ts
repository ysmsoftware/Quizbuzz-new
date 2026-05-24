import { format, formatDistanceToNow } from 'date-fns';

/** "23 May 2026 at 11:33 AM" (local timezone) */
export function fmtDateTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, "d MMM yyyy 'at' h:mm a");
}

/** "Jun 10, 2026" */
export function fmtDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'MMM d, yyyy');
}

/** "in 3 days" / "2 hours ago" */
export function fmtRelative(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return formatDistanceToNow(d, { addSuffix: true });
}
