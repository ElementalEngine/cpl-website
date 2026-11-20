import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { laddersSchema, overviewSchema, seasonStatsSchema } from '../src/lib/core-api';
import { gameFacts, overviewFacts, seasonFact } from '../src/lib/facts';

const fixture = (name: string): unknown => JSON.parse(readFileSync(`tests/fixtures/core-api/${name}`, 'utf8'));
const ladders = laddersSchema.parse(fixture('ladders-civ6.json'));
const stats = seasonStatsSchema.parse(fixture('season-stats-civ6.json'));

test('league totals: registered players and games played, with separators', () => {
  assert.deepEqual(overviewFacts(overviewSchema.parse(fixture('overview.json'))), [
    { value: '1,204', label: 'registered players' },
    { value: '9,876', label: 'games played' },
  ]);
});

test('a game: the season, its games, then players on each ladder with players', () => {
  assert.deepEqual(gameFacts(ladders, stats), [
    { value: 'Season 8', label: 'started 1 Nov 2026' },
    { value: '532', label: 'games this season' },
    { value: '130', label: 'on the FFA ladder' },
    { value: '41', label: 'on the Teamer ladder' },
    { value: '25', label: 'on the cloud ladder' },
  ]);
});

test('no open season or no data: those facts are left out', () => {
  assert.deepEqual(seasonFact({ season_label: null, season_started_at: null }), []);
  assert.deepEqual(gameFacts(undefined, undefined), []);
  assert.equal(gameFacts(ladders, undefined)[0].value, 'Season 8');
});
