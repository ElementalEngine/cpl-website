import type { Ladders, Overview, SeasonStats } from './core-api';
import { formatCount, formatDate } from './format';
import { shownLadders } from './ladders';

/** A headline number with its label, e.g. "157" · "on the FFA ladder". */
export interface Fact {
  value: string;
  label: string;
}

/** League totals: registered players and games played. */
export function overviewFacts(overview: Overview): Fact[] {
  return [
    { value: formatCount(overview.registered_players), label: 'registered players' },
    { value: formatCount(overview.matches_played), label: 'games played' },
  ];
}

/** "Season 7" · "started 1 Nov 2026", when a season is open. */
export function seasonFact(data: { season_label: string | null; season_started_at: string | null }): Fact[] {
  if (!data.season_label || !data.season_started_at) return [];
  return [{ value: data.season_label, label: `started ${formatDate(new Date(data.season_started_at))}` }];
}

/** A game's headline numbers: the season, its games, and the players on each ladder with players. */
export function gameFacts(ladders: Ladders | undefined, stats: SeasonStats | undefined): Fact[] {
  const season = stats ?? ladders;
  const games = stats?.modes.reduce((sum, mode) => sum + mode.games, 0) ?? 0;
  return [
    ...(season ? seasonFact(season) : []),
    ...(games > 0 ? [{ value: formatCount(games), label: 'games this season' }] : []),
    ...(ladders ? shownLadders(ladders) : []).map(({ mode, rows }) => ({
      value: formatCount(rows.length),
      label: `on the ${mode.id === 'cloud' ? 'cloud' : mode.label} ladder`,
    })),
  ];
}
