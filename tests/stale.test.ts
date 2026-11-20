import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isOutOfDate } from '../src/lib/stale';

const now = Date.parse('2026-11-22T12:00:00Z');

test('data is out of date after 48 hours, not before', () => {
  assert.equal(isOutOfDate('2026-11-20T12:00:00Z', now), false);
  assert.equal(isOutOfDate('2026-11-20T11:59:00Z', now), true);
  assert.equal(isOutOfDate('2026-11-22T03:17:00.512Z', now), false);
});

test('a missing or broken time never shows the note', () => {
  assert.equal(isOutOfDate('', now), false);
  assert.equal(isOutOfDate('soon', now), false);
});
