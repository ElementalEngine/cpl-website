import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { laddersSchema, type Ladders } from '../src/lib/core-api';
import {
  ladderHref,
  ladderPages,
  ladderSubtitle,
  ladderTabs,
  noLaddersMessage,
  PAGE_SIZE,
  resultColumn,
  shownLadders,
} from '../src/lib/ladders';
import { LADDER_MODES } from '../src/lib/nav';

const load = (game: string): Ladders =>
  laddersSchema.parse(JSON.parse(readFileSync(`tests/fixtures/core-api/ladders-${game}.json`, 'utf8')));

const [ffa, , , cloud] = LADDER_MODES;

test('empty ladders get no tab; tabs follow FFA, Teamer, Duel, Cloud', () => {
  const civ6 = shownLadders(load('civ6'));
  assert.deepEqual(civ6.map((ladder) => ladder.mode.id), ['ffa', 'teamer', 'cloud']);
  assert.deepEqual(shownLadders(load('civ7')).map((ladder) => ladder.mode.id), ['ffa']);
  assert.deepEqual(ladderTabs('civ6', civ6).map((tab) => tab.href), [
    '/civ6/ladder/ffa/',
    '/civ6/ladder/teamer/',
    '/civ6/ladder/cloud/',
  ]);
});

test('a ladder key the site doesn\'t know is ignored', () => {
  const data = load('civ6');
  data.ladders.push({ key: 'season-combined', rows: data.ladders[0].rows });
  assert.equal(shownLadders(data).length, 3);
});

test('pages of 100 in core-api\'s order; page 1 has no number', () => {
  const [first] = shownLadders(load('civ6'));
  assert.equal(first.rows.length, 130);
  const pages = ladderPages('civ6', first);
  assert.equal(PAGE_SIZE, 100);
  assert.deepEqual(
    pages.map((page) => [page.number, page.pages, page.rows.length, page.rows[0].rank, page.prev, page.next]),
    [
      [1, 2, 100, 1, undefined, '/civ6/ladder/ffa/2/'],
      [2, 2, 30, 101, '/civ6/ladder/ffa/', undefined],
    ]
  );
  assert.equal(ladderHref('civ7', 'duel', 3), '/civ7/ladder/duel/3/');
});

test('a ladder of 100 or fewer is one page', () => {
  const [, teamer] = shownLadders(load('civ6'));
  assert.deepEqual(ladderPages('civ6', teamer).map((page) => [page.number, page.pages]), [[1, 1]]);
});

test('FFA counts 1st places; the other ladders count wins', () => {
  const row = load('civ6').ladders[0].rows[0];
  assert.equal(resultColumn(ffa).heading, '1st');
  assert.equal(resultColumn(ffa).value(row), row.first);
  assert.equal(resultColumn(cloud).heading, 'Wins');
  assert.equal(resultColumn(cloud).value(row), row.wins);
});

test('season ladders say which season; cloud says all time', () => {
  const data = load('civ6');
  assert.equal(ladderSubtitle(data, ffa), 'Season 8 · started 1 Nov 2026');
  assert.equal(ladderSubtitle(data, cloud), 'All-time cloud games');
});

test('no players yet: the season start, no season, or "coming soon"', () => {
  const data = load('civ6');
  assert.equal(
    noLaddersMessage({ kind: 'fresh', data }),
    'Season 8 started on 1 Nov 2026. Tables appear after the first games.'
  );
  assert.equal(
    noLaddersMessage({ kind: 'stale', data: { ...data, season_label: null, season_started_at: null } }),
    'No season is open right now. Tables appear when the next season starts.'
  );
  assert.equal(noLaddersMessage({ kind: 'none' }), 'Leaderboards will appear here soon.');
});
