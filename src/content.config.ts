import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { siteSchema } from './lib/site-schema';

const site = defineCollection({
  loader: glob({ pattern: 'site.yaml', base: './src/content' }),
  schema: siteSchema,
});

export const collections = { site };
