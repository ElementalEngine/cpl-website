import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const PREVIEW_HOST = 'https://cpl.elementalengine.net/*';

/** Parses a Cloudflare `_headers` file into { pattern: { header: value } }. */
function parseHeaders(text: string): Record<string, Record<string, string>> {
  const rules: Record<string, Record<string, string>> = {};
  let current: Record<string, string> | undefined;
  for (const line of text.split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = rules[line.trim()] = {};
      continue;
    }
    const at = line.indexOf(':');
    assert.ok(current && at > 0, `bad _headers line: ${line}`);
    current[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
  }
  return rules;
}

const headers = parseHeaders(readFileSync('public/_headers', 'utf8'));
const all = headers['/*'] ?? {};

/** CSP as { directive: [sources] }. */
const csp = Object.fromEntries(
  (all['content-security-policy'] ?? '')
    .split(';')
    .map((part) => part.trim().split(/\s+/))
    .filter(([name]) => name)
    .map(([name, ...sources]) => [name, sources])
);

test('CSP: own origin only, inline scripts never allowed, no framing', () => {
  assert.deepEqual(csp['default-src'], ["'none'"]);
  assert.deepEqual(csp['frame-ancestors'], ["'none'"]);
  for (const directive of ['script-src', 'style-src']) {
    const sources = csp[directive] ?? [];
    assert.ok(sources.includes("'self'"), `${directive} allows 'self'`);
    for (const unsafe of ["'unsafe-inline'", "'unsafe-eval'", '*']) {
      assert.ok(!sources.includes(unsafe), `${directive} must not allow ${unsafe}`);
    }
  }
  assert.deepEqual(csp['script-src'], [
    "'self'",
    'https://static.cloudflareinsights.com',
  ]);
});

test('HSTS, nosniff, referrer and permissions headers are set', () => {
  assert.match(all['strict-transport-security'] ?? '', /max-age=\d{8,}/);
  assert.equal(all['x-content-type-options'], 'nosniff');
  assert.equal(all['referrer-policy'], 'strict-origin-when-cross-origin');
  const features = (all['permissions-policy'] ?? '').split(',').map((f) => f.trim());
  assert.ok(features.length >= 10, 'permissions-policy lists the features');
  for (const feature of features) {
    assert.match(feature, /^[a-z-]+=\(\)$/, `${feature} is turned off`);
  }
});

test('noindex applies to the preview host only', () => {
  assert.equal(headers[PREVIEW_HOST]?.['x-robots-tag'], 'noindex');
  assert.equal(all['x-robots-tag'], undefined);
});

test('robots.txt keeps crawlers out of the preview', () => {
  const robots = readFileSync('public/robots.txt', 'utf8');
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Disallow: \/$/m);
});

test('Cloudflare serves the friendly 404 and no workers.dev URL', () => {
  const config = JSON.parse(
    readFileSync('wrangler.jsonc', 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n')
  );
  assert.equal(config.assets.directory, './dist');
  assert.equal(config.assets.not_found_handling, '404-page');
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.ok(existsSync('src/pages/404.astro'), 'a 404 page exists');
});
