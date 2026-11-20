// Checks the website token against core-api's live routes and that each answer matches the
// site's schemas. Reads the token from CORE_API_WEBSITE_TOKEN; never prints it. Makes 5 calls
// (core-api allows 10 a minute in total, so don't run it twice in the same minute as a build).
//   npm run core-api
import type { z } from 'astro/zod';
import {
  CORE_API_ROUTES,
  failureKind,
  failureReason,
  getCoreApi,
  laddersSchema,
  overviewSchema,
  seasonStatsSchema,
} from '../src/lib/core-api';
import { formatDateTime } from '../src/lib/format';

const fromEnv = process.env.CORE_API_WEBSITE_TOKEN?.trim();
if (!fromEnv) {
  console.error('Set CORE_API_WEBSITE_TOKEN first (see OPERATIONS.md, "core-api").');
  process.exit(1);
}
const token: string = fromEnv;

let failed = 0;

async function check<T extends { updated_at: string }>(path: string, schema: z.ZodType<T>, describe: (data: T) => string) {
  try {
    // No retry here: a failure should show at once.
    const data = await getCoreApi(path, schema, token, { retryDelayMs: () => null });
    console.log(`PASS  ${path} · ${describe(data)} · updated ${formatDateTime(new Date(data.updated_at))}`);
  } catch (error) {
    if (failureKind(error, path) === 'no-season') {
      console.log(`PASS  ${path} · no season open (404 NOT_FOUND)`);
      return;
    }
    failed += 1;
    console.log(`FAIL  ${path}: ${failureReason(error)}`);
  }
}

await check(CORE_API_ROUTES.overview(), overviewSchema, (data) => `${data.registered_players} players, ${data.matches_played} matches`);
for (const edition of ['civ6', 'civ7']) {
  await check(CORE_API_ROUTES.ladders(edition), laddersSchema, (data) =>
    [data.season_label ?? 'no season', ...data.ladders.map((ladder) => `${ladder.key} ${ladder.rows.length}`)].join(' · ')
  );
  await check(CORE_API_ROUTES.stats(edition), seasonStatsSchema, (data) =>
    [data.season_label, ...data.modes.map((mode) => `${mode.mode} ${mode.games} games`)].join(' · ')
  );
}

console.log(failed === 0 ? 'All 5 routes answer and match the site.' : `${failed} of 5 route(s) failed.`);
if (failed > 0) process.exitCode = 1;
