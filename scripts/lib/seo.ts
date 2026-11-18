/** The preview host. While the site's address is this host, search engines are kept out. */
export const PREVIEW_ORIGIN = 'https://cpl.elementalengine.net';

/** True once the site's address is the live domain rather than the preview host. */
export function isLive(site: string): boolean {
  return new URL(site).origin !== PREVIEW_ORIGIN;
}

/** True if the page asks search engines not to index it (`<meta name="robots" content="noindex">`). */
export function isNoindex(html: string): boolean {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (/\bname\s*=\s*["']?robots\b/i.test(tag) && /\bcontent\s*=\s*["'][^"']*noindex/i.test(tag)) {
      return true;
    }
  }
  return false;
}

/** `robots.txt`: live allows everything and names the sitemap; the preview blocks everything. */
export function robotsTxt(site: string): string {
  if (!isLive(site)) return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', site).href}\n`;
}

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/** `sitemap.xml` for the given page paths (e.g. `/about/`), home first. */
export function sitemapXml(site: string, paths: readonly string[]): string {
  const sorted = [...new Set(paths)].sort((a, b) =>
    a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)
  );
  const urls = sorted.map((path) => {
    const loc = new URL(path, site).href.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);
    return `  <url><loc>${loc}</loc></url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}
