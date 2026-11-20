import type { APIRoute } from 'astro';
import type { SeasonStats } from '../../../lib/core-api';
import { getSeasonStats } from '../../../lib/core-api-data';
import { getSite } from '../../../lib/content';
import { shownGames } from '../../../lib/nav';

interface Props {
  data: SeasonStats;
}

// The season stats on the pages, published as the last good data for the next build.
// Not written when there is no data or no open season.
export async function getStaticPaths() {
  const site = await getSite();
  const games = shownGames(site).filter((game) => site.games[game].stats);
  const perGame = await Promise.all(
    games.map(async (game) => {
      const source = await getSeasonStats(game);
      return source.kind === 'fresh' || source.kind === 'stale' ? [{ params: { game }, props: { data: source.data } }] : [];
    })
  );
  return perGame.flat();
}

export const GET: APIRoute<Props> = ({ props }) =>
  new Response(JSON.stringify(props.data), { headers: { 'content-type': 'application/json' } });
