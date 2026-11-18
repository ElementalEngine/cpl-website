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

`verify` has no secrets, so its build links each Challonge bracket without standings. `deploy` builds again with
`CHALLONGE_API_KEY`, runs the accessibility check on those pages, then uploads them.

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
| `_redirects` | Built pages | `/civ6/` → the game's first built section, `/civ6/tournaments/` → its first tournament tab, `/rules/` → the first rule set. Temporary (302), because the target changes when sections are switched on |

## Secrets and tokens

All live in GitHub → repo **Settings → Environments → `production`**. Only `main` can use them.
Nothing secret is in the repo, Cloudflare settings or the browser.

| Name | Kind | What it can do | Created | Rotate by |
|---|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret | Workers **Editor** on the `cpl-website` Worker only | 2026-11-18 | 2027-11-18 (token expires) |
| `HEALTHCHECKS_PING_URL` | Secret | Ping one Healthchecks check | 2026-11-18 | Only if leaked |
| `CLOUDFLARE_ACCOUNT_ID` | Variable (not secret) | Identifies the account for Wrangler | — | — |
| `CHALLONGE_API_KEY` | Secret | Challonge API v1 key (Challonge Connect app `CPL website`, account `project_cisco`); only reads are used | 2026-11-18 | 2027-11-18 |
| `CORE_API_WEBSITE_TOKEN` | Secret | `GET /api/v2/public/*` only | When leaderboards ship | 1 year |

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
| Stale-data notice on the site | core-api or Challonge down | Nothing; it clears when they recover. If it lasts more than 2 days, read the build log lines (see "Challonge") and run `npm run challonge` |

## Roll back

**Fast (seconds):** Cloudflare → Workers & Pages → `cpl-website` → **Deployments** tab →
on the last good version, open the **⋯** menu → **Rollback** → confirm.

**Permanent:** on GitHub, revert the bad commit (open the merged pull request → **Revert** →
merge the revert pull request). The pipeline redeploys the reverted code. A rollback alone is
undone by the next deploy, including the daily scheduled one.

| Rollback test | Date | Result |
|---|---|---|
| Initial test | 2026-11-18 | Passed. Rolled back to the previous version in the dashboard (old build served), then re-ran CI manually on `main` (current build restored) |
