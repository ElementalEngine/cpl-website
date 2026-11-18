import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Standings } from '../src/lib/challonge';
import { FetchError } from '../src/lib/http';
import {
  loadBrackets,
  publishedSchema,
  splitTournaments,
  type LoadOptions,
  type Published,
} from '../src/lib/tournaments';

const entry = (id: string, data: { order?: number; winners?: string[]; endedOn?: Date } = {}) => ({
  id,
  data,
});

test('split: no winners = active, by order then file name; winners = past, newest first', () => {
  const { active, past } = splitTournaments([
    entry('cloud-2v2'),
    entry('pl-season-6', { order: 1 }),
    entry('cloud-1v1'),
    entry('top-10', { order: 2 }),
    entry('ccc-7', { winners: ['A'] }),
    entry('ccc-10', { winners: ['A', 'B', 'C'], endedOn: new Date('2024-05-12') }),
    entry('goat', { winners: ['A'], endedOn: new Date('2021-01-03') }),
    entry('ccc-15', { winners: ['A'], endedOn: new Date('2024-05-12') }),
    entry('abc', { winners: ['A'] }),
  ]);
  assert.deepEqual(
    active.map((e) => e.id),
    ['pl-season-6', 'top-10', 'cloud-1v1', 'cloud-2v2']
  );
  assert.deepEqual(
    past.map((e) => e.id),
    ['ccc-10', 'ccc-15', 'goat', 'abc', 'ccc-7']
  );
});

test('split: a file name the page already uses fails', () => {
  assert.throws(() => splitTournaments([entry('past-winners')]), /past-winners\.yaml/);
});

const NOW = new Date('2026-11-18T03:17:00Z');
const EARLIER = '2026-11-16T03:17:00.000Z';
const standings: Standings = {
  finished: false,
  rows: [{ rank: 1, name: 'Ann', record: { wins: 2, losses: 0, ties: 0 } }],
};
const lastGood: Published = {
  updated_at: EARLIER,
  brackets: [{ challonge: 'd1', updated_at: EARLIER, finished: false, rows: [{ rank: 1, name: 'Old' }] }],
};

function options(overrides: Partial<LoadOptions>): LoadOptions {
  return {
    apiKey: 'key',
    now: NOW,
    fetchStandings: async () => standings,
    fetchLastGood: async () => lastGood,
    reason: (error) => (error instanceof Error ? error.message : 'unexpected error'),
    ...overrides,
  };
}

test('load: fetched brackets are fresh and published with this build time', async () => {
  let lastGoodRead = false;
  const result = await loadBrackets(['d1', 'd2', 'd1'], {
    ...options({}),
    fetchLastGood: async () => {
      lastGoodRead = true;
      return lastGood;
    },
  });
  assert.equal(result.states.get('d1')?.kind, 'fresh');
  assert.equal(result.published.brackets.length, 2, 'duplicate links fetched once');
  assert.equal(result.published.updated_at, NOW.toISOString());
  assert.equal(result.published.brackets[0].updated_at, NOW.toISOString());
  assert.equal(lastGoodRead, false, 'the live site is only read when a fetch fails');
  assert.ok(publishedSchema.safeParse(JSON.parse(JSON.stringify(result.published))).success);
});

test('load: Challonge blocked → last good data from the live site, marked stale and re-published', async () => {
  const result = await loadBrackets(['d1', 'd2'], options({
    fetchStandings: async () => {
      throw new FetchError('network error', true);
    },
  }));
  const d1 = result.states.get('d1');
  assert.equal(d1?.kind, 'stale');
  assert.equal(d1?.kind === 'stale' && d1.data.updated_at, EARLIER, 'keeps its own date');
  assert.equal(result.states.get('d2')?.kind, 'none', 'no earlier data for d2');
  assert.deepEqual(result.published.brackets, lastGood.brackets, 'stale data carries forward');
  assert.ok(result.log.some((line) => /d1: network error; showing data from 16 Nov 2026/.test(line)));
  assert.ok(result.log.some((line) => /d2: network error; no earlier data/.test(line)));
});

test('load: one bracket fails, the others stay fresh', async () => {
  const result = await loadBrackets(['d1', 'd2'], options({
    fetchStandings: async (apiId) => {
      if (apiId === 'd1') throw new FetchError('HTTP 503', true);
      return standings;
    },
  }));
  assert.equal(result.states.get('d1')?.kind, 'stale');
  assert.equal(result.states.get('d2')?.kind, 'fresh');
});

test('load: first build with Challonge and the live site both down → link-only, nothing breaks', async () => {
  const result = await loadBrackets(['d1'], options({
    fetchStandings: async () => {
      throw new FetchError('timed out', true);
    },
    fetchLastGood: async () => undefined,
  }));
  assert.equal(result.states.get('d1')?.kind, 'none');
  assert.deepEqual(result.published.brackets, []);
});

test('load: no key (pull requests, or the API is gone) → degraded mode, no network at all', async () => {
  const fail = async () => {
    throw new Error('must not be called');
  };
  const result = await loadBrackets(['d1', 'd2'], options({
    apiKey: undefined,
    fetchStandings: fail,
    fetchLastGood: fail,
  }));
  assert.deepEqual([...result.states.values()].map((s) => s.kind), ['off', 'off']);
  assert.deepEqual(result.published, { updated_at: NOW.toISOString(), brackets: [] });
  assert.deepEqual(result.log, ['no CHALLONGE_API_KEY: brackets link to Challonge only']);
});

test('published file: only the fields shown; extra fields are dropped when read back', () => {
  const parsed = publishedSchema.parse({
    ...lastGood,
    brackets: [{ ...lastGood.brackets[0], email: 'x@example.org' }],
  });
  assert.equal('email' in parsed.brackets[0], false);
  assert.ok(!publishedSchema.safeParse({ brackets: [] }).success, 'updated_at is required');
});
