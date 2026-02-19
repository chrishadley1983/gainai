/**
 * Format a number as GBP currency.
 * @param amount - The amount in pounds
 * @param showPence - Whether to always show pence (default: true)
 */
export function formatCurrency(
  amount: number,
  showPence: boolean = true
): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: showPence ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a number with locale-appropriate separators.
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 0)
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a number as a percentage.
 * @param value - The value to format (e.g. 0.75 for 75%)
 * @param decimals - Number of decimal places (default: 1)
 */
export function formatPercentage(
  value: number,
  decimals: number = 1
): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Truncate text to a maximum length, adding an ellipsis if truncated.
 * @param text - The text to truncate
 * @param maxLength - Maximum character length (default: 100)
 * @param suffix - The suffix to append when truncated (default: '...')
 */
export function truncateText(
  text: string,
  maxLength: number = 100,
  suffix: string = '...'
): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length).trimEnd() + suffix;
}

/**
 * Convert a string to a URL-friendly slug.
 * @param text - The text to slugify
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Capitalise the first letter of a string.
 * @param text - The text to capitalise
 */
export function capitalise(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Format a UK phone number for display.
 * Attempts to format as standard UK landline or mobile.
 * @param phone - The phone number string
 */
export function formatPhoneUK(phone: string): string {
  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Handle +44 prefix
  const normalised = digits.startsWith('44')
    ? '0' + digits.slice(2)
    : digits;

  // Mobile: 07xxx xxxxxx
  if (normalised.startsWith('07') && normalised.length === 11) {
    return `${normalised.slice(0, 5)} ${normalised.slice(5)}`;
  }

  // London: 020 xxxx xxxx
  if (normalised.startsWith('020') && normalised.length === 11) {
    return `${normalised.slice(0, 3)} ${normalised.slice(3, 7)} ${normalised.slice(7)}`;
  }

  // Other landlines with 4-digit area code: 01xx xxx xxxx
  if (
    (normalised.startsWith('01') || normalised.startsWith('02')) &&
    normalised.length === 11
  ) {
    return `${normalised.slice(0, 4)} ${normalised.slice(4, 7)} ${normalised.slice(7)}`;
  }

  // Fallback: return as-is with spaces every 4 digits
  return normalised.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}
