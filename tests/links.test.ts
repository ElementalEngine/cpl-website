import assert from 'node:assert/strict';
import { test } from 'node:test';
import { iconKey, linkBrand, linkDestination, linkKind, linkLabel } from '../src/lib/links';

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

test('GitHub links are "code" with the GitHub logo; Workshop links get the Steam logo', () => {
  assert.equal(linkDestination('https://github.com/leovalette/civdraft'), 'GitHub');
  assert.equal(linkKind('https://github.com/pydt/client'), 'code');
  assert.equal(linkBrand('https://github.com/pydt/client'), 'github');
  assert.equal(linkBrand('https://steamcommunity.com/sharedfiles/filedetails/?id=1'), 'steam');
  assert.equal(linkBrand('https://discord.gg/civfr'), 'discord');
  assert.equal(linkBrand('https://www.twitch.tv/lege'), 'twitch');
  assert.equal(linkBrand('https://civgg-five.vercel.app/'), 'web');
  assert.equal(linkLabel('https://civgg-five.vercel.app/draft'), 'Website');
  assert.equal(linkLabel('https://discord.gg/civfr'), 'Discord');
});

test('icon keys name a link’s own image file', () => {
  assert.equal(
    iconKey('https://steamcommunity.com/sharedfiles/filedetails/?id=2865001760'),
    'workshop-2865001760'
  );
  assert.equal(iconKey('https://discord.gg/PVATxMgdyJ'), 'discord-PVATxMgdyJ');
  assert.equal(iconKey('https://discord.com/invite/civfr/'), 'discord-civfr');
  assert.equal(iconKey('https://www.twitch.tv/PotatoMcWhiskey'), 'twitch-potatomcwhiskey');
  assert.equal(iconKey('https://www.twitch.tv/videos/123/clip'), undefined);
  assert.equal(iconKey('https://github.com/pydt/client'), undefined);
  assert.equal(iconKey('https://www.playyourdamnturn.com/'), 'site-playyourdamnturn.com');
  assert.equal(iconKey('https://steamcommunity.com/sharedfiles/filedetails/?id=abc'), undefined);
});
