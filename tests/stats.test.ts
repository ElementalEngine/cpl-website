import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { seasonStatsSchema, type SeasonStats } from '../src/lib/core-api';
import { STATS_MODES } from '../src/lib/nav';
import {
  banRows,
  bestPerMap,
  mapRows,
  noStatsMessage,
  pickRows,
  rateHeading,
  shownModes,
  statsHref,
  statsSubtitle,
  statsTabs,
} from '../src/lib/stats';

const load = (game: string): SeasonStats =>
  seasonStatsSchema.parse(JSON.parse(readFileSync(`tests/fixtures/core-api/season-stats-${game}.json`, 'utf8')));

const [ffa, teamer] = STATS_MODES;
const pick = (name: string, picks: number, firsts: number, wins: number, rate: number | null) => ({
  name,
  picks,
  wins,
  firsts,
  win_rate: rate,
});

test('modes with no games get no tab', () => {
  const civ6 = shownModes(load('civ6'));
  assert.deepEqual(civ6.map(({ mode }) => mode.id), ['ffa', 'teamer']);
  assert.deepEqual(statsTabs('civ6', civ6).map((tab) => tab.href), ['/civ6/stats/ffa/', '/civ6/stats/teamer/']);
  assert.deepEqual(shownModes(load('civ7')).map(({ mode }) => mode.id), ['ffa']);
  assert.equal(statsHref('civ7', 'duel'), '/civ7/stats/duel/');
});

test('the header line names the season, its start and the games', () => {
  const data = load('civ6');
  assert.equal(statsSubtitle(data, data.modes[0]), 'Season 8 · started 1 Nov 2026 · 412 games');
});

test('most played maps: top 10, with each map\'s share of the mode\'s games', () => {
  const stats = load('civ6').modes[0];
  const rows = mapRows(stats);
  assert.equal(rows.length, 10);
  assert.equal(rows[0].name, stats.maps[0].map);
  assert.deepEqual(rows[0].cells, [String(stats.maps[0].games), `${Math.round((stats.maps[0].games / 412) * 100)}%`]);
});

test('draft bans: leaders, and civs only where core-api sends them (Civ 7)', () => {
  const civ6 = load('civ6').modes[0];
  const civ7 = load('civ7').modes[0];
  assert.ok(banRows(civ6, 'leader').length > 0);
  assert.equal(banRows(civ6, 'civ').length, 0);
  assert.ok(banRows(civ7, 'civ').length > 0);
  assert.ok(banRows(civ6, 'leader').length <= 10);
});

test('FFA rates are 1st place %, Teamer and Duel use win %; "—" below the minimum, listed last by picks', () => {
  const picks = [pick('A', 10, 1, 9, 0.9), pick('B', 20, 10, 2, 0.1), pick('C', 4, 4, 4, null), pick('D', 3, 0, 0, null)];
  assert.equal(rateHeading(ffa), '1st place %');
  assert.deepEqual(pickRows(ffa, picks).map((row) => [row.name, ...row.cells]), [
    ['B', '20', '50%'],
    ['A', '10', '10%'],
    ['C', '4', '—'],
    ['D', '3', '—'],
  ]);
  assert.equal(rateHeading(teamer), 'Win %');
  assert.deepEqual(pickRows(teamer, picks).map((row) => row.cells[1]), ['90%', '10%', '—', '—']);
});

test('best picks per map: FFA, most played maps first, average place to one decimal', () => {
  const stats = load('civ6').modes[0];
  const best = bestPerMap(stats);
  const playedOrder = stats.maps.slice(0, 10).map(({ map }) => map);
  const shownMaps = best.map((item) => item.map);
  assert.deepEqual(shownMaps, playedOrder.filter((map) => shownMaps.includes(map)));
  assert.ok(best.every((item) => item.kind === 'leader' && item.rows.length <= 5));
  assert.match(best[0].rows[0].cells[1], /^\d\.\d$/);
  assert.ok(bestPerMap(load('civ7').modes[0]).some((item) => item.kind === 'civ'));
  assert.deepEqual(bestPerMap(load('civ6').modes[1]), []);
});

test('no games yet: no season, the season start, or "coming soon"', () => {
  const data = load('civ6');
  assert.equal(
    noStatsMessage({ kind: 'no-season' }),
    'No season is open right now. Stats appear when the next season starts.'
  );
  assert.equal(noStatsMessage({ kind: 'fresh', data }), 'Season 8 started on 1 Nov 2026. Stats appear after the first games.');
  assert.equal(noStatsMessage({ kind: 'none' }), 'Maps, draft bans and leader win rates will appear here soon.');
});
