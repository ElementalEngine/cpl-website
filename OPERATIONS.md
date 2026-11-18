# Operations

Runbook for the CPL website. Owner: @ProjectCisco. Update when a domain, token or monitor changes.

## How a change reaches the site

One workflow, `.github/workflows/ci.yml`:

| Trigger | Runs |
|---|---|
| Pull request | `verify` only. No secrets |
| Push to `main` | `verify` → `deploy` → ping Healthchecks |
| Daily 03:17 UTC | Same as a push (refreshes external data) |
| Manual (Actions → CI → Run workflow) | Same as a push |

`verify` = `astro check` → lint → tests → Knip → build → contracts check → accessibility check.
If any step fails, nothing deploys and the live site keeps its last good version.

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

## Secrets and tokens

All live in GitHub → repo **Settings → Environments → `production`**. Only `main` can use them.
Nothing secret is in the repo, Cloudflare settings or the browser.

| Name | Kind | What it can do | Created | Rotate by |
|---|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret | Workers **Editor** on the `cpl-website` Worker only | 2026-11-18 | 2027-11-18 (token expires) |
| `HEALTHCHECKS_PING_URL` | Secret | Ping one Healthchecks check | 2026-11-18 | Only if leaked |
| `CLOUDFLARE_ACCOUNT_ID` | Variable (not secret) | Identifies the account for Wrangler | — | — |
| `CHALLONGE_API_KEY` | Secret | Read tournaments (API v1) | When tournaments ship | 1 year |
| `CORE_API_WEBSITE_TOKEN` | Secret | `GET /api/v2/public/*` only | When leaderboards ship | 1 year |

**Yearly rotation (Cloudflare token), before it expires:**
1. Cloudflare → **Manage Account** → **Account API Tokens** → **Create Token** → **Start from scratch** → scope **Specified Workers** → `cpl-website` → **Editor** → expiration **1 year** → create. Copy the value.
2. GitHub → Settings → Environments → `production` → `CLOUDFLARE_API_TOKEN` → **Update** → paste.
3. Actions → CI → **Run workflow** on `main`. The `deploy` job should go green.
4. Delete the old token in Cloudflare. Update the dates above.

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
| Stale-data notice on the site | core-api or Challonge down | Nothing; it clears when they recover. Check core-api if it lasts more than 2 days |

## Roll back

**Fast (seconds):** Cloudflare → Workers & Pages → `cpl-website` → **Deployments** tab →
on the last good version, open the **⋯** menu → **Rollback** → confirm.

**Permanent:** on GitHub, revert the bad commit (open the merged pull request → **Revert** →
merge the revert pull request). The pipeline redeploys the reverted code. A rollback alone is
undone by the next deploy, including the daily scheduled one.

| Rollback test | Date | Result |
|---|---|---|
| Initial test | 2026-11-18 | Passed. Rolled back to the previous version in the dashboard (old build served), then re-ran CI manually on `main` (current build restored) |
