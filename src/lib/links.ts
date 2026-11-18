/** What kind of place a link goes to; picks the panel icon. */
export type LinkKind = 'mod' | 'discord' | 'video' | 'web';

const DESTINATIONS: readonly (readonly [RegExp, string, LinkKind])[] = [
  [/^steamcommunity\.com\/(sharedfiles|workshop)\//, 'Steam Workshop', 'mod'],
  [/^(discord\.gg|discord\.com\/invite)\//, 'Discord', 'discord'],
  [/^twitch\.tv\//, 'Twitch', 'video'],
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

/** The kind of place a link goes to: a mod, a Discord server, a video channel, or any other website. */
export function linkKind(url: string): LinkKind {
  return match(url).found?.[2] ?? 'web';
}
