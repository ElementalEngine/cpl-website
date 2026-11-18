import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  gameSections,
  mainNav,
  navCurrent,
  ruleTabs,
  shortLinks,
  shownGames,
} from '../src/lib/nav';
import type { Site } from '../src/lib/site-schema';

const off = { show: false, ladder: false, stats: false, tournaments: false };

function site(games: Partial<Site['games']>): Site {
  return {
    discordInvite: 'https://discord.gg/example',
    games: { civ6: off, civ7: off, ...games },
    socials: [],
  };
}

test('stage 1: Civ 6 links to its tournaments; Civ 7 is hidden', () => {
  const stage1 = site({ civ6: { ...off, show: true, tournaments: true } });
  assert.deepEqual(shownGames(stage1), ['civ6']);
  assert.deepEqual(mainNav(stage1), [
    { label: 'Civ 6', href: '/civ6/tournaments/' },
    { label: 'Rules', href: '/rules/general/' },
    { label: 'Resources', href: '/resources/' },
    { label: 'About', href: '/about/' },
  ]);
});

test('sections keep tab order, and a game links to its first one', () => {
  const both = site({
    civ6: { show: true, ladder: true, stats: true, tournaments: true },
    civ7: { show: true, ladder: false, stats: true, tournaments: false },
  });
  assert.deepEqual(
    gameSections(both, 'civ6').map((s) => s.href),
    ['/civ6/ladder/', '/civ6/stats/', '/civ6/tournaments/']
  );
  assert.deepEqual(mainNav(both).slice(0, 2), [
    { label: 'Civ 6', href: '/civ6/ladder/' },
    { label: 'Civ 7', href: '/civ7/stats/' },
  ]);
});

test('a game with show off, or no sections on, has no menu item', () => {
  const hidden = site({ civ6: { show: false, ladder: false, stats: false, tournaments: true } });
  assert.deepEqual(gameSections(hidden, 'civ6'), []);
  const empty = site({ civ6: { ...off, show: true } });
  assert.deepEqual(shownGames(empty), []);
});

test('navCurrent marks the page, then its section', () => {
  assert.equal(navCurrent('/rules/general/', '/rules/general/'), 'page');
  assert.equal(navCurrent('/rules/general/', '/rules/pl/'), 'true');
  assert.equal(navCurrent('/civ6/tournaments/', '/civ6/ladder/ffa/2/'), 'true');
  assert.equal(navCurrent('/about/', '/resources/'), undefined);
  assert.equal(navCurrent('/about/', '/'), undefined);
});

test('rule tabs follow the rule sets, and the menu opens the first', () => {
  assert.deepEqual(
    ruleTabs().map((tab) => tab.href),
    [
      '/rules/general/',
      '/rules/in-game/',
      '/rules/exploits/',
      '/rules/cloud/',
      '/rules/pl/',
      '/rules/discord/',
    ]
  );
  const stage1 = site({ civ6: { ...off, show: true, tournaments: true } });
  assert.equal(mainNav(stage1).find((item) => item.label === 'Rules')?.href, '/rules/general/');
});

test('short links cover each game and the rules', () => {
  assert.deepEqual(
    shortLinks().map((link) => link.from),
    ['/civ6/', '/civ7/', '/rules/']
  );
  assert.deepEqual(shortLinks()[0].to, ['/civ6/ladder/', '/civ6/stats/', '/civ6/tournaments/']);
});
