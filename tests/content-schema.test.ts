import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aboutSchema,
  homeSchema,
  pastDate,
  privacySchema,
  resourcesSchema,
  rulesSchema,
} from '../src/lib/content-schema';

const DAY_MS = 24 * 60 * 60 * 1000;
const link = { name: 'CivDraft', summary: 'Run a draft.', url: 'https://example.org/draft' };

test('home: one intro line of 160 characters or fewer, exactly 3 steps', () => {
  const home = { intro: 'CPL is a community.', joinSteps: ['One', 'Two', 'Three'] };
  assert.ok(homeSchema.safeParse(home).success);
  assert.ok(!homeSchema.safeParse({ ...home, joinSteps: ['One', 'Two'] }).success);
  assert.ok(!homeSchema.safeParse({ ...home, intro: 'x'.repeat(161) }).success);
  assert.ok(!homeSchema.safeParse({ ...home, intro: 'Two\nlines' }).success);
  assert.ok(!homeSchema.safeParse({ ...home, joinSteps: ['One', '', 'Three'] }).success);
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

test('resources: https links, at least one mod and tool, optional BBG Discord', () => {
  const resources = { description: 'Mods and tools.', mods: [link], tools: [link] };
  assert.ok(resourcesSchema.safeParse(resources).success);
  assert.ok(!resourcesSchema.safeParse({ ...resources, mods: [] }).success);
  assert.ok(
    !resourcesSchema.safeParse({ ...resources, tools: [{ ...link, url: 'http://example.org' }] })
      .success
  );
  const bbgDiscord = { name: 'BBG Discord', summary: 'Bugs.', invite: 'https://discord.gg/abc' };
  assert.ok(resourcesSchema.safeParse({ ...resources, bbgDiscord }).success);
  assert.ok(
    !resourcesSchema.safeParse({
      ...resources,
      bbgDiscord: { ...bbgDiscord, invite: 'https://example.org/abc' },
    }).success
  );
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

test('privacy: description and a past updatedOn', () => {
  assert.ok(
    privacySchema.safeParse({ description: 'Privacy.', updatedOn: new Date('2026-11-18') }).success
  );
  assert.ok(!privacySchema.safeParse({ description: 'Privacy.' }).success);
});
