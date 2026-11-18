import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { THEME_KEY, themeInit } from '../src/lib/theme';

/** Runs the head script against a fake page with the given stored value. */
function run(stored: string | null | Error) {
  const classes: string[] = [];
  const dataset: Record<string, string> = {};
  const read: string[] = [];
  runInNewContext(themeInit, {
    document: {
      documentElement: { classList: { add: (name: string) => classes.push(name) }, dataset },
    },
    localStorage: {
      getItem: (key: string) => {
        read.push(key);
        if (stored instanceof Error) throw stored;
        return stored;
      },
    },
  });
  return { classes, dataset, read };
}

test('marks scripts as running and applies a saved theme', () => {
  assert.deepEqual(run('light'), { classes: ['js'], dataset: { theme: 'light' }, read: [THEME_KEY] });
  assert.deepEqual(run('dark').dataset, { theme: 'dark' });
});

test('follows the device when nothing valid is saved', () => {
  assert.deepEqual(run(null).dataset, {});
  assert.deepEqual(run('purple').dataset, {});
});

test('survives blocked storage', () => {
  const result = run(new Error('SecurityError'));
  assert.deepEqual(result.classes, ['js']);
  assert.deepEqual(result.dataset, {});
});

test('stays one short line', () => {
  assert.ok(!themeInit.includes('\n'));
  assert.ok(themeInit.length < 300, `${themeInit.length} characters`);
});
