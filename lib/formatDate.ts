/**
 * Formats a date (ISO date or timestamptz string like "2026-08-13T00:00:00+00:00")
 * into a clean display string like "13 Aug 2026" — never the raw timestamp,
 * time, or timezone offset.
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
