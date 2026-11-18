import { getCollection } from 'astro:content';
import { failureReason, fetchStandings } from './challonge';
import { getJson } from './http';
import type { GameId } from './nav';
import { loadBrackets, publishedSchema, splitTournaments, type LoadResult } from './tournaments';

/** A game's tournaments from `src/content/tournaments/`, split into active and past. */
export async function getTournaments(game: GameId) {
  const entries = await getCollection('tournaments');
  return splitTournaments(entries.filter((entry) => entry.data.game === game));
}

/** Where this site publishes a game's standings; the next build reads it back if Challonge fails. */
function lastGoodUrl(game: GameId): string {
  return new URL(`/data/${game}/tournaments.json`, import.meta.env.SITE).href;
}

async function load(game: GameId): Promise<LoadResult> {
  const { active } = await getTournaments(game);
  const apiIds = active.flatMap((entry) => entry.data.brackets.map((bracket) => bracket.apiId));
  const result = await loadBrackets(apiIds, {
    apiKey: process.env.CHALLONGE_API_KEY?.trim() || undefined,
    now: new Date(),
    fetchStandings: (apiId, apiKey) => fetchStandings(apiId, apiKey),
    fetchLastGood: async () => {
      try {
        const parsed = publishedSchema.safeParse(await getJson(lastGoodUrl(game)));
        if (parsed.success) return parsed.data;
        console.warn(`Challonge (${game}): last good data has an unexpected shape`);
      } catch (error) {
        console.warn(`Challonge (${game}): last good data unavailable (${failureReason(error)})`);
      }
      return undefined;
    },
    reason: failureReason,
  });
  for (const line of result.log) console.log(`Challonge (${game}): ${line}`);
  return result;
}

const loaded = new Map<GameId, Promise<LoadResult>>();

/** Standings for a game's active brackets. Fetched once per build, shared by every page. */
export function getBracketData(game: GameId): Promise<LoadResult> {
  let result = loaded.get(game);
  if (!result) {
    result = load(game);
    loaded.set(game, result);
  }
  return result;
}
