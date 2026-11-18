import { z } from 'astro/zod';
import { formatDate } from './format';
import type { Standings } from './challonge';

/** Ids already on the tournaments pages, which a tournament file name must not take. */
const RESERVED = new Set([
  'main',
  'on-this-page',
  'past-winners',
  'site-nav',
  'footer-follow',
  'footer-support',
]);

interface Sortable {
  id: string;
  data: { order?: number; winners?: string[]; endedOn?: Date };
}

/**
 * Active tournaments (no `winners`) by `order`, then file name; past ones (with
 * `winners`) newest `endedOn` first, then those with no date, by file name.
 */
export function splitTournaments<T extends Sortable>(entries: T[]): { active: T[]; past: T[] } {
  const reserved = entries.find((entry) => RESERVED.has(entry.id));
  if (reserved) {
    throw new Error(`src/content/tournaments/${reserved.id}.yaml: choose another file name`);
  }
  const byName = (a: T, b: T) => a.id.localeCompare(b.id, 'en');
  const last = Number.MAX_SAFE_INTEGER;
  const active = entries
    .filter((entry) => !entry.data.winners)
    .sort((a, b) => (a.data.order ?? last) - (b.data.order ?? last) || byName(a, b));
  const past = entries
    .filter((entry) => entry.data.winners)
    .sort(
      (a, b) =>
        (b.data.endedOn?.getTime() ?? -last) - (a.data.endedOn?.getTime() ?? -last) || byName(a, b)
    );
  return { active, past };
}

const count = z.number().int().nonnegative();

const bracketDataSchema = z.object({
  challonge: z.string().min(1),
  updated_at: z.iso.datetime(),
  finished: z.boolean(),
  rows: z.array(
    z.object({
      rank: z.number().int().positive().nullable(),
      name: z.string().min(1).max(200),
      record: z.object({ wins: count, losses: count, ties: count }).optional(),
    })
  ),
});

/**
 * `/data/<game>/tournaments.json`: the standings on the page, published as the
 * last good data for the next build. Only fields the page shows.
 */
export const publishedSchema = z.object({
  updated_at: z.iso.datetime(),
  brackets: z.array(bracketDataSchema),
});

export type Published = z.infer<typeof publishedSchema>;
type BracketData = Published['brackets'][number];

export type BracketState =
  /** Standings fetched in this build. */
  | { kind: 'fresh'; data: BracketData }
  /** Fetch failed; the last good standings from the live site. */
  | { kind: 'stale'; data: BracketData }
  /** Fetch failed and there is no earlier data. */
  | { kind: 'none' }
  /** No API key: link to Challonge only. */
  | { kind: 'off' };

export interface LoadOptions {
  apiKey: string | undefined;
  now: Date;
  /** Standings for one bracket; throws on failure. */
  fetchStandings: (apiId: string, apiKey: string) => Promise<Standings>;
  /** The published file from the live site; undefined if it can't be read. */
  fetchLastGood: () => Promise<Published | undefined>;
  /** Short reason for a failure, safe to log. */
  reason: (error: unknown) => string;
}

export interface LoadResult {
  states: Map<string, BracketState>;
  published: Published;
  log: string[];
}

/**
 * Standings for each bracket (by Challonge API id). A failed bracket falls back to
 * the last good data published on the live site; no key means link-only.
 */
export async function loadBrackets(apiIds: string[], options: LoadOptions): Promise<LoadResult> {
  const { apiKey, now } = options;
  const states = new Map<string, BracketState>();
  const log: string[] = [];
  const ids = [...new Set(apiIds)];

  if (!apiKey) {
    for (const apiId of ids) states.set(apiId, { kind: 'off' });
    if (ids.length > 0) log.push('no CHALLONGE_API_KEY: brackets link to Challonge only');
    return { states, published: { updated_at: now.toISOString(), brackets: [] }, log };
  }

  const failed: { apiId: string; why: string }[] = [];
  for (const apiId of ids) {
    try {
      const standings = await options.fetchStandings(apiId, apiKey);
      states.set(apiId, {
        kind: 'fresh',
        data: { challonge: apiId, updated_at: now.toISOString(), ...standings },
      });
      log.push(`${apiId}: updated`);
    } catch (error) {
      failed.push({ apiId, why: options.reason(error) });
    }
  }

  const lastGood = failed.length > 0 ? await options.fetchLastGood() : undefined;
  for (const { apiId, why } of failed) {
    const data = lastGood?.brackets.find((bracket) => bracket.challonge === apiId);
    if (data) {
      states.set(apiId, { kind: 'stale', data });
      log.push(`${apiId}: ${why}; showing data from ${formatDate(new Date(data.updated_at))}`);
    } else {
      states.set(apiId, { kind: 'none' });
      log.push(`${apiId}: ${why}; no earlier data`);
    }
  }

  const brackets = ids.flatMap((apiId) => {
    const state = states.get(apiId);
    return state?.kind === 'fresh' || state?.kind === 'stale' ? [state.data] : [];
  });
  return { states, published: { updated_at: now.toISOString(), brackets }, log };
}
