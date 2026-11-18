import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redirectsFile } from '../scripts/lib/redirects';
import { shortLinks } from '../src/lib/nav';

test('stage 1: /civ6/ and /civ6/tournaments/ open the first tournament tab; /rules/ the general rules', () => {
  const built = ['/', '/civ6/tournaments/cloud/', '/civ6/tournaments/pl/', '/rules/general/', '/rules/pl/'];
  assert.equal(
    redirectsFile(shortLinks(), built),
    [
      '/civ6/ /civ6/tournaments/pl/ 302',
      '/civ6 /civ6/tournaments/pl/ 302',
      '/civ6/tournaments/ /civ6/tournaments/pl/ 302',
      '/civ6/tournaments /civ6/tournaments/pl/ 302',
      '/rules/ /rules/general/ 302',
      '/rules /rules/general/ 302',
      '',
    ].join('\n')
  );
});

test('the first built section wins, and hidden games get no redirect', () => {
  const built = ['/civ6/stats/', '/civ6/tournaments/pl/'];
  const file = redirectsFile(shortLinks(), built);
  assert.match(file, /^\/civ6\/ \/civ6\/stats\/ 302$/m);
  assert.doesNotMatch(file, /civ7/);
});

test('nothing built for a short link: no line, and an empty file overall', () => {
  assert.equal(redirectsFile(shortLinks(), ['/']), '');
});

test('a short link that is also a page fails the build', () => {
  assert.throws(
    () => redirectsFile([{ from: '/rules/', to: ['/rules/general/'] }], ['/rules/', '/rules/general/']),
    /\/rules\/ is a page/
  );
});
