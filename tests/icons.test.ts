import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  discordIconUrl,
  discordInviteSchema,
  expiryText,
  extensionFor,
  iconTargets,
  ogImage,
  pickSiteIcon,
  workshopDetailsSchema,
} from '../scripts/lib/icons';

test('finds each Workshop item, Discord invite and Twitch channel once, ignoring other links', () => {
  const yaml = `
    url: https://steamcommunity.com/sharedfiles/filedetails/?id=2865001760
    invite: https://discord.gg/PVATxMgdyJ
    url: https://www.twitch.tv/lege
  `;
  const md = 'Links start with https://. invite: https://discord.gg/PVATxMgdyJ\n[x](https://discord.gg/civfr)';
  assert.deepEqual(iconTargets([yaml, md]), [
    {
      key: 'workshop-2865001760',
      url: 'https://steamcommunity.com/sharedfiles/filedetails/?id=2865001760',
    },
    { key: 'discord-PVATxMgdyJ', url: 'https://discord.gg/PVATxMgdyJ' },
    { key: 'twitch-lege', url: 'https://www.twitch.tv/lege' },
    { key: 'discord-civfr', url: 'https://discord.gg/civfr' },
  ]);
});

test('keeps only image types the site can use', () => {
  assert.equal(extensionFor('image/png'), 'png');
  assert.equal(extensionFor('image/jpeg; charset=binary'), 'jpg');
  assert.equal(extensionFor('text/html'), undefined);
  assert.equal(extensionFor(null), undefined);
});

test('reads Discord invite and Steam Workshop responses', () => {
  const invite = discordInviteSchema.parse({
    code: 'civfr',
    expires_at: null,
    guild: { id: '123', name: 'CivFR', icon: 'abc' },
    extra: 'ignored',
  });
  assert.equal(invite.guild?.name, 'CivFR');
  assert.equal(discordIconUrl('123', 'abc'), 'https://cdn.discordapp.com/icons/123/abc.png?size=128');
  assert.equal(expiryText(null), 'never expires');
  assert.match(expiryText('2026-12-01T00:00:00+00:00'), /^EXPIRES 2026-12-01/);

  const details = workshopDetailsSchema.parse({
    response: {
      result: 1,
      publishedfiledetails: [
        { publishedfileid: '1', result: 1, title: 'BBG', preview_url: 'https://x/y.jpg' },
      ],
    },
  });
  assert.equal(details.response.publishedfiledetails[0].preview_url, 'https://x/y.jpg');
  assert.throws(() => workshopDetailsSchema.parse({ response: { publishedfiledetails: [] } }));
});

test('website logos only when asked; Twitch channels always; GitHub never', () => {
  const yaml = `
    url: https://civgg-five.vercel.app/upload
    url: https://civgg-five.vercel.app/draft
    url: https://www.playyourdamnturn.com/
    url: https://github.com/pydt/client/releases/latest
    url: https://www.twitch.tv/lege
    # Every link must start with https://.
  `;
  assert.deepEqual(iconTargets([yaml]).map(({ key }) => key), ['twitch-lege']);
  assert.deepEqual(
    iconTargets([yaml], { sites: true }).map(({ key }) => key),
    ['site-civgg-five.vercel.app', 'site-playyourdamnturn.com', 'twitch-lege']
  );
});

test('picks a site logo: Apple touch icon, then the largest PNG or an SVG; never ICO', () => {
  const pydt = `<link rel="apple-touch-icon" sizes="180x180" href="/img/apple-touch-icon.png" />
    <link rel="icon" type="image/png" href="/img/favicon-32x32.png" sizes="32x32" />
    <link rel="mask-icon" href="/img/safari-pinned-tab.svg" color="#5bbad5" />`;
  assert.equal(
    pickSiteIcon(pydt, 'https://www.playyourdamnturn.com/'),
    'https://www.playyourdamnturn.com/img/apple-touch-icon.png'
  );
  const next = `<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/icon.svg?abc" type="image/svg+xml" sizes="any">`;
  assert.equal(pickSiteIcon(next, 'https://civgg-five.vercel.app/'), 'https://civgg-five.vercel.app/icon.svg?abc');
  assert.equal(pickSiteIcon('<link rel="shortcut icon" href="/favicon.ico">', 'https://x.org/'), undefined);
  assert.equal(
    pickSiteIcon('<link rel="icon" href="/a-16.png" sizes="16x16"><link rel="icon" href="/a-96.png" sizes="96x96">', 'https://x.org/'),
    'https://x.org/a-96.png'
  );
});

test('reads a Twitch profile picture from the page preview tag', () => {
  const html = `<meta name="description" content="x"><meta property="og:image" content="https://static-cdn.jtvnw.net/jtv_user_pictures/abc-profile_image-300x300.png"/>`;
  assert.equal(
    ogImage(html, 'https://www.twitch.tv/lege'),
    'https://static-cdn.jtvnw.net/jtv_user_pictures/abc-profile_image-300x300.png'
  );
  assert.equal(ogImage('<meta property="og:title" content="x">', 'https://www.twitch.tv/lege'), undefined);
});
