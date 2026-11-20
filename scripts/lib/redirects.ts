import type { ShortLink } from '../../src/lib/nav';

/**
 * A Cloudflare `_redirects` file: each short link goes (302) to the first of
 * its targets that was built. Both `/x/` and `/x` are listed: neither has a
 * page, so Cloudflare won't add the slash itself. Short links with no built
 * target, or that were built as a page themselves, are left out.
 */
export function redirectsFile(links: readonly ShortLink[], built: readonly string[]): string {
  const pages = new Set(built);
  const lines: string[] = [];
  for (const { from, to } of links) {
    // e.g. /civ6/ladder/ before any ladder has players: the page itself is shown.
    if (pages.has(from)) continue;
    const target = to.find((path) => pages.has(path));
    if (target) lines.push(`${from} ${target} 302`, `${from.replace(/\/$/, '')} ${target} 302`);
  }
  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}
