import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import {
  aboutSchema,
  homeSchema,
  privacySchema,
  resourcesSchema,
  rulesSchema,
} from './lib/content-schema';
import { siteSchema } from './lib/site-schema';

const base = './src/content';

const site = defineCollection({
  loader: glob({ pattern: 'site.yaml', base }),
  schema: siteSchema,
});

const home = defineCollection({
  loader: glob({ pattern: 'home.yaml', base }),
  schema: homeSchema,
});

const rules = defineCollection({
  loader: glob({ pattern: '*.md', base: `${base}/rules` }),
  schema: rulesSchema,
});

const resources = defineCollection({
  loader: glob({ pattern: 'resources.yaml', base }),
  schema: resourcesSchema,
});

const about = defineCollection({
  loader: glob({ pattern: 'about.md', base }),
  schema: aboutSchema,
});

const privacy = defineCollection({
  loader: glob({ pattern: 'privacy.md', base }),
  schema: privacySchema,
});

export const collections = { site, home, rules, resources, about, privacy };
