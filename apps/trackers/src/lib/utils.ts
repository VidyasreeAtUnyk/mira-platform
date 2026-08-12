/**
 * Shared utility functions.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Capitalize first letter */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Human-readable metric label ("revenue_aed" -> "Revenue Aed") */
export function formatMetricLabel(metric: string): string {
  return metric
    .split('_')
    .map((word) => (word.toUpperCase() === 'AED' ? 'AED' : capitalize(word)))
    .join(' ');
}

/** Format a number with locale grouping, trimming to at most 2 decimals */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

/** Format a date string (YYYY-MM-DD or ISO) as e.g. "12 Aug 2026" */
export function formatDate(dateString: string): string {
  const d = dateString.length === 10 ? new Date(`${dateString}T00:00:00`) : parseISO(dateString);
  return format(d, 'd MMM yyyy');
}

/** Today's date as YYYY-MM-DD, suitable for a date input default value */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Clamp a percent-to-goal value for progress-bar width purposes (display only; the real number can exceed 100%) */
export function clampPercent(pct: number): number {
  return Math.max(0, Math.min(100, pct));
}
