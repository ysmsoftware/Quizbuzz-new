/** `<input type="datetime-local">`-style values, and DateTimePicker's `Date` prop, both
 * need a local-time "YYYY-MM-DDTHH:mm" string, not an ISO/UTC one. Shared so every call
 * site (create-contest form, reschedule modal, inline editable fields) formats the same
 * way instead of re-deriving it. */
export function toLocalInputValue(value: string | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
