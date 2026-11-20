import type { APIRoute } from 'astro';
import type { Ladders } from '../../../lib/core-api';
import { getLadders } from '../../../lib/core-api-data';
import { getSite } from '../../../lib/content';
import { shownGames } from '../../../lib/nav';

interface Props {
  data: Ladders;
}

// The ladders on the pages, published as the last good data for the next build.
// Not written when there is no data yet.
export async function getStaticPaths() {
  const site = await getSite();
  const games = shownGames(site).filter((game) => site.games[game].ladder);
  const perGame = await Promise.all(
    games.map(async (game) => {
      const source = await getLadders(game);
      return source.kind === 'fresh' || source.kind === 'stale' ? [{ params: { game }, props: { data: source.data } }] : [];
    })
  );
  return perGame.flat();
}

export const GET: APIRoute<Props> = ({ props }) =>
  new Response(JSON.stringify(props.data), { headers: { 'content-type': 'application/json' } });
