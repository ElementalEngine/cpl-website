import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  challongeId,
  failureReason,
  fetchStandings,
  standingsFrom,
  tournamentResponseSchema,
  type ChallongeTournament,
} from '../src/lib/challonge';
import { FetchError, getJson } from '../src/lib/http';

test('links: the bracket URL, with a sub-page, query, # or language prefix', () => {
  assert.equal(challongeId('https://challonge.com/9m78dlwk'), '9m78dlwk');
  assert.equal(challongeId('https://challonge.com/CPL_PL_S6_D1/standings'), 'CPL_PL_S6_D1');
  assert.equal(challongeId('https://www.challonge.com/CPL_PBC_2v2_S8_D1/'), 'CPL_PBC_2v2_S8_D1');
  assert.equal(challongeId('https://challonge.com/fr/abc123?tab=1#top'), 'abc123');
  assert.equal(challongeId('https://challonge.com/pt_BR/abc123/module'), 'abc123');
  assert.equal(challongeId('https://challonge.com/ab/standings'), 'ab', 'a 2-letter bracket is not a language');
});

test('links: community and organisation subdomains become <subdomain>-<url>', () => {
  assert.equal(challongeId('https://cpl.challonge.com/pl_s7_d1'), 'cpl-pl_s7_d1');
  assert.equal(challongeId('https://CPL-Civ.challonge.com/pl_s7_d1/standings'), 'cpl-civ-pl_s7_d1');
});

test('links: anything that is not a bracket is refused', () => {
  for (const link of [
    'http://challonge.com/abc123',
    'https://challonge.com/',
    'https://challonge.com/communities/cpl',
    'https://challonge.com/users/someone',
    'https://challonge.com/abc-123',
    'https://challonge.com/abc123/standings/extra',
    'https://challonge.com/abc123/unknown',
    'https://api.challonge.com/abc123',
    'https://challonge.com.evil.example/abc123',
    'https://example.org/abc123',
    'not a link',
  ]) {
    assert.equal(challongeId(link), undefined, link);
  }
});

function tournament(partial: Partial<ChallongeTournament>): ChallongeTournament {
  return { state: 'underway', tournament_type: 'round robin', participants: [], matches: [], ...partial };
}
const person = (id: number, name: string, extra = {}) => ({ participant: { id, name, ...extra } });
const match = (p1: number, p2: number, winner: number | string | null, state = 'complete') => ({
  match: { state, player1_id: p1, player2_id: p2, winner_id: winner },
});

test('mapping: running league ranked by record; equal records share a place; ties count half', () => {
  const standings = standingsFrom(
    tournament({
      participants: [person(1, 'Ann'), person(2, 'Bob'), person(3, 'Cy'), person(4, 'Di')],
      matches: [match(1, 2, 1), match(3, 4, 3), match(1, 3, null), match(2, 4, null, 'open')],
    })
  );
  assert.equal(standings.finished, false);
  assert.deepEqual(standings.rows, [
    { rank: 1, name: 'Ann', record: { wins: 1, losses: 0, ties: 1 } },
    { rank: 1, name: 'Cy', record: { wins: 1, losses: 0, ties: 1 } },
    { rank: 3, name: 'Di', record: { wins: 0, losses: 1, ties: 0 } },
    { rank: 3, name: 'Bob', record: { wins: 0, losses: 1, ties: 0 } },
  ].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)));
});

test('mapping: finished brackets use Challonge final ranks; group-stage ids count', () => {
  const standings = standingsFrom(
    tournament({
      state: 'complete',
      participants: [
        person(1, 'Ann', { final_rank: 2, group_player_ids: [11] }),
        person(2, ' ', { display_name: 'bob_user', final_rank: 1, group_player_ids: [12] }),
      ],
      matches: [match(11, 12, 12)],
    })
  );
  assert.equal(standings.finished, true);
  assert.deepEqual(standings.rows, [
    { rank: 1, name: 'bob_user', record: { wins: 1, losses: 0, ties: 0 } },
    { rank: 2, name: 'Ann', record: { wins: 0, losses: 1, ties: 0 } },
  ]);
});

test('mapping: no two-player matches (e.g. free for all) → names by seed, no record', () => {
  const standings = standingsFrom(
    tournament({
      tournament_type: 'free for all',
      participants: [
        person(1, 'Zed', { seed: 1 }),
        person(2, 'Amy', { seed: 2 }),
        person(3, 'Waiting', { seed: 3, on_waiting_list: true }),
      ],
    })
  );
  assert.deepEqual(standings.rows, [
    { rank: null, name: 'Zed' },
    { rank: null, name: 'Amy' },
  ]);
});

test('schema: real-shaped API JSON parses; unknown fields are dropped; bad shapes fail', () => {
  const body = {
    tournament: {
      id: 1,
      name: 'CPL PL S6 D1',
      state: 'underway',
      tournament_type: 'round robin',
      participants: [{ participant: { id: 5, name: 'Ann', email_hash: 'x', final_rank: null, seed: 1 } }],
      matches: [{ match: { id: 9, state: 'open', player1_id: 5, player2_id: null, winner_id: null } }],
    },
  };
  const parsed = tournamentResponseSchema.parse(body);
  assert.equal('email_hash' in parsed.tournament.participants[0].participant, false);
  assert.ok(!tournamentResponseSchema.safeParse({ tournament: { state: 1 } }).success);
  assert.ok(!tournamentResponseSchema.safeParse({ errors: ['Not found'] }).success);
});

function stubFetch(responses: (Response | Error)[]) {
  const calls: string[] = [];
  const fn = (async (url: string | URL | Request) => {
    calls.push(String(url));
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
  return { fn, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fast = { retryDelayMs: 0, timeoutMs: 1000 };

test('fetch: API v1 URL with participants, matches and the key; maps the response', async () => {
  const { fn, calls } = stubFetch([
    json({ tournament: { state: 'complete', tournament_type: 'swiss', participants: [person(1, 'Ann', { final_rank: 1 })] } }),
  ]);
  const standings = await fetchStandings('cpl-pl_s7', 'k3y', { ...fast, fetch: fn });
  assert.deepEqual(standings, { finished: true, rows: [{ rank: 1, name: 'Ann' }] });
  const url = new URL(calls[0]);
  assert.equal(url.origin + url.pathname, 'https://api.challonge.com/v1/tournaments/cpl-pl_s7.json');
  assert.equal(url.searchParams.get('include_participants'), '1');
  assert.equal(url.searchParams.get('include_matches'), '1');
  assert.equal(url.searchParams.get('api_key'), 'k3y');
});

test('fetch: one retry after a server error or network error, then success', async () => {
  for (const first of [json({}, 503), new TypeError('fetch failed')]) {
    const ok = json({ tournament: { state: 'pending', tournament_type: 'swiss' } });
    const { fn, calls } = stubFetch([first, ok]);
    await fetchStandings('abc', 'k', { ...fast, fetch: fn });
    assert.equal(calls.length, 2);
  }
});

test('fetch: gives up after the retry; no retry on 401/404; reasons never hold the key', async () => {
  const twice = stubFetch([json({}, 502), json({}, 502)]);
  await assert.rejects(fetchStandings('abc', 'k', { ...fast, fetch: twice.fn }), /HTTP 502/);
  assert.equal(twice.calls.length, 2);

  for (const status of [401, 404]) {
    const once = stubFetch([json({}, status)]);
    const error = await fetchStandings('abc', 'secret-key', { ...fast, fetch: once.fn }).catch((e) => e);
    assert.equal(once.calls.length, 1);
    const reason = failureReason(error);
    assert.match(reason, new RegExp(`HTTP ${status}`));
    assert.doesNotMatch(reason, /secret-key/);
  }

  const bad = stubFetch([json({ unexpected: true })]);
  await assert.rejects(fetchStandings('abc', 'k', { ...fast, fetch: bad.fn }), /unexpected response shape/);
});

test('fetch: a timeout is retried once and reported as "timed out"', async () => {
  let calls = 0;
  const timeout = (async () => {
    calls += 1;
    throw new DOMException('The operation timed out.', 'TimeoutError');
  }) as typeof fetch;
  const error = await getJson('https://example.org/x', { fetch: timeout, retryDelayMs: 0 }).catch((e) => e);
  assert.ok(error instanceof FetchError);
  assert.equal(error.message, 'timed out');
  assert.equal(calls, 2);
});
