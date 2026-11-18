import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDate, isoDate } from '../src/lib/format';

test('dates use one form: day, short month, year (UTC)', () => {
  assert.equal(formatDate(new Date('2026-11-17')), '17 Nov 2026');
  assert.equal(formatDate(new Date('2026-09-03T23:30:00Z')), '3 Sep 2026');
  assert.equal(isoDate(new Date('2026-11-17')), '2026-11-17');
});
