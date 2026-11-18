import type { APIRoute } from 'astro';
import { render } from 'astro:content';
import { getRuleSets } from '../../lib/content';
import { sectionsOf } from '../../lib/rules-search';

/** Every rules section as plain text, for the search box on the rules pages. */
export const GET: APIRoute = async () => {
  const sets = await getRuleSets();
  const sections = await Promise.all(
    sets.map(async ({ id, label, entry }) => {
      const { headings } = await render(entry);
      return sectionsOf(
        { path: `/rules/${id}/`, set: label, title: entry.data.title, body: entry.body ?? '' },
        headings
      );
    })
  );
  return new Response(JSON.stringify(sections.flat()), {
    headers: { 'content-type': 'application/json' },
  });
};
