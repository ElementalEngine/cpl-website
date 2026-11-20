import type { ModeStats, SeasonStats } from './core-api';
import type { Source } from './core-api-data';
import { formatCount, formatDate } from './format';
import { STATS_MODES, type GameId, type NavLink } from './nav';

/** Rows shown in the maps and bans tables, and maps given a "best picks" table. A display choice. */
const TOP = 10;

type Mode = (typeof STATS_MODES)[number];
type Pick = ModeStats['leaders'][number];

interface ShownMode {
  mode: Mode;
  stats: ModeStats;
}

/** A row for `SimpleTable`: the name, then one cell per column. */
export interface Row {
  name: string;
  cells: string[];
}

/** Modes with games this season, in tab order. Modes the site doesn't know are left out. */
export function shownModes(data: SeasonStats): ShownMode[] {
  return STATS_MODES.flatMap((mode) => {
    const stats = data.modes.find((item) => item.mode === mode.id);
    return stats && stats.games > 0 ? [{ mode, stats }] : [];
  });
}

export function statsHref(game: GameId, mode: Mode['id']): string {
  return `/${game}/stats/${mode}/`;
}

export function statsTabs(game: GameId, shown: ShownMode[]): NavLink[] {
  return shown.map(({ mode }) => ({ label: mode.label, href: statsHref(game, mode.id) }));
}

/** "Season 8 · started 1 Nov 2026 · 412 games" */
export function statsSubtitle(data: SeasonStats, stats: ModeStats): string {
  const games = `${formatCount(stats.games)} ${stats.games === 1 ? 'game' : 'games'}`;
  return `${data.season_label} · started ${formatDate(new Date(data.season_started_at))} · ${games}`;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

/** Most played maps: Map · Games · Share of this mode's games. */
export function mapRows(stats: ModeStats): Row[] {
  return stats.maps.slice(0, TOP).map(({ map, games }) => ({
    name: map,
    cells: [formatCount(games), percent(games / stats.games)],
  }));
}

/** Most banned in drafts, for leaders or (Civ 7) civs: Name · Bans. */
export function banRows(stats: ModeStats, kind: 'leader' | 'civ'): Row[] {
  return stats.draft_bans
    .filter((ban) => ban.kind === kind)
    .slice(0, TOP)
    .map((ban) => ({ name: ban.name, cells: [formatCount(ban.bans)] }));
}

/**
 * In FFA a core-api "win" means the rating went up, so FFA shows 1st place %; Teamer and Duel
 * show win %. Below the minimum games core-api sends no rate, and the cell is "—".
 */
export function rateHeading(mode: Mode): string {
  return mode.id === 'ffa' ? '1st place %' : 'Win %';
}

function rateOf(mode: Mode, pick: Pick): number | null {
  if (pick.win_rate === null || pick.picks === 0) return null;
  return mode.id === 'ffa' ? pick.firsts / pick.picks : pick.win_rate;
}

/** Leaders or civs: Name · Picks · rate. Rows with a rate first (highest first), then "—" rows by picks. */
export function pickRows(mode: Mode, picks: Pick[]): Row[] {
  return picks
    .map((pick) => ({ pick, rate: rateOf(mode, pick) }))
    .sort(
      (a, b) =>
        (a.rate === null ? 1 : 0) - (b.rate === null ? 1 : 0) ||
        (b.rate ?? 0) - (a.rate ?? 0) ||
        b.pick.picks - a.pick.picks ||
        a.pick.name.localeCompare(b.pick.name, 'en')
    )
    .map(({ pick, rate }) => ({
      name: pick.name,
      cells: [formatCount(pick.picks), rate === null ? '—' : percent(rate)],
    }));
}

interface MapPicks {
  map: string;
  kind: 'leader' | 'civ';
  rows: Row[];
}

/** FFA only: the best picks by average place on each of the most played maps, in that order. */
export function bestPerMap(stats: ModeStats): MapPicks[] {
  const maps = stats.maps.slice(0, TOP).map(({ map }) => map);
  return maps.flatMap((map) =>
    stats.map_picks.flatMap((item) => {
      if (item.map !== map || item.rows.length === 0) return [];
      if (item.kind !== 'leader' && item.kind !== 'civ') return [];
      const rows = item.rows.map((row) => ({
        name: row.name,
        cells: [formatCount(row.games), row.avg_placement.toFixed(1)],
      }));
      return [{ map, kind: item.kind, rows }];
    })
  );
}

/** What a game's stats page says when no mode has games. */
export function noStatsMessage(source: Source<SeasonStats>): string {
  if (source.kind === 'no-season') return 'No season is open right now. Stats appear when the next season starts.';
  if (source.kind === 'none') return 'Maps, draft bans and leader win rates will appear here soon.';
  const { season_label: label, season_started_at: started } = source.data;
  return `${label} started on ${formatDate(new Date(started))}. Stats appear after the first games.`;
}
