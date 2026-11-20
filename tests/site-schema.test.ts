import assert from 'node:assert/strict';
import { test } from 'node:test';
import { siteSchema } from '../src/lib/site-schema';

const valid = {
  discordInvite: 'https://discord.gg/cpl',
  games: {
    civ6: { show: true, ladder: false, stats: false, tournaments: true },
    civ7: { show: false, ladder: false, stats: false, tournaments: false },
  },
  socials: [{ name: 'Patreon', url: 'https://www.patreon.com/example', kind: 'support' }],
};

function withChange(change: (copy: typeof valid) => void) {
  const copy = structuredClone(valid);
  change(copy);
  return siteSchema.safeParse(copy);
}

test('accepts valid settings; socials are optional', () => {
  assert.ok(siteSchema.safeParse(valid).success);
  const { socials: _socials, ...noSocials } = valid;
  const parsed = siteSchema.parse(noSocials);
  assert.deepEqual(parsed.socials, []);
});

test('Discord invite must be a discord.gg or discord.com/invite link', () => {
  assert.ok(withChange((s) => (s.discordInvite = 'https://discord.com/invite/abc-12')).success);
  assert.ok(!withChange((s) => (s.discordInvite = 'http://discord.gg/cpl')).success);
  assert.ok(!withChange((s) => (s.discordInvite = 'https://example.com/cpl')).success);
});

test('social links must be https and follow or support', () => {
  assert.ok(!withChange((s) => (s.socials[0].url = 'http://example.com')).success);
  assert.ok(!withChange((s) => (s.socials[0].kind = 'donate')).success);
});

test('ladder can be switched on; stats stays off until its pages exist', () => {
  assert.ok(withChange((s) => (s.games.civ6.ladder = true)).success);
  assert.ok(
    withChange((s) => {
      s.games.civ7.show = true;
      s.games.civ7.ladder = true;
    }).success
  );
  assert.ok(!withChange((s) => (s.games.civ7.stats = true)).success);
});

test('a shown game needs a section; unknown keys are typos', () => {
  assert.ok(!withChange((s) => (s.games.civ6.tournaments = false)).success);
  assert.ok(
    !withChange((s) => ((s as Record<string, unknown>).discordinvite = 'x')).success
  );
});
