import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FailureKind } from '../src/lib/core-api';
import { loadSource, type LoadDeps } from '../src/lib/core-api-data';
import { FetchError } from '../src/lib/http';

interface Data {
  updated_at: string;
  n: number;
}

const live: Data = { updated_at: '2026-11-20T03:17:00Z', n: 2 };
const old: Data = { updated_at: '2026-11-18T03:17:00Z', n: 1 };

function deps(overrides: Partial<LoadDeps<Data>> & { fails?: FailureKind } = {}): LoadDeps<Data> {
  const { fails, ...rest } = overrides;
  return {
    label: 'ladders civ6',
    token: 'secret-token',
    fixtures: undefined,
    fetchLive: async () => {
      if (fails) throw new FetchError('HTTP 401 UNAUTHORIZED', false, 401, 'UNAUTHORIZED');
      return live;
    },
    readFixture: async () => ({ updated_at: '2026-11-20T00:00:00Z', n: 9 }),
    fetchLastGood: async () => old,
    kindOf: () => fails ?? 'bug',
    ...rest,
  };
}

test('with a token: the live answer, no problem', async () => {
  const result = await loadSource(deps());
  assert.deepEqual(result.source, { kind: 'fresh', data: live });
  assert.equal(result.log, 'ladders civ6: updated');
  assert.equal(result.problem, undefined);
});

test('core-api down: the last good data with its date, and the run stays green', async () => {
  const result = await loadSource(deps({ fails: 'down' }));
  assert.deepEqual(result.source, { kind: 'stale', data: old });
  assert.equal(result.log, 'ladders civ6: HTTP 401 UNAUTHORIZED; showing data from 18 Nov 2026');
  assert.equal(result.problem, undefined);
});

test('a bug: the last good data still ships, and the problem is recorded for the deploy job', async () => {
  const result = await loadSource(deps({ fails: 'bug' }));
  assert.equal(result.source.kind, 'stale');
  assert.equal(result.problem, 'ladders civ6: HTTP 401 UNAUTHORIZED');
  assert.ok(!result.problem.includes('secret-token'));
});

test('no earlier data: "none", problem kept', async () => {
  const result = await loadSource(deps({ fails: 'bug', fetchLastGood: async () => undefined }));
  assert.deepEqual(result.source, { kind: 'none' });
  assert.match(result.log, /no earlier data$/);
  assert.ok(result.problem);
});

test('no open season is a state, not a failure: no fallback, no problem', async () => {
  let readBack = false;
  const result = await loadSource(
    deps({
      fails: 'no-season',
      fetchLastGood: async () => {
        readBack = true;
        return old;
      },
    })
  );
  assert.deepEqual(result.source, { kind: 'no-season' });
  assert.equal(readBack, false);
  assert.equal(result.problem, undefined);
});

test('no token (pull requests, or the secret removed): the last good data, never a call', async () => {
  let called = false;
  const result = await loadSource(
    deps({
      token: undefined,
      fetchLive: async () => {
        called = true;
        return live;
      },
    })
  );
  assert.equal(called, false);
  assert.deepEqual(result.source, { kind: 'stale', data: old });
  assert.match(result.log, /^ladders civ6: no CORE_API_WEBSITE_TOKEN; showing data from/);
  assert.equal(result.problem, undefined);
});

test('fixtures replace core-api for checks, and refuse to run with a token', async () => {
  const result = await loadSource(deps({ token: undefined, fixtures: 'tests/fixtures/core-api' }));
  assert.equal(result.source.kind, 'fresh');
  assert.equal(result.log, 'ladders civ6: test fixtures');
  await assert.rejects(loadSource(deps({ fixtures: 'tests/fixtures/core-api' })), /checks only/);
});
