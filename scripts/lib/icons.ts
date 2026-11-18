import { z } from 'astro/zod';
import { iconKey } from '../../src/lib/links';

export interface IconTarget {
  key: string;
  url: string;
}

/**
 * Every Workshop item and Discord invite linked from the given text, once each.
 * With `sites`, also every other website (for its logo).
 */
export function iconTargets(texts: readonly string[], { sites = false } = {}): IconTarget[] {
  const targets = new Map<string, string>();
  for (const text of texts) {
    for (const [match] of text.matchAll(/https:\/\/[^\s"'<>)]+/g)) {
      const url = match.replace(/[.,;:]+$/, '');
      if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(\/|\?|$)/i.test(url)) continue;
      const key = iconKey(url);
      if (!key || targets.has(key) || (!sites && key.startsWith('site-'))) continue;
      targets.set(key, url);
    }
  }
  return [...targets].map(([key, url]) => ({ key, url }));
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

/** File extension for an image response, or undefined if it isn't an image we keep. */
export function extensionFor(contentType: string | null): string | undefined {
  return EXTENSIONS[(contentType ?? '').split(';')[0].trim().toLowerCase()];
}

export const discordInviteSchema = z.object({
  code: z.string(),
  expires_at: z.string().nullable().optional(),
  guild: z
    .object({ id: z.string().regex(/^\d+$/), name: z.string(), icon: z.string().nullable() })
    .optional(),
});

export const workshopDetailsSchema = z.object({
  response: z.object({
    publishedfiledetails: z
      .array(
        z.object({
          publishedfileid: z.string(),
          result: z.number(),
          title: z.string().optional(),
          preview_url: z.string().optional(),
        })
      )
      .min(1),
  }),
});

/** A Discord server's icon at 128 px. */
export function discordIconUrl(guildId: string, icon: string): string {
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png?size=128`;
}

/** How an invite's expiry reads in the report. */
export function expiryText(expiresAt: string | null | undefined): string {
  return expiresAt ? `EXPIRES ${expiresAt} (replace it with a permanent invite)` : 'never expires';
}

/**
 * The best logo a web page names in its <head>: the Apple touch icon (a
 * 180 px PNG) if there is one, then the largest PNG or SVG icon. ICO files
 * are skipped: the site's image tools can't read them.
 */
export function pickSiteIcon(html: string, pageUrl: string): string | undefined {
  const icons: { href: string; score: number }[] = [];
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const attr = (name: string) =>
      new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1];
    const rel = (attr('rel') ?? '').toLowerCase().split(/\s+/);
    const href = attr('href');
    if (!href || /\.ico(\?|$)/i.test(href)) continue;
    const touch = rel.includes('apple-touch-icon');
    if (!touch && !rel.includes('icon')) continue;
    const svg = /\.svg(\?|$)/i.test(href) || attr('type') === 'image/svg+xml';
    const size = Number(/(\d+)x\d+/.exec(attr('sizes') ?? '')?.[1] ?? 0);
    icons.push({ href, score: touch ? 10_000 : svg ? 5_000 : size });
  }
  const best = icons.sort((a, b) => b.score - a.score)[0];
  return best ? new URL(best.href, pageUrl).href : undefined;
}

/** The page's Open Graph image (`<meta property="og:image">`), e.g. a Twitch profile picture. */
export function ogImage(html: string, pageUrl: string): string | undefined {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (!/\bproperty\s*=\s*["']og:image["']/i.test(tag)) continue;
    const content = /\bcontent\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (content) return new URL(content.replace(/&amp;/g, '&'), pageUrl).href;
  }
  return undefined;
}
