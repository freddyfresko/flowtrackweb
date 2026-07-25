/**
 * Locale-aware formatting helpers for FlowTrack.
 * All formatting is centralized here for consistency.
 */

const LOCALE = 'es-CL';

/** Format a number as Chilean pesos: $1.234.567 */
export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '$0';
  return '$' + Math.round(n).toLocaleString(LOCALE);
}

/** Format a number with locale separators: 1.234.567 */
export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '0';
  return Math.round(n).toLocaleString(LOCALE);
}

/** Format a date in Chilean long format: "sábado, 25 de julio de 2026" */
export function formatDateLong(d: string | Date | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(LOCALE, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/** Format a date in Chilean short format: "25/07/2026" */
export function formatDateShort(d: string | Date | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(LOCALE);
}

/** Format time in Chilean 24h format: "23:59" */
export function formatTime(d: string | Date | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}
