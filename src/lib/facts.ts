import type { Ladders, Overview, SeasonStats } from './core-api';
import { formatCount, formatDate } from './format';
import { shownLadders } from './ladders';
import { banRows, mapRows, pickRows, rateHeading, shownModes } from './stats';

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

/**
 * A game's headline numbers: the season, its games and the players on each ladder; then its
 * standouts: the top of the first season ladder, and the busiest mode's most played map,
 * most banned leader and best leader.
 */
export function gameFacts(ladders: Ladders | undefined, stats: SeasonStats | undefined): Fact[] {
  const season = stats ?? ladders;
  const games = stats?.modes.reduce((sum, mode) => sum + mode.games, 0) ?? 0;
  const shown = ladders ? shownLadders(ladders) : [];
  const topLadder = shown.find(({ mode }) => mode.id !== 'cloud');
  const modes = stats ? shownModes(stats) : [];
  const busiest = [...modes].sort((a, b) => b.stats.games - a.stats.games)[0];
  const map = busiest ? mapRows(busiest.stats)[0] : undefined;
  const banned = busiest ? banRows(busiest.stats, 'leader')[0] : undefined;
  const best = busiest ? pickRows(busiest.mode, busiest.stats.leaders)[0] : undefined;
  const bestRate = best?.cells[1];
  // Name the mode only when there is more than one.
  const mode = busiest && modes.length > 1 ? ` (${busiest.mode.label})` : '';
  return [
    ...(season ? seasonFact(season) : []),
    ...(games > 0 ? [{ value: formatCount(games), label: 'games this season' }] : []),
    ...shown.map(({ mode: ladder, rows }) => ({
      value: formatCount(rows.length),
      label: `on the ${ladder.id === 'cloud' ? 'cloud' : ladder.label} ladder`,
    })),
    ...(topLadder ? [{ value: topLadder.rows[0].display_name, label: `top of the ${topLadder.mode.label} ladder` }] : []),
    ...(map ? [{ value: map.name, label: `most played map${mode}, ${map.cells[1]} of games` }] : []),
    ...(banned ? [{ value: banned.name, label: `most banned in drafts${mode}` }] : []),
    ...(best && bestRate && bestRate !== '—' && busiest
      ? [{ value: best.name, label: `best ${rateHeading(busiest.mode)}${mode}: ${bestRate}` }]
      : []),
  ];
}
