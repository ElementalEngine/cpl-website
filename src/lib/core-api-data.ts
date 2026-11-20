import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { z } from 'astro/zod';
import { CORE_API_ROUTES, failureKind, failureReason, getCoreApi, laddersSchema, type Ladders } from './core-api';
import { formatDate } from './format';
import { getJson } from './http';
import type { GameId } from './nav';

export type Source<T> =
  /** Fetched in this build (or read from the test fixtures). */
  | { kind: 'fresh'; data: T }
  /** The fetch failed or is switched off; the last good data from the live site. */
  | { kind: 'stale'; data: T }
  /** No data yet. */
  | { kind: 'none' }
  /** Season stats only: the edition has no open season. */
  | { kind: 'no-season' };

export interface LoadDeps<T> {
  /** For log lines, e.g. "ladders civ6". */
  label: string;
  token: string | undefined;
  /** Folder of test fixtures, read instead of core-api. Never together with a token. */
  fixtures: string | undefined;
  fetchLive: (token: string) => Promise<T>;
  readFixture: (folder: string) => Promise<T>;
  /** The last good data published on the live site; undefined if it can't be read. */
  fetchLastGood: () => Promise<T | undefined>;
  /** What a failed call means (see `failureKind`). */
  kindOf: (error: unknown) => ReturnType<typeof failureKind>;
}

interface Loaded<T> {
  source: Source<T>;
  log: string;
  /** Set when someone has to fix something (wrong token, route or shape): the deploy run then fails. */
  problem?: string;
}

/**
 * One core-api answer for the build. With a token: the live answer, or the last good data if the
 * call fails. Without one: the last good data (the fetch is switched off). Fixtures: for checks only.
 */
export async function loadSource<T extends { updated_at: string }>(deps: LoadDeps<T>): Promise<Loaded<T>> {
  const { label } = deps;
  if (deps.fixtures) {
    if (deps.token) {
      throw new Error('CORE_API_FIXTURES is for checks only: unset it when CORE_API_WEBSITE_TOKEN is set');
    }
    const data = await deps.readFixture(deps.fixtures);
    return { source: { kind: 'fresh', data }, log: `${label}: test fixtures` };
  }

  let why = 'no CORE_API_WEBSITE_TOKEN';
  let problem: string | undefined;
  if (deps.token) {
    try {
      return { source: { kind: 'fresh', data: await deps.fetchLive(deps.token) }, log: `${label}: updated` };
    } catch (error) {
      const kind = deps.kindOf(error);
      if (kind === 'no-season') return { source: { kind: 'no-season' }, log: `${label}: no season open` };
      why = failureReason(error);
      if (kind === 'bug') problem = `${label}: ${why}`;
    }
  }

  const lastGood = await deps.fetchLastGood();
  if (!lastGood) return { source: { kind: 'none' }, log: `${label}: ${why}; no earlier data`, problem };
  const date = formatDate(new Date(lastGood.updated_at));
  return { source: { kind: 'stale', data: lastGood }, log: `${label}: ${why}; showing data from ${date}`, problem };
}

// Read by the deploy job's last step. Holds reasons only, never a token.
const PROBLEMS_FILE = 'core-api-problems.txt';

/** Loads one route for the build, logs the outcome and records a problem for the deploy job. */
async function load<T extends { updated_at: string }>(
  label: string,
  path: string,
  schema: z.ZodType<T>,
  fixture: string,
  published: string
): Promise<Source<T>> {
  const lastGoodUrl = new URL(published, import.meta.env.SITE).href;
  const result = await loadSource<T>({
    label,
    token: process.env.CORE_API_WEBSITE_TOKEN?.trim() || undefined,
    fixtures: process.env.CORE_API_FIXTURES?.trim() || undefined,
    fetchLive: (token) => getCoreApi(path, schema, token),
    readFixture: async (folder) => schema.parse(JSON.parse(await readFile(join(folder, fixture), 'utf8'))),
    fetchLastGood: async () => {
      try {
        const parsed = schema.safeParse(await getJson(lastGoodUrl));
        if (parsed.success) return parsed.data;
        console.warn(`core-api (${label}): last good data has an unexpected shape`);
      } catch (error) {
        console.warn(`core-api (${label}): last good data unavailable (${failureReason(error)})`);
      }
      return undefined;
    },
    kindOf: (error) => failureKind(error, path),
  });
  console.log(`core-api (${result.log})`);
  if (result.problem) await appendFile(PROBLEMS_FILE, `${result.problem}\n`);
  return result.source;
}

const ladders = new Map<GameId, Promise<Source<Ladders>>>();

/** A game's ladders, fetched once per build and shared by every page. Published at `/data/<game>/ladders.json`. */
export function getLadders(game: GameId): Promise<Source<Ladders>> {
  let result = ladders.get(game);
  if (!result) {
    const route = CORE_API_ROUTES.ladders(game);
    result = load(`ladders ${game}`, route, laddersSchema, `ladders-${game}.json`, `/data/${game}/ladders.json`);
    ladders.set(game, result);
  }
  return result;
}
