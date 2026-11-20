import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCount, formatDate, formatDateTime, formatDayMonth, isoDate } from '../src/lib/format';

test('dates use one form: day, short month, year (UTC)', () => {
  assert.equal(formatDate(new Date('2026-11-17')), '17 Nov 2026');
  assert.equal(formatDate(new Date('2026-09-03T23:30:00Z')), '3 Sep 2026');
  assert.equal(isoDate(new Date('2026-11-17')), '2026-11-17');
});

test('updated times: date, 24-hour time, UTC', () => {
  assert.equal(formatDateTime(new Date('2026-11-17T03:17:42Z')), '17 Nov 2026, 03:17 UTC');
  assert.equal(formatDateTime(new Date('2026-01-05T23:05:00Z')), '5 Jan 2026, 23:05 UTC');
});

test('"last active" leaves out the year when it is the build\'s year', () => {
  const now = new Date('2026-11-20T03:17:00Z');
  assert.equal(formatDayMonth(new Date('2026-11-12T23:59:00Z'), now), '12 Nov');
  assert.equal(formatDayMonth(new Date('2025-12-31T10:00:00Z'), now), '31 Dec 2025');
});

test('counts have a separator from 1,000', () => {
  assert.equal(formatCount(999), '999');
  assert.equal(formatCount(1204), '1,204');
  assert.equal(formatCount(0), '0');
});
