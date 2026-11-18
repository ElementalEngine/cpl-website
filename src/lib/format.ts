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
