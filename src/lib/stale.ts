/** Data older than this is flagged "may be out of date": the daily build has missed at least one run. */
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

/** True when an "Updated" time (`<time datetime>`) is more than 48 hours before `now`. */
export function isOutOfDate(datetime: string, now: number): boolean {
  const updated = Date.parse(datetime);
  return Number.isFinite(updated) && now - updated > MAX_AGE_MS;
}
