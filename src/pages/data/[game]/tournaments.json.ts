import type { APIRoute } from 'astro';
import { getSite } from '../../../lib/content';
import { tournamentGames, type GameId } from '../../../lib/nav';
import { getBracketData } from '../../../lib/tournament-data';

interface Props {
  game: GameId;
}

export async function getStaticPaths() {
  const site = await getSite();
  return tournamentGames(site).map((game) => ({ params: { game }, props: { game } }));
}

export const GET: APIRoute<Props> = async ({ props }) => {
  const { published } = await getBracketData(props.game);
  return new Response(JSON.stringify(published), {
    headers: { 'content-type': 'application/json' },
  });
};
