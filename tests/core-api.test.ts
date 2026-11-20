import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  CORE_API_ROUTES,
  failureKind,
  getCoreApi,
  laddersSchema,
  overviewSchema,
  retryDelay,
  seasonStatsSchema,
  ShapeError,
} from '../src/lib/core-api';
import { FetchError } from '../src/lib/http';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(`tests/fixtures/core-api/${name}`, 'utf8'));

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function envelope(code: string) {
  return { detail: { error: { code, message: 'x', retryable: false } } };
}

/** A fake fetch that answers in turn and records each call. */
function answers(...responses: (Response | Error)[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error('no more answers');
    if (next instanceof Error) throw next;
    return next;
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const LADDERS = CORE_API_ROUTES.ladders('civ6');
const STATS = CORE_API_ROUTES.stats('civ6');
const noWait = { retryDelayMs: (error: FetchError) => (retryDelay(error) === null ? null : 0) };

async function failure(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail('expected the call to fail');
}

test('every fixture matches the site schemas', () => {
  assert.ok(overviewSchema.safeParse(fixture('overview.json')).success);
  for (const game of ['civ6', 'civ7']) {
    assert.ok(laddersSchema.safeParse(fixture(`ladders-${game}.json`)).success, game);
    assert.ok(seasonStatsSchema.safeParse(fixture(`season-stats-${game}.json`)).success, game);
  }
});

test('a call sends the token to the public host and keeps only the fields the site shows', async () => {
  const { fetch, calls } = answers(json(200, fixture('ladders-civ6.json')));
  const data = await getCoreApi(LADDERS, laddersSchema, 'secret-token', { fetch });
  assert.equal(calls[0].url, 'https://api.elementalengine.net/api/v2/public/ladders/civ6');
  assert.equal((calls[0].init?.headers as Record<string, string>).authorization, 'Bearer secret-token');
  const row = data.ladders[0].rows[0] as Record<string, unknown>;
  assert.equal(row.mu, undefined);
  assert.equal(row.sigma, undefined);
  assert.equal(typeof row.rating, 'number');
});

test('names are kept exactly as sent, markup included', async () => {
  const body = fixture('ladders-civ6.json') as { ladders: { rows: { display_name: string }[] }[] };
  const names = body.ladders.flatMap((ladder) => ladder.rows.map((row) => row.display_name));
  assert.ok(names.includes('Unregistered player'));
  assert.ok(names.includes('<b>Not bold</b> & "quoted"'));
  const { fetch } = answers(json(200, body));
  const data = await getCoreApi(LADDERS, laddersSchema, 't', { fetch });
  assert.deepEqual(data.ladders.flatMap((ladder) => ladder.rows.map((row) => row.display_name)), names);
});

test('an unexpected shape names the field, never a value, and is a bug', async () => {
  const body = fixture('ladders-civ6.json') as { ladders: { rows: { rank: unknown }[] }[] };
  body.ladders[0].rows[3].rank = 'first';
  const { fetch } = answers(json(200, body));
  const error = await failure(getCoreApi(LADDERS, laddersSchema, 't', { fetch }));
  assert.ok(error instanceof ShapeError);
  assert.equal(error.message, 'unexpected response shape at ladders.0.rows.3.rank');
  assert.equal(failureKind(error, LADDERS), 'bug');
});

test('a wrong token (401) or an unknown edition (422) is a bug and is not retried', async () => {
  for (const [status, code] of [
    [401, 'UNAUTHORIZED'],
    [422, 'INVALID_REQUEST'],
  ] as const) {
    const { fetch, calls } = answers(json(status, envelope(code)));
    const error = await failure(getCoreApi(LADDERS, laddersSchema, 't', { fetch, ...noWait }));
    assert.equal(calls.length, 1);
    assert.ok(error instanceof FetchError);
    assert.equal(error.message, `HTTP ${status} ${code}`);
    assert.equal(failureKind(error, LADDERS), 'bug');
  }
});

test('the token unset on core-api (503 WEBSITE_SERVICE_MISCONFIGURED) is a bug, with no retry', async () => {
  const { fetch, calls } = answers(json(503, envelope('WEBSITE_SERVICE_MISCONFIGURED')));
  const error = await failure(getCoreApi(LADDERS, laddersSchema, 't', { fetch, ...noWait }));
  assert.equal(calls.length, 1);
  assert.equal(failureKind(error, LADDERS), 'bug');
});

test('404 NOT_FOUND means "no season" on season stats only; a 404 from Caddy is a bug', async () => {
  const notFound = new FetchError('HTTP 404 NOT_FOUND', false, 404, 'NOT_FOUND');
  assert.equal(failureKind(notFound, STATS), 'no-season');
  assert.equal(failureKind(notFound, LADDERS), 'bug');
  assert.equal(failureKind(new FetchError('HTTP 404', false, 404), STATS), 'bug');

  const { fetch } = answers(new Response('', { status: 404 }));
  const error = await failure(getCoreApi(STATS, seasonStatsSchema, 't', { fetch }));
  assert.ok(error instanceof FetchError);
  assert.equal(error.message, 'HTTP 404');
});

test('rate limited, restarting or timed out: one retry, then "down"', async () => {
  const limited = answers(json(429, envelope('RATE_LIMITED')), json(200, fixture('overview.json')));
  const ok = await getCoreApi(CORE_API_ROUTES.overview(), overviewSchema, 't', { fetch: limited.fetch, ...noWait });
  assert.equal(ok.registered_players, 1204);
  assert.equal(limited.calls.length, 2);

  const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
  const down = answers(new Response('', { status: 502 }), timeout);
  const error = await failure(getCoreApi(LADDERS, laddersSchema, 't', { fetch: down.fetch, ...noWait }));
  assert.equal(down.calls.length, 2);
  assert.equal(failureKind(error, LADDERS), 'down');
  assert.equal(failureKind(new FetchError('HTTP 503 UNAVAILABLE', true, 503, 'UNAVAILABLE'), LADDERS), 'down');
});

test('retry waits: a minute after 429, 20 s after a server error, none after a setup error', () => {
  assert.equal(retryDelay(new FetchError('HTTP 429', true, 429, 'RATE_LIMITED')), 60_000);
  assert.equal(retryDelay(new FetchError('HTTP 502', true, 502)), 20_000);
  assert.equal(retryDelay(new FetchError('timed out', true)), 20_000);
  assert.equal(retryDelay(new FetchError('x', true, 503, 'WEBSITE_SERVICE_MISCONFIGURED')), null);
});

test('an error body that isn\'t a plain code is ignored', async () => {
  const { fetch } = answers(json(500, { detail: { error: { code: '<script>' } } }), json(500, 'oops'));
  const error = await failure(getCoreApi(LADDERS, laddersSchema, 't', { fetch, ...noWait }));
  assert.ok(error instanceof FetchError);
  assert.equal(error.message, 'HTTP 500');
  assert.equal(error.code, undefined);
});
