import { z } from 'astro/zod';

export const httpsUrl = z
  .string()
  .regex(/^https:\/\/\S+$/, 'must be a link starting with https://');

/** A Discord invite link. Use a permanent invite: temporary ones expire. */
export const discordInvite = z
  .string()
  .regex(
    /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]+$/,
    'must be a Discord invite (https://discord.gg/… or https://discord.com/invite/…)'
  );

const gameSwitches = z
  .strictObject({
    /** A line or two at the top of the game's page. */
    intro: z.string().trim().min(1).max(240).optional(),
    show: z.boolean(),
    ladder: z.boolean(),
    stats: z.boolean(),
    tournaments: z.boolean(),
  })
  .refine((game) => !game.show || game.ladder || game.stats || game.tournaments, {
    message: 'a shown game needs at least one section switched on',
  });

/** `src/content/site.yaml`: settings only the site owner changes. */
export const siteSchema = z.strictObject({
  discordInvite,
  games: z.strictObject({
    civ6: gameSwitches,
    civ7: gameSwitches,
  }),
  socials: z
    .array(
      z.strictObject({
        name: z.string().min(1),
        url: httpsUrl,
        kind: z.enum(['follow', 'support']),
      })
    )
    .default([]),
});

export type Site = z.infer<typeof siteSchema>;
