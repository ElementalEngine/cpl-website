import type { ShortLink } from '../../src/lib/nav';

/**
 * A Cloudflare `_redirects` file: each short link goes (302) to the first of
 * its targets that was built. Both `/x/` and `/x` are listed: neither has a
 * page, so Cloudflare won't add the slash itself. Short links with no built
 * target are left out.
 */
export function redirectsFile(links: readonly ShortLink[], built: readonly string[]): string {
  const pages = new Set(built);
  const lines: string[] = [];
  for (const { from, to } of links) {
    if (pages.has(from)) {
      throw new Error(`${from} is a page, so it can't also redirect`);
    }
    const target = to.find((path) => pages.has(path));
    if (target) lines.push(`${from} ${target} 302`, `${from.replace(/\/$/, '')} ${target} 302`);
  }
  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}
