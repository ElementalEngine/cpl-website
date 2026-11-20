// Checks the site's core-api schemas against the vendored spec (contracts/core-api/openapi.json)
// and that the spec is the file PROVENANCE records. Exit 1 on any mismatch.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'astro/zod';
import { laddersSchema, overviewSchema, seasonStatsSchema } from '../src/lib/core-api';
import { contractProblems } from './lib/contracts';

const FOLDER = 'contracts/core-api';
const specText = readFileSync(`${FOLDER}/openapi.json`, 'utf8');
const provenance = readFileSync(`${FOLDER}/PROVENANCE`, 'utf8');
const field = (key: string) => provenance.match(new RegExp(`^${key}: (\\S+)$`, 'm'))?.[1];

const problems: string[] = [];
const md5 = createHash('md5').update(specText).digest('hex');
if (md5 !== field('md5')) problems.push(`openapi.json: md5 ${md5} differs from PROVENANCE (${field('md5') ?? 'none'})`);

const jsonSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
problems.push(
  ...contractProblems(JSON.parse(specText), [
    { path: '/api/v2/public/overview', schema: jsonSchema(overviewSchema) },
    { path: '/api/v2/public/ladders/{edition}', schema: jsonSchema(laddersSchema) },
    { path: '/api/v2/public/seasons/{edition}/current/stats', schema: jsonSchema(seasonStatsSchema) },
  ])
);

if (problems.length > 0) {
  console.error(`contracts: ${problems.length} problem(s) against core-api ${field('source-tag') ?? '?'}`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(`contracts: the site's 3 core-api reads match ${field('source-tag')} (${field('source-sha')})`);
