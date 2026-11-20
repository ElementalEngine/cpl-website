# Operations

Runbook for the CPL website. Owner: @ProjectCisco. Update when a domain, token or monitor changes.

## How a change reaches the site

One workflow, `.github/workflows/ci.yml`:

| Trigger | Runs |
|---|---|
| Pull request | `verify` only. No secrets |
| Push to `main` | `verify` → `deploy` (build with live data → accessibility check → upload) → ping Healthchecks |
| Daily 03:17 UTC | Same as a push (refreshes external data) |
| Manual (Actions → CI → Run workflow) | Same as a push |

`verify` = `astro check` → lint → tests → Knip → build → contracts check → accessibility check.
If any step fails, nothing deploys and the live site keeps its last good version.

`verify` has no secrets, so its build links each Challonge bracket without standings and builds the ladder pages
from the made-up test data in `tests/fixtures/core-api/` (`CORE_API_FIXTURES`). `deploy` builds again with
`CHALLONGE_API_KEY` and `CORE_API_WEBSITE_TOKEN`, runs the accessibility check on those pages, uploads them, then
fails the run if core-api reported a problem that needs a fix (see "core-api").

## Security headers

`public/_headers` is the template. The build adds a `sha256` hash for each inline script and style
it emits to the CSP in `dist/_headers` (`astro.config.ts`, `scripts/lib/csp.ts`), so the hashes always
match the pages. The build fails on inline event handlers (`onclick=`) or `style=` attributes.
Never add `'unsafe-inline'`. After a deploy, https://securityheaders.com should still grade A+.

## Domains

| Domain | Use | Owner | Registrar | Renews | Auto-renew |
|---|---|---|---|---|---|
| `elementalengine.net` | Parent of the preview host | @ProjectCisco | Cloudflare Registrar | 2027-03-20 | On |
| `cpl.elementalengine.net` | Preview host. Cloudflare → Worker `cpl-website` → **Domains** tab (custom domain) | @ProjectCisco | — | — | — |
| Live domain | Not yet chosen | @ProjectCisco | Cloudflare Registrar (planned) | — | On |

- HTTP → HTTPS: redirect rule `cpl: HTTP to HTTPS` (Cloudflare → `elementalengine.net` → Rules), applies to `cpl.elementalengine.net` only.
- `*.workers.dev` and preview URLs are switched off (Worker → **Domains** tab, and `wrangler.jsonc`).
- At go-live the preview host gets a permanent (301) redirect to the live domain.
- **Search engines follow one setting:** `SITE` in `astro.config.ts`. While it is the preview host, the build
  writes a `robots.txt` that blocks all crawlers and no sitemap (and `_headers` adds `X-Robots-Tag: noindex` on
  the preview host). At go-live, set `SITE` to the live domain: the next build writes a `robots.txt` that allows
  crawlers and a `sitemap.xml` of every page except those marked `noindex` (404, style guide).

## Files the build writes

| File | From | Notes |
|---|---|---|
| `_headers` | `public/_headers` + a CSP hash per inline script and style | See "Security headers" |
| `robots.txt` | `SITE` | Preview: block all. Live: allow all + `Sitemap:` line |
| `sitemap.xml` | Built pages | Live only. Pages with `<meta name="robots" content="noindex">` are left out |
| `data/<game>/tournaments.json` | Challonge standings shown on the Tournaments page | Last good data: the next build reads it back from the live site if Challonge fails |
| `data/<game>/ladders.json` | core-api ladders shown on the Ladder pages (no μ or σ) | Last good data, as above, if core-api fails |
| `_redirects` | Built pages | `/civ6/` → the game's first built page, `/civ6/ladder/` and `/civ6/tournaments/` → their first built tab, `/rules/` → the first rule set. Temporary (302), because the target changes with the data and the switches. Before any ladder has players, `/civ6/ladder/` is a page of its own (the season start) and doesn't redirect |

## Secrets and tokens

All live in GitHub → repo **Settings → Environments → `production`**. Only `main` can use them.
Nothing secret is in the repo, Cloudflare settings or the browser.

| Name | Kind | What it can do | Created | Rotate by |
|---|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret | Workers **Editor** on the `cpl-website` Worker only | 2026-11-18 | 2027-11-18 (token expires) |
| `HEALTHCHECKS_PING_URL` | Secret | Ping one Healthchecks check | 2026-11-18 | Only if leaked |
| `CLOUDFLARE_ACCOUNT_ID` | Variable (not secret) | Identifies the account for Wrangler | — | — |
| `CHALLONGE_API_KEY` | Secret | Challonge API v1 key (Challonge Connect app `CPL website`, account `project_cisco`); only reads are used | 2026-11-18 | 2027-11-18 |
| `CORE_API_WEBSITE_TOKEN` | Secret | `GET` on core-api's three public routes only; the same value as prod core-api's `WEBSITE_SERVICE_TOKEN` | 2026-11-20 | 2027-11-20 |

**Yearly rotation (Cloudflare token), before it expires:**
1. Cloudflare → **Manage Account** → **Account API Tokens** → **Create Token** → **Start from scratch** → scope **Specified Workers** → `cpl-website` → **Editor** → expiration **1 year** → create. Copy the value.
2. GitHub → Settings → Environments → `production` → `CLOUDFLARE_API_TOKEN` → **Update** → paste.
3. Actions → CI → **Run workflow** on `main`. The `deploy` job should go green.
4. Delete the old token in Cloudflare. Update the dates above.

## Challonge

The Tournaments page reads each bracket in `src/content/tournaments/` from the Challonge API v1 at build time
(10 s timeout, one retry). Each bracket shows one of:

| Build | Visitors see | Build log line (`deploy` job, "Build with live data") |
|---|---|---|
| Fetched | Standings + "Updated <date>, <time> UTC · Source: Challonge" | `Challonge (civ6): <id>: updated` |
| Fetch failed, earlier data on the live site | Those standings + "Live data unavailable. Showing data from <date>." | `<id>: <reason>; showing data from <date>` |
| Fetch failed, no earlier data | "Standings will appear here soon." + View on Challonge | `<id>: <reason>; no earlier data` |
| No key (pull requests, or the key is removed) | View on Challonge only | `no CHALLONGE_API_KEY: brackets link to Challonge only` |

The page always builds: a Challonge outage never fails a deploy.

**Check the key can read every bracket** (after adding a bracket from another organiser's account, or when
standings stop updating). In PowerShell, in the repo:

```powershell
$env:CHALLONGE_API_KEY = [System.Net.NetworkCredential]::new('', (Read-Host -AsSecureString 'Challonge API key')).Password
npm run challonge
npm run challonge -- https://challonge.com/<any bracket>
Remove-Item Env:CHALLONGE_API_KEY
```

Each bracket prints `PASS` (with its format, state and what the table will show) or `FAIL` with the reason.
`HTTP 401` = wrong key. `HTTP 404` = wrong link, or the key's account can't read it: ask the organiser to add that
account as a co-host on the bracket.

**Set or rotate the key:**
1. https://connect.challonge.com/ (signed in as the key's owner) → app **CPL website** → **API v1 Key** →
   **Create a key** (or replace the old one) → copy it to a password manager. Never screenshot this page: it also
   shows the app's client secret. The app's Sandbox plan allows 500 requests a month; the site uses about 210.
2. GitHub → repo **Settings** → **Environments** → `production` → **Environment secrets** → `CHALLONGE_API_KEY` →
   **Add environment secret** (or the pencil icon to update) → paste → **Add secret**.
3. Actions → CI → **Run workflow** on `main`. In the `deploy` job, "Build with live data" should log `updated` for
   each bracket.

**If Challonge retires API v1:** every bracket shows the stale notice. Delete the `CHALLONGE_API_KEY` secret: the
site then links each bracket to Challonge with no notice (degraded mode). Moving to another API is a code change.

## core-api

The Ladder pages read core-api at build time, in every `deploy` run (push to `main`, daily, manual), through
`https://api.elementalengine.net` with `Authorization: Bearer <CORE_API_WEBSITE_TOKEN>`. Pull requests have no token and
never call it. Switched-off games are not fetched: a build makes 1 call per shown game with the Ladder switched on.

| Route (GET only) | Used for |
|---|---|
| `/api/v2/public/overview` | League totals |
| `/api/v2/public/ladders/{civ6,civ7}` | Every ranked player in all four ladders (season FFA, Teamer, Duel; cloud all time), in one call |
| `/api/v2/public/seasons/{civ6,civ7}/current/stats` | The open season's stats, all three modes in one call |

**Limits (set in core-api):** each answer is kept 600 s, so `updated_at` can be up to ten minutes before the build;
10 calls a minute over all three routes, then `429`. Caddy passes only these exact paths; anything else is `404`.
Each call: 15 s timeout, one retry (after 60 s on a `429`, after 20 s otherwise, none on a setup error).

| Answer | What the build does | Visitors see | Run |
|---|---|---|---|
| `200`, shape as expected | Uses it | The ladders | Green |
| `404 NOT_FOUND` on season stats | The edition has no open season | "No season is open right now…" | Green |
| `429`, `502`, `503 UNAVAILABLE`, `504`, timeout | core-api busy or restarting (a release takes ~20 s): last good data | Last good data + "Live data unavailable. Showing data from <date>." | Green: it clears by itself |
| `401`, `422`, `503 WEBSITE_SERVICE_MISCONFIGURED`, a `404` from Caddy, an unexpected shape | Something needs a fix: last good data | Same as above | **Red** after the upload: "Check core-api problems" prints the reason, Healthchecks alerts |
| No token (secret removed) | The fetch is switched off: last good data | Same as above | Green |
| No last good data (first build) | — | "Leaderboards will appear here soon." | As above |

Build log lines (`deploy` job, "Build with live data"): `core-api (ladders civ6: updated)`, or
`core-api (ladders civ6: <reason>; showing data from <date>)`. Reasons never hold the token or a URL.

**Check the token and every route** (after rotating the token, after a core-api release, or when a run is red). In
PowerShell, in the repo. It makes 5 calls, so wait a minute before building with the token too:

```powershell
$env:CORE_API_WEBSITE_TOKEN = [System.Net.NetworkCredential]::new('', (Read-Host -AsSecureString 'core-api website token')).Password
npm run core-api
Remove-Item Env:CORE_API_WEBSITE_TOKEN
```

Each route prints `PASS` (season, rows per ladder or games per mode) or `FAIL` with the reason. `HTTP 401
UNAUTHORIZED` = the token differs from prod core-api's `WEBSITE_SERVICE_TOKEN`. `unexpected response shape at <field>`
= core-api changed its answer: compare its `openapi.json` with `contracts/core-api/`.

**Build the pages from test data** (to look at them in Zen with no token): `$env:CORE_API_FIXTURES = 'tests/fixtures/core-api'`,
then `npm run build` and `npx astro preview`; `Remove-Item Env:CORE_API_FIXTURES` after. The names and numbers are made up.
The build refuses to run with both `CORE_API_FIXTURES` and a token set.

**Contract:** `contracts/core-api/openapi.json` is core-api's spec from the release in `contracts/core-api/PROVENANCE`.
`npm run contracts:check` (part of `verify`) fails if the site reads a field the spec doesn't have, with another type,
or as never-null where core-api can send null. After a core-api release that changes these routes, copy its
`openapi.json` in, update `PROVENANCE` (tag, SHA, date, md5) and run the check.

**A new route** is a core-api change (Civ Apps) **and** a Caddy `path_regexp` change on the VPS (`vps-config`), before
the site can call it.

**Rotate the token** (yearly, or if leaked):
1. Make a new random value in a password manager.
2. On the VPS, set prod core-api's `WEBSITE_SERVICE_TOKEN` to it and restart `prod-core-api-backend` (about 20 s down;
   the bots retry). Done in the Civ Apps Ops chat.
3. GitHub → repo **Settings** → **Environments** → `production` → `CORE_API_WEBSITE_TOKEN` → pencil icon → paste →
   **Update secret**.
4. Run `npm run core-api` (above): 5 × `PASS`. Then Actions → CI → **Run workflow** on `main`: green.

**Stop the site calling core-api:** delete the `CORE_API_WEBSITE_TOKEN` secret. The next builds use the last good data
(with the notice). To close the public route itself: revert `vps-config` #4 and run its installer on the box (Civ Apps
Ops chat).

## Monitors

| Monitor | Watches | Settings | Alerts |
|---|---|---|---|
| Healthchecks.io check `cpl-website pipeline` | The pipeline ran and deployed | Period 1 day, grace 6 hours | Email to owner |
| UptimeRobot `cpl-website home` | Home page answers | HTTP(s), every 5 minutes | Email to owner |
| Cloudflare Web Analytics | Page views and speed | Snippet in `src/layouts/Base.astro` (site token is public). 0 cookies (Webbkoll, 2026-11-18) | — |

The analytics script is loaded without Subresource Integrity: Cloudflare updates it in place, so a pinned hash would break it. Accepted; it is the only third-party script.

## Alert → action

| Alert | Likely cause | Action |
|---|---|---|
| Healthchecks: no ping, or a "fail" ping | Build or deploy failed, or the schedule was paused | Open GitHub → Actions → CI. Re-run the failed run. If the schedule shows "disabled" (60 days with no repo activity), click **Enable workflow** |
| UptimeRobot: site down | Cloudflare outage, or a bad deploy | Check https://www.cloudflarestatus.com/. If a deploy just happened, roll back (below) |
| Stale-data notice on the site | core-api or Challonge down | Nothing; it clears when they recover. If it lasts more than 2 days, read the build log lines (see "Challonge", "core-api") and run `npm run challonge` or `npm run core-api` |
| Run red at "Check core-api problems" | Wrong token, a route gone, or core-api's answer changed | Read the step's output; run `npm run core-api`. The site is up with the last good data meanwhile |
| "This data is more than 2 days old" on the site | The daily build stopped | Same as "Healthchecks: no ping" |

## Roll back

**Fast (seconds):** Cloudflare → Workers & Pages → `cpl-website` → **Deployments** tab →
on the last good version, open the **⋯** menu → **Rollback** → confirm.

**Permanent:** on GitHub, revert the bad commit (open the merged pull request → **Revert** →
merge the revert pull request). The pipeline redeploys the reverted code. A rollback alone is
undone by the next deploy, including the daily scheduled one.

| Rollback test | Date | Result |
|---|---|---|
| Initial test | 2026-11-18 | Passed. Rolled back to the previous version in the dashboard (old build served), then re-ran CI manually on `main` (current build restored) |
