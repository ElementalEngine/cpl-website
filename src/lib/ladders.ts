import type { LadderRow, Ladders } from './core-api';
import type { Source } from './core-api-data';
import { formatDate } from './format';
import { LADDER_MODES, type GameId, type NavLink } from './nav';

/** core-api's name for a player with no registration record; shown muted. */
export const UNREGISTERED = 'Unregistered player';

/** Players per ladder page. A ladder this size or smaller is one page with no pager. */
export const PAGE_SIZE = 100;

type Mode = (typeof LADDER_MODES)[number];

interface ShownLadder {
  mode: Mode;
  rows: LadderRow[];
}

export interface LadderPage {
  mode: Mode;
  number: number;
  pages: number;
  rows: LadderRow[];
  prev?: string;
  next?: string;
}

/** The ladders that have ranked players, in tab order. Empty ladders and keys the site doesn't know are left out. */
export function shownLadders(data: Ladders): ShownLadder[] {
  return LADDER_MODES.flatMap((mode) => {
    const rows = data.ladders.find((ladder) => ladder.key === mode.key)?.rows ?? [];
    return rows.length > 0 ? [{ mode, rows }] : [];
  });
}

/** `/civ6/ladder/ffa/` for page 1, `/civ6/ladder/ffa/2/` after it. */
export function ladderHref(game: GameId, mode: Mode['id'], page = 1): string {
  const base = `/${game}/ladder/${mode}/`;
  return page === 1 ? base : `${base}${page}/`;
}

/** One tab per shown ladder; each stays current on its later pages. */
export function ladderTabs(game: GameId, shown: ShownLadder[]): NavLink[] {
  return shown.map(({ mode }) => {
    const href = ladderHref(game, mode.id);
    return { label: mode.label, href, section: href };
  });
}

/** A ladder split into pages of `PAGE_SIZE`, in core-api's order, with links to the pages beside each. */
export function ladderPages(game: GameId, { mode, rows }: ShownLadder): LadderPage[] {
  const pages = Math.ceil(rows.length / PAGE_SIZE);
  return Array.from({ length: pages }, (_, i) => {
    const number = i + 1;
    return {
      mode,
      number,
      pages,
      rows: rows.slice(i * PAGE_SIZE, number * PAGE_SIZE),
      prev: number > 1 ? ladderHref(game, mode.id, number - 1) : undefined,
      next: number < pages ? ladderHref(game, mode.id, number + 1) : undefined,
    };
  });
}

/** FFA counts 1st places; Teamer, Duel and Cloud count wins. */
export function resultColumn(mode: Mode): { heading: string; value: (row: LadderRow) => number } {
  return mode.id === 'ffa'
    ? { heading: '1st', value: (row) => row.first }
    : { heading: 'Wins', value: (row) => row.wins };
}

/** "Season 8 · started 1 Nov 2026" above a season ladder; cloud ladders cover all time. */
export function ladderSubtitle(data: Ladders, mode: Mode): string {
  if (mode.id === 'cloud') return 'All-time cloud games';
  if (!data.season_label || !data.season_started_at) return 'This season';
  return `${data.season_label} · started ${formatDate(new Date(data.season_started_at))}`;
}

/** What a game's ladder page says when no ladder has players yet. */
export function noLaddersMessage(source: Source<Ladders>): string {
  if (source.kind !== 'fresh' && source.kind !== 'stale') return 'Leaderboards will appear here soon.';
  const { season_label: label, season_started_at: started } = source.data;
  if (!label || !started) return 'No season is open right now. Tables appear when the next season starts.';
  return `${label} started on ${formatDate(new Date(started))}. Tables appear after the first games.`;
}

/** Home: this season's top 10 per mode (FFA, Teamer, Duel; not cloud), with a link to each full ladder. */
export function homeLeaders(game: GameId, data: Ladders) {
  return shownLadders(data)
    .filter(({ mode }) => mode.id !== 'cloud')
    .map(({ mode, rows }) => ({ mode, rows: rows.slice(0, 10), href: ladderHref(game, mode.id) }));
}
