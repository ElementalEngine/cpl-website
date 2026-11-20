import { z } from 'astro/zod';
import { challongeId } from './challonge';
import { ruleTabs, TOURNAMENT_CATEGORIES } from './nav';
import { discordInvite, httpsUrl } from './site-schema';

const DAY_MS = 24 * 60 * 60 * 1000;

/** One line of text, at most `max` characters. */
function line(max: number) {
  return z
    .string()
    .trim()
    .min(1, 'must not be empty')
    .max(max, `must be ${max} characters or fewer`)
    .refine((text) => !text.includes('\n'), 'must be one line');
}

/** Shown in search results and link previews. */
const description = line(160);

/**
 * A date typed as YYYY-MM-DD. It must not be in the future; one day of
 * leeway lets editors ahead of UTC use their own date.
 */
export const pastDate = z.coerce
  .date()
  .refine((date) => date.getTime() <= Date.now() + DAY_MS, 'must not be in the future');

const link = z.strictObject({
  name: line(80),
  summary: line(160),
  url: httpsUrl,
});

/** A mod or tool, with up to 3 extra links at the bottom of its panel (a download, a Discord, a repo). */
const panelLink = link.extend({
  links: z
    .array(z.strictObject({ label: line(30), url: httpsUrl }))
    .max(3, 'must have 3 links or fewer')
    .default([]),
});

/** `src/content/home.yaml` */
export const homeSchema = z.strictObject({
  intro: description,
  highlights: z
    .array(z.strictObject({ title: line(40), text: line(120) }))
    .length(3, 'must have exactly 3 highlights'),
  joinSteps: z.array(line(120)).length(3, 'must have exactly 3 steps'),
});

/** `src/content/rules/*.md` front matter. */
export const rulesSchema = z.strictObject({
  title: line(60),
  description,
  updatedOn: pastDate,
});

/** `src/content/resources.yaml` */
export const resourcesSchema = z.strictObject({
  description,
  modsNote: line(200).optional(),
  mods: z.array(panelLink).min(1, 'must list at least one mod'),
  tools: z
    .array(panelLink)
    .min(1, 'must list at least one tool'),
});

/** `src/content/about.md` front matter. */
export const aboutSchema = z.strictObject({
  description,
  partnersIntro: line(200),
  partners: z
    .array(
      z.strictObject({
        name: line(80),
        summary: line(160),
        invite: discordInvite.optional(),
        website: httpsUrl.optional(),
      })
      .refine((partner) => partner.invite || partner.website, {
        message: 'needs an invite, a website, or both',
      })
    )
    .min(1, 'must list at least one partner'),
  streamers: z
    .array(z.strictObject({ name: line(80), url: httpsUrl }))
    .default([]),
});

/** `src/content/privacy.md` front matter. */
export const privacySchema = z.strictObject({
  description,
  updatedOn: pastDate,
});

const rulePages = ruleTabs().map((tab) => tab.href);

/** A bracket on Challonge: the link as copied from the browser, plus its API id. */
const bracket = z
  .strictObject({ name: line(60), challonge: z.string() })
  .transform(({ name, challonge }, ctx) => {
    const apiId = challongeId(challonge);
    if (!apiId) {
      ctx.addIssue({
        code: 'custom',
        path: ['challonge'],
        message: "must be a Challonge bracket link, e.g. https://challonge.com/abc123 (copy it from the bracket's page)",
      });
      return z.NEVER;
    }
    return { name, link: challonge, apiId };
  });

/** `src/content/tournaments/<slug>.yaml`. The file name is the page anchor. */
export const tournamentSchema = z
  .strictObject({
    name: line(80),
    game: z.enum(['civ6', 'civ7']),
    category: z.enum(TOURNAMENT_CATEGORIES).optional(),
    order: z.number().int().min(1).max(99).optional(),
    format: line(60).optional(),
    description: line(300).optional(),
    rules: z
      .string()
      .refine((rules) => rulePages.includes(rules) || /^https:\/\/\S+$/.test(rules), {
        message: `must be a rules page (${rulePages.join(', ')}) or a link starting with https://`,
      })
      .optional(),
    brackets: z.array(bracket).max(10, 'must have 10 brackets or fewer').default([]),
    winners: z
      .array(line(80))
      .min(1, 'must name at least the winner')
      .max(3, 'must name 3 or fewer (winner, 2nd, 3rd)')
      .optional(),
    endedOn: pastDate.optional(),
    /** The winners are clans or teams: the first place reads "Winners". */
    teams: z.boolean().optional(),
  })
  .refine((tournament) => tournament.winners || tournament.category, {
    path: ['category'],
    message: `a running tournament needs a category (${TOURNAMENT_CATEGORIES.join(', ')}); add winners when it has ended`,
  });
