import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aboutSchema,
  homeSchema,
  pastDate,
  privacySchema,
  resourcesSchema,
  rulesSchema,
  tournamentSchema,
} from '../src/lib/content-schema';

const DAY_MS = 24 * 60 * 60 * 1000;
const link = { name: 'CivDraft', summary: 'Run a draft.', url: 'https://example.org/draft' };

test('home: one intro line of 160 characters or fewer, exactly 3 highlights and 3 steps', () => {
  const highlight = { icon: 'ladder', title: 'Ranked games', text: 'Climb the ladder.' };
  const home = {
    intro: 'CPL is a community.',
    highlights: [highlight, highlight, highlight],
    joinSteps: ['One', 'Two', 'Three'],
  };
  assert.ok(homeSchema.safeParse(home).success);
  assert.ok(!homeSchema.safeParse({ ...home, joinSteps: ['One', 'Two'] }).success);
  assert.ok(!homeSchema.safeParse({ ...home, intro: 'x'.repeat(161) }).success);
  assert.ok(!homeSchema.safeParse({ ...home, intro: 'Two\nlines' }).success);
  assert.ok(!homeSchema.safeParse({ ...home, joinSteps: ['One', '', 'Three'] }).success);
  assert.ok(!homeSchema.safeParse({ ...home, highlights: [highlight, highlight] }).success);
  assert.ok(!homeSchema.safeParse({ ...home, highlights: [highlight, highlight, { title: 'x' }] }).success);
  assert.ok(!homeSchema.safeParse({ ...home, highlights: [highlight, highlight, { ...highlight, icon: 'star' }] }).success);
});

test('dates: YAML dates and YYYY-MM-DD text pass; future dates and nonsense fail', () => {
  assert.ok(pastDate.safeParse(new Date('2026-11-18')).success);
  assert.ok(pastDate.safeParse('2026-11-18').success);
  assert.ok(pastDate.safeParse(new Date(Date.now() + DAY_MS / 2)).success, 'time-zone leeway');
  assert.ok(!pastDate.safeParse(new Date(Date.now() + 3 * DAY_MS)).success);
  assert.ok(!pastDate.safeParse('2026-13-45').success);
});

test('rules: title, description and updatedOn are required; unknown fields fail', () => {
  const rules = { title: 'PL rules', description: 'PL rules.', updatedOn: new Date('2026-11-18') };
  assert.ok(rulesSchema.safeParse(rules).success);
  const { updatedOn: _updatedOn, ...noDate } = rules;
  assert.ok(!rulesSchema.safeParse(noDate).success);
  assert.ok(!rulesSchema.safeParse({ ...rules, updatedon: rules.updatedOn }).success);
});

test('resources: https links, at least one mod and tool; unknown fields fail', () => {
  const resources = { description: 'Mods and tools.', mods: [link], tools: [link] };
  assert.ok(resourcesSchema.safeParse(resources).success);
  assert.ok(!resourcesSchema.safeParse({ ...resources, mods: [] }).success);
  assert.ok(
    !resourcesSchema.safeParse({ ...resources, tools: [{ ...link, url: 'http://example.org' }] })
      .success
  );
  assert.ok(!resourcesSchema.safeParse({ ...resources, bbgDiscord: {} }).success);
});

test('about: partner invites use the Discord invite check; streamers default to none', () => {
  const partner = { name: 'CivFR', summary: 'French community.', invite: 'https://discord.gg/civfr' };
  const about = { description: 'About CPL.', partnersIntro: 'Our partners.', partners: [partner] };
  const parsed = aboutSchema.parse(about);
  assert.deepEqual(parsed.streamers, []);
  assert.ok(
    aboutSchema.safeParse({ ...about, partners: [{ ...partner, website: 'https://civfr.com/' }] })
      .success
  );
  assert.ok(
    !aboutSchema.safeParse({ ...about, partners: [{ ...partner, invite: 'https://civfr.com/' }] })
      .success
  );
  assert.ok(
    !aboutSchema.safeParse({
      ...about,
      streamers: [{ name: 'Lege', url: 'twitch.tv/lege' }],
    }).success
  );
});

test('about: a partner needs an invite, a website, or both', () => {
  const about = { description: 'About CPL.', partnersIntro: 'Our partners.' };
  const partners = (partner: object) =>
    aboutSchema.safeParse({ ...about, partners: [{ name: 'civgg', summary: 'Stats.', ...partner }] }).success;
  assert.ok(partners({ website: 'https://civgg-five.vercel.app/' }));
  assert.ok(partners({ invite: 'https://discord.gg/FZW5pr6zTk' }));
  assert.ok(!partners({}));
});

test('privacy: description and a past updatedOn', () => {
  assert.ok(
    privacySchema.safeParse({ description: 'Privacy.', updatedOn: new Date('2026-11-18') }).success
  );
  assert.ok(!privacySchema.safeParse({ description: 'Privacy.' }).success);
});

test('mods and tools may have up to 3 extra links, each https with a short label', () => {
  const extra = { label: 'Download client', url: 'https://github.com/pydt/client/releases/latest' };
  const resources = { description: 'Mods and tools.', mods: [link], tools: [{ ...link, links: [extra] }] };
  assert.ok(resourcesSchema.safeParse(resources).success);
  assert.deepEqual(resourcesSchema.parse({ ...resources, tools: [link] }).tools[0].links, []);
  assert.ok(resourcesSchema.safeParse({ ...resources, mods: [{ ...link, links: [extra] }] }).success);
  const bad = (links: unknown) => !resourcesSchema.safeParse({ ...resources, tools: [{ ...link, links }] }).success;
  assert.ok(bad([{ ...extra, url: 'github.com/a/b' }]));
  assert.ok(bad([extra, extra, extra, extra]));
  assert.ok(bad([{ label: 'x'.repeat(31), url: extra.url }]));
});

test('tournaments: Challonge links become API ids; rules point to a rules page or https', () => {
  const pl = {
    name: 'CPL Premier League Season 6',
    game: 'civ6',
    category: 'pl',
    order: 1,
    format: 'League, 3 divisions',
    rules: '/rules/pl/',
    brackets: [{ name: 'Division 1', challonge: 'https://challonge.com/CPL_PL_S6_D1/standings' }],
  };
  const parsed = tournamentSchema.parse(pl);
  assert.deepEqual(parsed.brackets, [
    { name: 'Division 1', link: 'https://challonge.com/CPL_PL_S6_D1/standings', apiId: 'CPL_PL_S6_D1' },
  ]);
  const bad = (change: object) => !tournamentSchema.safeParse({ ...pl, ...change }).success;
  assert.ok(bad({ brackets: [{ name: 'D1', challonge: 'https://challonge.com/communities/cpl' }] }));
  assert.ok(bad({ rules: '/rules/nope/' }));
  assert.ok(!bad({ rules: 'https://docs.example.org/pl' }));
  assert.ok(bad({ game: 'civ5' }));
  assert.ok(bad({ order: 0 }));
  assert.ok(bad({ category: 'duel' }));
  assert.ok(bad({ category: 'ffa' }), 'FFA has no tab yet');
  assert.ok(!bad({ teams: true }));
  assert.ok(bad({ category: undefined }), 'a running tournament needs a category');
  assert.ok(!bad({ category: undefined, winners: ['A'] }), 'a past one does not');
  assert.ok(bad({ brakets: [] }), 'unknown fields fail');
});

test('tournaments: a past event needs only name, game and 1–3 winners; brackets default to none', () => {
  const past = { name: 'CCC 10', game: 'civ6', winners: ['A', 'B', 'C'], endedOn: '2024-05-12' };
  const parsed = tournamentSchema.parse(past);
  assert.deepEqual(parsed.brackets, []);
  assert.equal(parsed.endedOn?.toISOString().slice(0, 10), '2024-05-12');
  assert.ok(!tournamentSchema.safeParse({ ...past, winners: [] }).success);
  assert.ok(!tournamentSchema.safeParse({ ...past, winners: ['A', 'B', 'C', 'D'] }).success);
  assert.ok(!tournamentSchema.safeParse({ ...past, endedOn: '2999-01-01' }).success);
});
