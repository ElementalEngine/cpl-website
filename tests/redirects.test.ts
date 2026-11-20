import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redirectsFile } from '../scripts/lib/redirects';
import { shortLinks } from '../src/lib/nav';

test('/civ6/tournaments/ opens the first tournament tab; /rules/ the general rules', () => {
  const built = ['/', '/civ6/', '/civ6/tournaments/cloud/', '/civ6/tournaments/pl/', '/rules/general/', '/rules/pl/'];
  assert.equal(
    redirectsFile(shortLinks(), built),
    [
      '/civ6/tournaments/ /civ6/tournaments/pl/ 302',
      '/civ6/tournaments /civ6/tournaments/pl/ 302',
      '/rules/ /rules/general/ 302',
      '/rules /rules/general/ 302',
      '',
    ].join('\n')
  );
});

test('the first built tab wins; the game page and hidden games get no redirect', () => {
  const built = ['/civ6/', '/civ6/stats/teamer/', '/civ6/tournaments/pl/'];
  const file = redirectsFile(shortLinks(), built);
  assert.match(file, /^\/civ6\/stats\/ \/civ6\/stats\/teamer\/ 302$/m);
  assert.doesNotMatch(file, /^\/civ6\/? /m);
  assert.doesNotMatch(file, /civ7/);
});

test('stage 2: /civ6/ladder/ opens the first ladder with players', () => {
  const built = ['/civ6/', '/civ6/ladder/teamer/', '/civ6/ladder/cloud/', '/civ6/ladder/teamer/2/'];
  const file = redirectsFile(shortLinks(), built);
  assert.match(file, /^\/civ6\/ladder\/ \/civ6\/ladder\/teamer\/ 302$/m);
  assert.match(file, /^\/civ6\/ladder \/civ6\/ladder\/teamer\/ 302$/m);
});

test('before any ladder has players, /civ6/ladder/ is a page and doesn\'t redirect', () => {
  const built = ['/civ6/', '/civ6/ladder/', '/civ6/tournaments/pl/'];
  const file = redirectsFile(shortLinks(), built);
  assert.doesNotMatch(file, /^\/civ6\/ladder\/? /m);
});

test('nothing built for a short link: no line, and an empty file overall', () => {
  assert.equal(redirectsFile(shortLinks(), ['/']), '');
});

test('a short link that is also a page gets no redirect: the page is shown', () => {
  assert.equal(redirectsFile([{ from: '/rules/', to: ['/rules/general/'] }], ['/rules/', '/rules/general/']), '');
});
