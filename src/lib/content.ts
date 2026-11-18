import { getEntry } from 'astro:content';
import type { Site } from './site-schema';

/** Site settings from `src/content/site.yaml`, already checked against the schema. */
export async function getSite(): Promise<Site> {
  const entry = await getEntry('site', 'site');
  if (!entry) throw new Error('src/content/site.yaml is missing');
  return entry.data;
}
