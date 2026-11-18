// Downloads each mod's Steam Workshop image, each Discord server's icon, each
// streamer's Twitch profile picture and each tool website's logo into
// src/content/icons/, named workshop-<id>, discord-<invite code>, twitch-<login>
// and site-<host>, and reports
// whether each Discord invite (the site's own one too) expires. Run by hand after
// adding a mod or partner:
//   npm run icons            (skips icons that already exist)
//   npm run icons -- --force (downloads them all again)
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  discordIconUrl,
  discordInviteSchema,
  expiryText,
  extensionFor,
  iconTargets,
  ogImage,
  pickSiteIcon,
  workshopDetailsSchema,
} from './lib/icons';

const CONTENT = 'src/content';
const OUT = join(CONTENT, 'icons');
const PANELS = ['resources.yaml', 'about.md'];
const SITE_LOGOS = ['resources.yaml'];
const CHECK_ONLY = ['site.yaml'];
const MAX_BYTES = 5 * 1024 * 1024;
const force = process.argv.includes('--force');

async function get(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${url}`);
  return response;
}

function existing(key: string): string[] {
  return readdirSync(OUT).filter((file) => file.replace(/\.[^.]+$/, '') === key);
}

async function save(key: string, imageUrl: string): Promise<string> {
  const response = await get(imageUrl);
  const ext = extensionFor(response.headers.get('content-type'));
  if (!ext) throw new Error(`not a PNG, JPEG, WebP, GIF or SVG image: ${imageUrl}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length > MAX_BYTES) throw new Error(`image over 5 MB: ${imageUrl}`);
  for (const old of existing(key)) unlinkSync(join(OUT, old));
  const file = `${key}.${ext}`;
  writeFileSync(join(OUT, file), body);
  return file;
}

async function discord(key: string, code: string, saveIcon: boolean): Promise<string> {
  const invite = discordInviteSchema.parse(
    await (await get(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}`)).json()
  );
  const guild = invite.guild;
  if (!guild) return `invite ${code}: no server found`;
  const status = `${guild.name}, invite ${expiryText(invite.expires_at)}`;
  if (!saveIcon) return status;
  if (!guild.icon) return `${status}; the server has no icon`;
  if (!force && existing(key).length > 0) return `${status}; icon already saved`;
  return `${status}; saved ${await save(key, discordIconUrl(guild.id, guild.icon))}`;
}

async function workshop(key: string, id: string): Promise<string> {
  if (!force && existing(key).length > 0) return 'already saved';
  const body = new URLSearchParams({ itemcount: '1', 'publishedfileids[0]': id });
  const details = workshopDetailsSchema.parse(
    await (
      await get('https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/', {
        method: 'POST',
        body,
      })
    ).json()
  ).response.publishedfiledetails[0];
  if (details.result !== 1 || !details.preview_url) return `item ${id} not found or has no image`;
  return `${details.title ?? id}; saved ${await save(key, details.preview_url)}`;
}

async function twitch(key: string, url: string): Promise<string> {
  if (!force && existing(key).length > 0) return 'already saved';
  const picture = ogImage(await (await get(url)).text(), url);
  if (!picture) return 'no profile picture found on the channel page';
  return `saved ${await save(key, picture)}`;
}

async function site(key: string, url: string): Promise<string> {
  if (!force && existing(key).length > 0) return 'already saved';
  const pageUrl = new URL('/', url).href;
  const page = await (await get(pageUrl)).text();
  const icon = pickSiteIcon(page, pageUrl);
  if (!icon) return 'no PNG or SVG logo found on the page; the panel keeps its plain icon';
  return `saved ${await save(key, icon)}`;
}

if (!existsSync(OUT)) throw new Error(`${OUT} is missing; run this from the repo folder`);
const read = (files: string[]) => files.map((file) => readFileSync(join(CONTENT, file), 'utf8'));
// Discord icons only for panels that are a server (`invite:`), not for extra links to one.
const invites = read(PANELS).flatMap((text) =>
  [...text.matchAll(/^\s*invite:\s*(\S+)/gm)].map((match) => match[1])
);
const serverPanels = new Set(iconTargets(invites).map(({ key }) => key));
const panelTargets = iconTargets(read(PANELS));
const listed = new Set(panelTargets.map(({ key }) => key));
const targets = [
  ...panelTargets,
  // The site's own invite (and its social links) only get the invite expiry check.
  ...iconTargets(read(CHECK_ONLY)).filter(
    ({ key }) => key.startsWith('discord-') && !listed.has(key)
  ),
  ...iconTargets(read(SITE_LOGOS), { sites: true }).filter(({ key }) => key.startsWith('site-')),
];
let failed = 0;
for (const { key, url } of targets) {
  const [kind, id] = [key.slice(0, key.indexOf('-')), key.slice(key.indexOf('-') + 1)];
  try {
    const result =
      kind === 'discord'
        ? await discord(key, id, serverPanels.has(key))
        : kind === 'site'
          ? await site(key, url)
          : kind === 'twitch'
            ? await twitch(key, url)
            : await workshop(key, id);
    console.log(`✓ ${key}: ${result}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${key} (${url}): ${error instanceof Error ? error.message : String(error)}`);
  }
}
if (failed > 0) process.exitCode = 1;
