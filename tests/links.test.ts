import assert from 'node:assert/strict';
import { test } from 'node:test';
import { linkDestination, linkKind } from '../src/lib/links';

test('external links name where they go', () => {
  assert.equal(
    linkDestination('https://steamcommunity.com/sharedfiles/filedetails/?id=2865001760'),
    'Steam Workshop'
  );
  assert.equal(linkDestination('https://discord.gg/PVATxMgdyJ'), 'Discord');
  assert.equal(linkDestination('https://discord.com/invite/abc'), 'Discord');
  assert.equal(linkDestination('https://www.twitch.tv/lege'), 'Twitch');
  assert.equal(linkDestination('https://www.playyourdamnturn.com/'), 'playyourdamnturn.com');
  assert.equal(linkDestination('https://civgg-five.vercel.app/draft'), 'civgg-five.vercel.app');
});

test('each link gets an icon kind; unknown sites are "web"', () => {
  assert.equal(linkKind('https://steamcommunity.com/sharedfiles/filedetails/?id=1'), 'mod');
  assert.equal(linkKind('https://discord.gg/civfr'), 'discord');
  assert.equal(linkKind('https://www.twitch.tv/lege'), 'video');
  assert.equal(linkKind('https://civgg-five.vercel.app/'), 'web');
});
