const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** The one date format on the site: "17 Nov 2026" (UTC). */
export function formatDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Machine-readable date for `<time datetime>`: "2026-11-17". */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "Updated" times: "17 Nov 2026, 03:17 UTC". */
export function formatDateTime(date: Date): string {
  const time = date.toISOString().slice(11, 16);
  return `${formatDate(date)}, ${time} UTC`;
}

/** "Last active" dates: "12 Nov", with the year when it isn't the build's year: "12 Nov 2025" (UTC). */
export function formatDayMonth(date: Date, now: Date): string {
  const day = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  return date.getUTCFullYear() === now.getUTCFullYear() ? day : `${day} ${date.getUTCFullYear()}`;
}

/** Counts with a separator from 1,000: "1,204". */
export function formatCount(value: number): string {
  return value.toLocaleString('en-GB');
}
