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

## Domains

| Domain | Use | Owner | Registrar | Renews | Auto-renew |
|---|---|---|---|---|---|
| `elementalengine.net` | Parent of the preview host | @ProjectCisco | _fill in_ | _fill in_ | _fill in_ |
| `cpl.elementalengine.net` | Preview host. Cloudflare Worker `cpl-website` → Settings → Domains & Routes (custom domain) | @ProjectCisco | — | — | — |
| Live domain | Not yet chosen | @ProjectCisco | Cloudflare Registrar (planned) | — | On |

At go-live the preview host gets a permanent (301) redirect to the live domain.
Never publish the `*.workers.dev` address: it is switched off in `wrangler.jsonc`.

## Secrets and tokens

All live in GitHub → repo **Settings → Environments → `production`**. Only `main` can use them.
Nothing secret is in the repo, Cloudflare settings or the browser.

| Name | Kind | What it can do | Created | Rotate by |
|---|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret | Workers **Editor** on the `cpl-website` Worker only | _fill in_ | 1 year after creation |
| `HEALTHCHECKS_PING_URL` | Secret | Ping one Healthchecks check | _fill in_ | Only if leaked |
| `CLOUDFLARE_ACCOUNT_ID` | Variable (not secret) | Identifies the account for Wrangler | — | — |
| `CHALLONGE_API_KEY` | Secret | Read tournaments (API v1) | When tournaments ship | 1 year |
| `CORE_API_WEBSITE_TOKEN` | Secret | `GET /api/v2/public/*` only | When leaderboards ship | 1 year |

**Yearly rotation (Cloudflare token):**
1. Cloudflare → My Profile → API Tokens → **Roll** on the `cpl-website deploy` token. Copy the new value.
2. GitHub → Settings → Environments → `production` → `CLOUDFLARE_API_TOKEN` → **Update** → paste.
3. Actions → CI → **Run workflow** on `main`. The `deploy` job should go green.
4. Update the dates in the table above.

## Monitors

| Monitor | Watches | Settings | Alerts |
|---|---|---|---|
| Healthchecks.io check `cpl-website pipeline` | The pipeline ran and deployed | Period 1 day, grace 6 hours | Email to owner |
| UptimeRobot `cpl-website home` | Home page answers | HTTP(s), every 5 minutes | Email to owner |
| Cloudflare Web Analytics | Page views and speed | No cookies or browser storage (checked at setup) | — |

## Alert → action

| Alert | Likely cause | Action |
|---|---|---|
| Healthchecks: no ping, or a "fail" ping | Build or deploy failed, or the schedule was paused | Open GitHub → Actions → CI. Re-run the failed run. If the schedule shows "disabled" (60 days with no repo activity), click **Enable workflow** |
| UptimeRobot: site down | Cloudflare outage, or a bad deploy | Check https://www.cloudflarestatus.com/. If a deploy just happened, roll back (below) |
| Stale-data notice on the site | core-api or Challonge down | Nothing; it clears when they recover. Check core-api if it lasts more than 2 days |

## Roll back

**Fast (seconds):** Cloudflare dashboard → Workers & Pages → `cpl-website` → **Deployments** →
on the last good version, open the **⋯** menu → **Rollback** → confirm.

**Permanent:** on GitHub, revert the bad commit (open the merged pull request → **Revert** →
merge the revert pull request). The pipeline redeploys the reverted code. A rollback alone is
undone by the next deploy, including the daily scheduled one.

| Rollback test | Date | Result |
|---|---|---|
| Initial test | _fill in_ | _fill in_ |
