import type { Site } from './site-schema';

export type GameId = keyof Site['games'];

export interface NavLink {
  label: string;
  href: string;
}

const GAMES: readonly (readonly [GameId, string])[] = [
  ['civ6', 'Civ 6'],
  ['civ7', 'Civ 7'],
];

// Tab order inside a game.
const SECTIONS = [
  ['ladder', 'Ladder'],
  ['stats', 'Stats'],
  ['tournaments', 'Tournaments'],
] as const;

export function gameLabel(game: GameId): string {
  return GAMES.find(([id]) => id === game)?.[1] ?? game;
}

/** The switched-on sections of a game, in tab order. Empty if the game is hidden. */
export function gameSections(site: Site, game: GameId): NavLink[] {
  const switches = site.games[game];
  if (!switches.show) return [];
  return SECTIONS.filter(([key]) => switches[key]).map(([key, label]) => ({
    label,
    href: `/${game}/${key}/`,
  }));
}

/** Games with at least one page, in menu order. */
export function shownGames(site: Site): GameId[] {
  return GAMES.map(([id]) => id).filter((id) => gameSections(site, id).length > 0);
}

/** Header menu: each shown game (to its first section), then the fixed pages. */
export function mainNav(site: Site): NavLink[] {
  const games = shownGames(site).map((game) => ({
    label: gameLabel(game),
    href: gameSections(site, game)[0].href,
  }));
  return [
    ...games,
    { label: 'Rules', href: '/rules/game/' },
    { label: 'Resources', href: '/resources/' },
    { label: 'About', href: '/about/' },
  ];
}

/**
 * `aria-current` for a menu link: "page" on the page itself, "true" elsewhere
 * in its section (first path segment), otherwise none.
 */
export function navCurrent(href: string, pathname: string): 'page' | 'true' | undefined {
  if (href === pathname) return 'page';
  const section = href.split('/')[1];
  return section && pathname.split('/')[1] === section ? 'true' : undefined;
}
