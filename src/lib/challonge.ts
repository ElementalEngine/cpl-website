import { z } from 'astro/zod';
import { FetchError, getJson, type GetJsonOptions } from './http';

const API = 'https://api.challonge.com/v1';

// First path parts on challonge.com that are never a tournament.
const NOT_TOURNAMENTS = new Set([
  'about',
  'api',
  'communities',
  'dashboard',
  'events',
  'games',
  'leagues',
  'login',
  'organizations',
  'search',
  'settings',
  'signup',
  'tournaments',
  'users',
]);
// Pages inside a tournament: challonge.com/<url>/standings and so on.
const SUBPAGES = new Set(['groups', 'log', 'matches', 'module', 'participants', 'stations', 'standings']);
const LOCALE = /^[a-z]{2}(?:_[A-Z]{2})?$/;
const TOURNAMENT_URL = /^[A-Za-z0-9_]+$/;
const SUBDOMAIN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * The API identifier for a Challonge bracket link, as copied from the browser:
 * `challonge.com/<url>` → `<url>`, `<subdomain>.challonge.com/<url>` → `<subdomain>-<url>`.
 * A language prefix (`/fr/`), a sub-page (`/standings`), a query or `#` part are ignored.
 * Undefined if the link is not a Challonge bracket.
 */
export function challongeId(link: string): string | undefined {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:') return undefined;

  const host = url.hostname.toLowerCase();
  let subdomain: string | undefined;
  if (host !== 'challonge.com' && host !== 'www.challonge.com') {
    if (!host.endsWith('.challonge.com')) return undefined;
    subdomain = host.slice(0, -'.challonge.com'.length);
    if (!SUBDOMAIN.test(subdomain) || subdomain === 'api') return undefined;
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length > 1 && LOCALE.test(parts[0]) && !SUBPAGES.has(parts[1])) parts.shift();
  const [slug, page, ...rest] = parts;
  if (!slug || !TOURNAMENT_URL.test(slug) || NOT_TOURNAMENTS.has(slug.toLowerCase())) return undefined;
  if (rest.length > 0 || (page !== undefined && !SUBPAGES.has(page))) return undefined;
  return subdomain ? `${subdomain}-${slug}` : slug;
}

const id = z.number().int();

const participantSchema = z.object({
  participant: z.object({
    id,
    name: z.string().nullish(),
    display_name: z.string().nullish(),
    final_rank: z.number().int().positive().nullish(),
    seed: z.number().int().nullish(),
    on_waiting_list: z.boolean().nullish(),
    // Group-stage matches name players by these ids instead of the participant id.
    group_player_ids: z.array(id).nullish(),
  }),
});

const matchSchema = z.object({
  match: z.object({
    state: z.string(),
    player1_id: id.nullish(),
    player2_id: id.nullish(),
    winner_id: z.union([id, z.string()]).nullish(),
  }),
});

/** The fields we read from `GET /v1/tournaments/<id>.json` with participants and matches. */
export const tournamentResponseSchema = z.object({
  tournament: z.object({
    name: z.string().nullish(),
    state: z.string(),
    tournament_type: z.string(),
    participants: z.array(participantSchema).default([]),
    matches: z.array(matchSchema).default([]),
  }),
});

export type ChallongeTournament = z.infer<typeof tournamentResponseSchema>['tournament'];

interface MatchRecord {
  wins: number;
  losses: number;
  ties: number;
}

interface StandingsRow {
  /** Place; equal records share one. Null when no place is known yet. */
  rank: number | null;
  name: string;
  /** Present for brackets of two-player matches. */
  record?: MatchRecord;
}

export interface Standings {
  finished: boolean;
  rows: StandingsRow[];
}

function displayName(participant: { name?: string | null; display_name?: string | null }): string {
  return participant.name?.trim() || participant.display_name?.trim() || 'Unnamed';
}

/**
 * Our standings table from a Challonge tournament. When it has ended, places are
 * Challonge's final ranks. Before that, places follow match record (wins, then
 * fewer losses; a tie counts half a win), and equal records share a place.
 */
export function standingsFrom(tournament: ChallongeTournament): Standings {
  const people = tournament.participants
    .map(({ participant }) => participant)
    .filter((participant) => !participant.on_waiting_list);

  const owner = new Map<number, number>();
  const records = new Map<number, MatchRecord>();
  for (const person of people) {
    records.set(person.id, { wins: 0, losses: 0, ties: 0 });
    owner.set(person.id, person.id);
    for (const groupId of person.group_player_ids ?? []) owner.set(groupId, person.id);
  }

  let played = 0;
  for (const { match } of tournament.matches) {
    if (match.state !== 'complete') continue;
    const a = owner.get(match.player1_id ?? -1);
    const b = owner.get(match.player2_id ?? -1);
    if (a === undefined || b === undefined) continue;
    const winner = typeof match.winner_id === 'number' ? owner.get(match.winner_id) : undefined;
    if (winner !== undefined && winner !== a && winner !== b) continue;
    const ra = records.get(a);
    const rb = records.get(b);
    if (!ra || !rb) continue;
    played += 1;
    if (winner === a) {
      ra.wins += 1;
      rb.losses += 1;
    } else if (winner === b) {
      rb.wins += 1;
      ra.losses += 1;
    } else {
      ra.ties += 1;
      rb.ties += 1;
    }
  }

  // Two-player brackets get a record from the start (0–0), so the table shape doesn't change with the first result.
  const twoPlayer =
    played > 0 || tournament.matches.some(({ match }) => match.player1_id != null || match.player2_id != null);
  const finished = tournament.state === 'complete';
  const useFinal =
    finished && people.length > 0 && people.every((person) => person.final_rank != null);
  const score = (r: MatchRecord) => r.wins + r.ties / 2;

  const rows = people.map((person) => {
    const record = records.get(person.id) ?? { wins: 0, losses: 0, ties: 0 };
    let rank: number | null = null;
    if (useFinal) {
      rank = person.final_rank ?? null;
    } else if (played > 0) {
      const ahead = people.filter((other) => {
        const r = records.get(other.id) ?? record;
        return score(r) > score(record) || (score(r) === score(record) && r.losses < record.losses);
      });
      rank = ahead.length + 1;
    }
    return {
      rank,
      name: displayName(person),
      seed: person.seed ?? Number.MAX_SAFE_INTEGER,
      record,
    };
  });

  rows.sort(
    (x, y) =>
      (x.rank ?? Number.MAX_SAFE_INTEGER) - (y.rank ?? Number.MAX_SAFE_INTEGER) ||
      (played > 0 ? 0 : x.seed - y.seed) ||
      x.name.localeCompare(y.name, 'en')
  );

  return {
    finished,
    rows: rows.map(({ rank, name, record }) => (twoPlayer ? { rank, name, record } : { rank, name })),
  };
}

/** Why a Challonge request failed, in words safe to log (never the URL or key). */
export function failureReason(error: unknown): string {
  if (error instanceof FetchError) {
    if (error.message === 'HTTP 401') return 'HTTP 401 (key rejected)';
    if (error.message === 'HTTP 404') return 'HTTP 404 (not found, or the key cannot read it)';
    return error.message;
  }
  return 'unexpected error';
}

/** One tournament from the Challonge API v1, checked against the schema. Throws on any failure. */
export async function fetchTournament(
  apiId: string,
  apiKey: string,
  options: GetJsonOptions = {}
): Promise<ChallongeTournament> {
  const query = new URLSearchParams({
    include_participants: '1',
    include_matches: '1',
    api_key: apiKey,
  });
  const body = await getJson(`${API}/tournaments/${encodeURIComponent(apiId)}.json?${query}`, options);
  const parsed = tournamentResponseSchema.safeParse(body);
  if (!parsed.success) throw new FetchError('unexpected response shape', false);
  return parsed.data.tournament;
}

/** Standings for one bracket. Throws on any failure. */
export async function fetchStandings(
  apiId: string,
  apiKey: string,
  options: GetJsonOptions = {}
): Promise<Standings> {
  return standingsFrom(await fetchTournament(apiId, apiKey, options));
}
