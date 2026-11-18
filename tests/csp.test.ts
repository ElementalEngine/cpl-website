import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  addHashesToHeaders,
  collectInlineHashes,
  cspHash,
  type InlineHashes,
} from '../scripts/lib/csp';
import { themeInit } from '../src/lib/theme';

test('cspHash matches the browser hash, with CRLF read as LF', () => {
  // Example from the CSP specification.
  assert.equal(
    cspHash("alert('Hello, world.');"),
    "'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng='"
  );
  assert.equal(cspHash('a\r\nb\rc'), cspHash('a\nb\nc'));
});

test('collectInlineHashes finds inline scripts and styles, skips src scripts', () => {
  const page = [
    '<html><head>',
    `<script>${themeInit}</script>`,
    '<style>:root{--x:1}</style>',
    '<script type="module" src="/_astro/menu.js"></script>',
    '</head><body><p>style= in text is fine</p></body></html>',
  ].join('');
  const hashes = collectInlineHashes([page, page]);
  assert.deepEqual(hashes, {
    script: [cspHash(themeInit)],
    style: [cspHash(':root{--x:1}')],
  });
});

test('collectInlineHashes refuses inline event handlers and style attributes', () => {
  assert.throws(
    () => collectInlineHashes(['<button onclick="go()">Go</button>']),
    /"onclick"/
  );
  assert.throws(
    () => collectInlineHashes(['<p style="color:red">Hi</p>']),
    /"style"/
  );
});

test('addHashesToHeaders adds hashes to the real _headers CSP only', () => {
  const template = readFileSync('public/_headers', 'utf8');
  const hashes: InlineHashes = { script: ["'sha256-AAA='"], style: ["'sha256-BBB='"] };
  const result = addHashesToHeaders(template, hashes);

  const before = template.split('\n');
  const after = result.split('\n');
  assert.equal(after.length, before.length);
  const changed = after.filter((line, i) => line !== before[i]);
  assert.equal(changed.length, 1);
  assert.match(
    changed[0],
    /script-src 'self' https:\/\/static\.cloudflareinsights\.com 'sha256-AAA=';/
  );
  assert.match(changed[0], /style-src 'self' 'sha256-BBB=';/);
  assert.match(changed[0], /default-src 'none';/);
});

test('addHashesToHeaders refuses unsafe-inline and a missing policy', () => {
  const none: InlineHashes = { script: [], style: [] };
  assert.throws(
    () =>
      addHashesToHeaders(
        "/*\n  Content-Security-Policy: script-src 'self' 'unsafe-inline'; style-src 'self'\n",
        none
      ),
    /unsafe-inline/
  );
  assert.throws(
    () => addHashesToHeaders('/*\n  X-Content-Type-Options: nosniff\n', none),
    /found 0/
  );
  assert.throws(
    () => addHashesToHeaders("/*\n  Content-Security-Policy: default-src 'none'\n", none),
    /no script-src/
  );
});
