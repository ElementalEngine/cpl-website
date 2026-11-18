import { getCollection, getEntry } from 'astro:content';
import { RULE_SETS } from './nav';
import type { Site } from './site-schema';

function missing(file: string): never {
  throw new Error(`src/content/${file} is missing`);
}

/** Site settings from `src/content/site.yaml`, already checked against the schema. */
export async function getSite(): Promise<Site> {
  const entry = await getEntry('site', 'site');
  return entry?.data ?? missing('site.yaml');
}

export async function getHome() {
  const entry = await getEntry('home', 'home');
  return entry?.data ?? missing('home.yaml');
}

export async function getResources() {
  const entry = await getEntry('resources', 'resources');
  return entry?.data ?? missing('resources.yaml');
}

export async function getAbout() {
  return (await getEntry('about', 'about')) ?? missing('about.md');
}

export async function getPrivacy() {
  return (await getEntry('privacy', 'privacy')) ?? missing('privacy.md');
}

/** The three rule sets, in tab order. Fails on a missing or unexpected file. */
export async function getRuleSets() {
  const entries = await getCollection('rules');
  const known = new Set<string>(RULE_SETS.map(({ id }) => id));
  const extra = entries.find((entry) => !known.has(entry.id));
  if (extra) {
    throw new Error(
      `src/content/rules/${extra.id}.md is not a rule set. Use ${RULE_SETS.map(({ id }) => `${id}.md`).join(', ')}`
    );
  }
  return RULE_SETS.map((set) => ({
    ...set,
    entry: entries.find((entry) => entry.id === set.id) ?? missing(`rules/${set.id}.md`),
  }));
}
