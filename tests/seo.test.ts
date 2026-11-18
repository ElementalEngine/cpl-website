import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLive, isNoindex, PREVIEW_ORIGIN, robotsTxt, sitemapXml } from '../scripts/lib/seo';

const LIVE = 'https://cpl.example';

test('the preview host is never live; any other address is', () => {
  assert.equal(isLive(PREVIEW_ORIGIN), false);
  assert.equal(isLive(`${PREVIEW_ORIGIN}/`), false);
  assert.equal(isLive(LIVE), true);
});

test('robots.txt blocks everything on the preview', () => {
  assert.equal(robotsTxt(PREVIEW_ORIGIN), 'User-agent: *\nDisallow: /\n');
});

test('robots.txt allows everything live and names the sitemap', () => {
  const robots = robotsTxt(LIVE);
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.doesNotMatch(robots, /Disallow/);
  assert.match(robots, /^Sitemap: https:\/\/cpl\.example\/sitemap\.xml$/m);
});

test('isNoindex reads the robots meta tag, in any attribute order', () => {
  assert.ok(isNoindex('<head><meta name="robots" content="noindex"></head>'));
  assert.ok(isNoindex('<meta content="noindex, nofollow" name="robots" />'));
  assert.ok(!isNoindex('<meta name="description" content="Not noindex here">'));
  assert.ok(!isNoindex('<p>noindex</p>'));
});

test('sitemap lists each page once, home first, as full URLs', () => {
  const xml = sitemapXml(LIVE, ['/rules/pl/', '/', '/about/', '/about/']);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, [
    'https://cpl.example/',
    'https://cpl.example/about/',
    'https://cpl.example/rules/pl/',
  ]);
  assert.ok(xml.endsWith('</urlset>\n'));
});

test('sitemap escapes XML characters', () => {
  assert.match(sitemapXml(LIVE, ['/a&b/']), /<loc>https:\/\/cpl\.example\/a&amp;b\/<\/loc>/);
});
