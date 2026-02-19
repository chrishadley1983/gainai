import {
  format,
  formatDistanceToNow,
  isAfter,
  isBefore,
  differenceInDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  formatDistance,
} from 'date-fns';

/**
 * Format a date to a human-readable string.
 * @param date - The date to format
 * @param formatStr - The format string (default: 'dd MMM yyyy')
 */
export function formatDate(
  date: Date | string,
  formatStr: string = 'dd MMM yyyy'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, formatStr);
}

/**
 * Format a date relative to now (e.g. "3 days ago", "in 2 hours").
 * @param date - The date to format
 * @param addSuffix - Whether to add "ago" or "in" suffix (default: true)
 */
export function formatRelative(
  date: Date | string,
  addSuffix: boolean = true
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix });
}

/**
 * Format a date range as a string.
 * @param start - The start date
 * @param end - The end date
 * @param formatStr - The format string (default: 'dd MMM yyyy')
 */
export function formatDateRange(
  start: Date | string,
  end: Date | string,
  formatStr: string = 'dd MMM yyyy'
): string {
  const s = typeof start === 'string' ? new Date(start) : start;
  const e = typeof end === 'string' ? new Date(end) : end;
  return `${format(s, formatStr)} – ${format(e, formatStr)}`;
}

/**
 * Check whether a date is in the past (overdue).
 * @param date - The date to check
 */
export function isOverdue(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return isBefore(d, new Date());
}

/**
 * Return how many days ago a date was.
 * Negative values mean the date is in the future.
 * @param date - The date to check
 */
export function daysAgo(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  return differenceInDays(new Date(), d);
}

/**
 * Get the start and end of the current month.
 */
export function getMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: startOfMonth(now),
    end: endOfMonth(now),
  };
}

/**
 * Get the start and end of the previous month.
 */
export function getPreviousMonthRange(): { start: Date; end: Date } {
  const previousMonth = subMonths(new Date(), 1);
  return {
    start: startOfMonth(previousMonth),
    end: endOfMonth(previousMonth),
  };
}

/**
 * Format a date as a human-friendly "time ago" string.
 * Uses shorter phrasing than formatRelative for compact UI.
 * @param date - The date to format
 */
export function formatTimeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
  }

  return formatDistanceToNow(d, { addSuffix: true });
}
