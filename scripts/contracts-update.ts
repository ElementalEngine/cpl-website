// Copies core-api's OpenAPI spec into contracts/core-api/, cut down to the website's routes,
// and records where it came from. Then run `npm run contracts:check`.
//   npm run contracts:update -- <path to core-api's openapi.json> <tag> <commit SHA>
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { trimSpec } from './lib/contracts';

const [source, tag, sha] = process.argv.slice(2);
if (!source || !tag || !sha) {
  console.error('Usage: npm run contracts:update -- <path to openapi.json> <tag> <commit SHA>');
  process.exit(1);
}

const md5 = (text: string) => createHash('md5').update(text).digest('hex');
const sourceText = readFileSync(source, 'utf8');
const trimmed = `${JSON.stringify(trimSpec(JSON.parse(sourceText)), null, 2)}\n`;
writeFileSync('contracts/core-api/openapi.json', trimmed);
writeFileSync(
  'contracts/core-api/PROVENANCE',
  `source-repo: ElementalEngine/core-api-backend
source-tag: ${tag}
source-sha: ${sha}
source-date: ${new Date().toISOString().slice(0, 10)}
source-md5: ${md5(sourceText)}
md5: ${md5(trimmed)}

core-api's OpenAPI spec as released, cut down to the website's three routes (overview, ladders
and season stats per edition) and the schemas they use. \`npm run contracts:check\` fails if the
site's schemas (src/lib/core-api.ts) read a field the spec doesn't have, with a different type,
or as never-null where core-api can send null. To move to a new core-api release, run
\`npm run contracts:update -- <its openapi.json> <tag> <SHA>\`, then \`npm run contracts:check\`.
`
);
console.log(`contracts: core-api ${tag} (${sha}) written, cut down to the website's routes`);
