// Checks that the Challonge API key can read each bracket, and what the site
// would show for it. Reads the key from CHALLONGE_API_KEY; never prints it.
//   npm run challonge                  (every bracket in src/content/tournaments/)
//   npm run challonge -- <link> <link> (only these links)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { challongeId, failureReason, fetchTournament, standingsFrom } from '../src/lib/challonge';

const FOLDER = 'src/content/tournaments';

function linksInContent(): string[] {
  return readdirSync(FOLDER)
    .filter((file) => file.endsWith('.yaml'))
    .flatMap((file) =>
      [...readFileSync(join(FOLDER, file), 'utf8').matchAll(/^\s*challonge:\s*["']?(\S+?)["']?\s*$/gm)].map(
        (match) => match[1]
      )
    );
}

const apiKey = process.env.CHALLONGE_API_KEY?.trim();
if (!apiKey) {
  console.error('Set CHALLONGE_API_KEY first.');
  process.exit(1);
}

const links = process.argv.slice(2).length > 0 ? process.argv.slice(2) : linksInContent();
let failed = 0;

for (const link of links) {
  const apiId = challongeId(link);
  if (!apiId) {
    failed += 1;
    console.log(`FAIL  ${link}: not a Challonge bracket link`);
    continue;
  }
  try {
    const tournament = await fetchTournament(apiId, apiKey);
    const standings = standingsFrom(tournament);
    const played = tournament.matches.filter(({ match }) => match.state === 'complete').length;
    const table = standings.rows.some((row) => row.record)
      ? 'wins and losses'
      : standings.rows.some((row) => row.rank !== null)
        ? 'names and final places'
        : 'names only';
    console.log(
      [
        `PASS  ${apiId}`,
        `"${tournament.name ?? ''}"`,
        tournament.tournament_type,
        tournament.state,
        `${standings.rows.length} players`,
        `${played} of ${tournament.matches.length} matches played`,
        `table: ${table}`,
      ].join(' · ')
    );
  } catch (error) {
    failed += 1;
    console.log(`FAIL  ${apiId}: ${failureReason(error)}`);
  }
}

console.log(
  failed === 0
    ? `All ${links.length} bracket(s) can be read.`
    : `${failed} of ${links.length} bracket(s) failed.`
);
if (failed > 0) process.exitCode = 1;
