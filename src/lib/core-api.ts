import { z } from 'astro/zod';
import { FetchError, getJson } from './http';

/** core-api's public host. Not a secret: only GET on the website's routes answers, and only with the token. */
const CORE_API_BASE = 'https://api.elementalengine.net';

export const CORE_API_ROUTES = {
  overview: () => '/api/v2/public/overview',
  ladders: (edition: string) => `/api/v2/public/ladders/${edition}`,
  stats: (edition: string) => `/api/v2/public/seasons/${edition}/current/stats`,
} as const;

// Only the fields the pages show are declared: anything else in an answer is dropped,
// so the published last good data holds nothing more (no μ or σ, no tokens).
const count = z.number().int().nonnegative();
const time = z.iso.datetime({ offset: true });
const name = z.string();

export const overviewSchema = z.object({
  updated_at: time,
  registered_players: count,
  matches_played: count,
});

const ladderRowSchema = z.object({
  rank: z.number().int().positive(),
  display_name: name,
  rating: z.number().int(),
  games: count,
  wins: count,
  first: count,
  last_active_at: time.nullable(),
});

export const laddersSchema = z.object({
  updated_at: time,
  season_label: z.string().nullable(),
  season_started_at: time.nullable(),
  min_games: count,
  // A ladder key the site doesn't know is ignored, not an error.
  ladders: z.array(z.object({ key: z.string(), rows: z.array(ladderRowSchema) })),
});

const pickSchema = z.object({
  name,
  picks: count,
  wins: count,
  firsts: count,
  win_rate: z.number().min(0).max(1).nullable(),
});

const modeStatsSchema = z.object({
  mode: z.string(),
  games: count,
  maps: z.array(z.object({ map: name, games: count })),
  draft_bans: z.array(z.object({ name, kind: z.string(), bans: count })),
  leaders: z.array(pickSchema),
  civs: z.array(pickSchema),
  map_picks: z.array(
    z.object({
      map: name,
      kind: z.string(),
      rows: z.array(z.object({ name, games: count, avg_placement: z.number().min(1) })),
    })
  ),
});

export const seasonStatsSchema = z.object({
  updated_at: time,
  season_label: z.string(),
  season_started_at: time,
  min_games: count,
  modes: z.array(modeStatsSchema),
});

export type Ladders = z.infer<typeof laddersSchema>;
export type LadderRow = Ladders['ladders'][number]['rows'][number];

/** A response that doesn't match its schema. The message names the field, never a value. */
export class ShapeError extends Error {
  constructor(path: readonly PropertyKey[] = []) {
    super(`unexpected response shape at ${path.map(String).join('.') || 'top level'}`);
    this.name = 'ShapeError';
  }
}

/** core-api reports a missing or wrong website token as its own setup error. */
const MISCONFIGURED = 'WEBSITE_SERVICE_MISCONFIGURED';

/**
 * Rate limited: wait out the minute. Down or restarting (a release takes about 20 s): wait 20 s.
 * A setup error won't fix itself, so no retry.
 */
export function retryDelay(error: FetchError): number | null {
  if (error.code === MISCONFIGURED) return null;
  return error.status === 429 ? 60_000 : 20_000;
}

interface CoreApiOptions {
  fetch?: typeof fetch;
  retryDelayMs?: (error: FetchError) => number | null;
}

/** GET one route with the website token: 15 s timeout, one retry, schema-checked. */
export async function getCoreApi<T>(
  path: string,
  schema: z.ZodType<T>,
  token: string,
  options: CoreApiOptions = {}
): Promise<T> {
  const body = await getJson(`${CORE_API_BASE}${path}`, {
    fetch: options.fetch,
    headers: { authorization: `Bearer ${token}` },
    timeoutMs: 15_000,
    retryDelayMs: options.retryDelayMs ?? retryDelay,
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ShapeError(parsed.error.issues[0]?.path);
  return parsed.data;
}

/**
 * What a failed call means:
 * - `no-season`: season stats for an edition with no open season (404 `NOT_FOUND`);
 * - `down`: core-api is slow, restarting or rate limited; it recovers by itself;
 * - `bug`: a wrong token, route or response shape; someone has to fix it.
 */
export type FailureKind = 'no-season' | 'down' | 'bug';

export function failureKind(error: unknown, path: string): FailureKind {
  if (!(error instanceof FetchError)) return 'bug';
  if (error.status === 404 && error.code === 'NOT_FOUND' && path.endsWith('/current/stats')) {
    return 'no-season';
  }
  if (error.code === MISCONFIGURED) return 'bug';
  // No status: a timeout or network error. 429 and 5xx: rate limited or down.
  if (error.status === undefined || error.retryable) return 'down';
  return 'bug';
}

/** A short reason for a failure, safe to log. */
export function failureReason(error: unknown): string {
  return error instanceof FetchError || error instanceof ShapeError ? error.message : 'unexpected error';
}
