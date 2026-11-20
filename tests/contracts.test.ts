import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { z } from 'astro/zod';
import { contractProblems } from '../scripts/lib/contracts';
import { laddersSchema, overviewSchema, seasonStatsSchema } from '../src/lib/core-api';

const spec = () => JSON.parse(readFileSync('contracts/core-api/openapi.json', 'utf8'));
const asJson = (schema: z.ZodType) => z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
const routes = [
  { path: '/api/v2/public/overview', schema: asJson(overviewSchema) },
  { path: '/api/v2/public/ladders/{edition}', schema: asJson(laddersSchema) },
  { path: '/api/v2/public/seasons/{edition}/current/stats', schema: asJson(seasonStatsSchema) },
];

test('the site\'s schemas match the vendored core-api spec', () => {
  assert.deepEqual(contractProblems(spec(), routes), []);
});

test('a field the site reads that core-api dropped or renamed', () => {
  const changed = spec();
  delete changed.components.schemas.LadderRow.properties.first;
  assert.deepEqual(contractProblems(changed, routes), [
    "Ladders.ladders[].rows[].first: not in core-api's contract",
  ]);
});

test('a field core-api can now send as null', () => {
  const changed = spec();
  changed.components.schemas.LadderRow.properties.rating = { anyOf: [{ type: 'integer' }, { type: 'null' }] };
  assert.deepEqual(contractProblems(changed, routes), ['Ladders.ladders[].rows[].rating: core-api can send null']);
});

test('a field core-api now sends with another type, or no longer always sends', () => {
  const changed = spec();
  changed.components.schemas.Overview.properties.matches_played = { type: 'string' };
  changed.components.schemas.Overview.required = ['updated_at', 'matches_played'];
  assert.deepEqual(contractProblems(changed, routes), [
    'Overview.registered_players: optional in core-api',
    'Overview.matches_played: the site reads integer, core-api sends string',
  ]);
});

test('a route gone from the spec', () => {
  const changed = spec();
  delete changed.paths['/api/v2/public/overview'];
  assert.deepEqual(contractProblems(changed, routes), [
    "/api/v2/public/overview: no GET route with a JSON answer in core-api's contract",
  ]);
});

test('nullable fields match whether written as a type list or anyOf', () => {
  const changed = spec();
  changed.components.schemas.Ladders.properties.season_label = { type: ['string', 'null'] };
  assert.deepEqual(contractProblems(changed, routes), []);
  const site = { path: '/api/v2/public/overview', schema: { type: 'object', properties: { x: { type: ['integer'] } } } };
  assert.deepEqual(contractProblems(spec(), [site]), ["Overview.x: not in core-api's contract"]);
});

test('a field the site doesn\'t read can change freely', () => {
  const changed = spec();
  changed.components.schemas.LadderRow.properties.mu = { type: 'string' };
  assert.deepEqual(contractProblems(changed, routes), []);
});
