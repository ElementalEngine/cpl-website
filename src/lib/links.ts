/** What kind of place a link goes to; picks the panel icon. */
export type LinkKind = 'mod' | 'discord' | 'video' | 'code' | 'web';

const DESTINATIONS: readonly (readonly [RegExp, string, LinkKind])[] = [
  [/^steamcommunity\.com\/(sharedfiles|workshop)\//, 'Steam Workshop', 'mod'],
  [/^(discord\.gg|discord\.com\/invite)\//, 'Discord', 'discord'],
  [/^twitch\.tv\//, 'Twitch', 'video'],
  [/^github\.com\//, 'GitHub', 'code'],
];

function match(url: string) {
  const { hostname, pathname } = new URL(url);
  const host = hostname.replace(/^www\./, '');
  return { host, found: DESTINATIONS.find(([pattern]) => pattern.test(host + pathname)) };
}

/** Where an external link goes, named for the visitor: "Steam Workshop", "Discord", or the site's host. */
export function linkDestination(url: string): string {
  const { host, found } = match(url);
  return found ? found[1] : host;
}

/** The kind of place a link goes to: a mod, a Discord server, a video channel, code, or any other website. */
export function linkKind(url: string): LinkKind {
  return match(url).found?.[2] ?? 'web';
}

/**
 * The file name (without extension) of a link's own image in `src/content/icons/`:
 * `workshop-<id>` for a Steam Workshop item, `discord-<invite code>` for a Discord
 * invite, `twitch-<login>` for a Twitch channel (its profile picture), `site-<host>` for any
 * other website (its logo). None for GitHub.
 */
export function iconKey(url: string): string | undefined {
  const { hostname, pathname, searchParams } = new URL(url);
  const host = hostname.replace(/^www\./, '');
  const kind = linkKind(url);
  if (kind === 'mod') {
    const id = searchParams.get('id');
    return /^\/(sharedfiles|workshop)\/filedetails\/?$/.test(pathname) && id && /^\d+$/.test(id)
      ? `workshop-${id}`
      : undefined;
  }
  if (kind === 'discord') {
    const invite = /^(?:discord\.gg|discord\.com\/invite)\/([\w-]+)\/?$/.exec(host + pathname);
    return invite ? `discord-${invite[1]}` : undefined;
  }
  if (kind === 'video') {
    const login = /^\/([A-Za-z0-9_]{3,25})\/?$/.exec(pathname)?.[1];
    return login ? `twitch-${login.toLowerCase()}` : undefined;
  }
  return kind === 'web' ? `site-${host}` : undefined;
}

/** The small icon shown next to a link's label. */
export type LinkBrand = 'steam' | 'discord' | 'twitch' | 'github' | 'web';

const BRANDS: Record<LinkKind, LinkBrand> = {
  mod: 'steam',
  discord: 'discord',
  video: 'twitch',
  code: 'github',
  web: 'web',
};

/** The small icon shown next to a link's label: the site's logo, or a globe for any other website. */
export function linkBrand(url: string): LinkBrand {
  return BRANDS[linkKind(url)];
}

/** A short visible label for a link: "Steam Workshop", "Discord", "Twitch", "GitHub" or "Website". */
export function linkLabel(url: string): string {
  return linkKind(url) === 'web' ? 'Website' : linkDestination(url);
}
