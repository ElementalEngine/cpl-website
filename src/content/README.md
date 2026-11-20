# Editing page content

Page text (Markdown, `.md`) and lists (YAML, `.yaml`) for the website. Every file is checked when you
propose a change. If a check fails, the live site keeps its last good version.

## Who can change what

- Files in this folder have no code owner: editors can merge their own changes once checks pass.
- `site.yaml` and `privacy.md` need review from @ProjectCisco.
- Everything outside this folder needs review from @ProjectCisco.

## How to edit

1. Open the file on github.com and click the pencil icon (**Edit this file**).
2. Make your change.
3. Click **Commit changes…**, choose **Create a new branch**, then **Propose changes** and **Create pull request**.
4. Wait for the **verify** check to turn green (a few minutes).
5. Click **Squash and merge**. The site updates within a few minutes.

## Rules for every file

- **Never rename or move a file.** File names are part of web addresses and links.
- **Links start with `https://`.**
- **Discord invites must never expire.** In Discord: **Invite People** → **Edit invite link** →
  **Expire After: Never**. Use `https://discord.gg/…` or `https://discord.com/invite/…`.
- **Keep the structure.** Don't remove a field name or change the indentation in YAML or in the block
  between the `---` lines at the top of a Markdown file.
- **`description`** is one line, 160 characters or fewer. Search results and Discord link previews show it.
- In YAML, put a value in double quotes if it contains `: ` (colon and space) or starts with `#`, `-`, `*`,
  `[`, `{` or `>`: `summary: "Ranked: FFA only"`.

## The files

| File | Page | What you can change |
|---|---|---|
| `home.yaml` | Home | `intro` (one line, up to 160 characters), `highlights` (exactly 3, each an `icon` (`ladder`, `trophy` or `chat`), a `title` up to 40 characters and one line of `text` up to 120) and `joinSteps` (exactly 3 short lines) |
| `rules/general.md` | Rules → General | Subs, drops, remaps, scraps, voting, timed games, punishments, other rules |
| `rules/in-game.md` | Rules → In-game | Rules for playing a game |
| `rules/exploits.md` | Rules → Exploits | Banned exploits, under a `## Civ 6` and a `## Civ 7` heading |
| `rules/cloud.md` | Rules → Cloud | Play-by-cloud rules |
| `rules/pl.md` | Rules → PL | The Premier League rules |
| `rules/discord.md` | Rules → Discord | The Discord server rules |
| `resources.yaml` | Resources | `modsNote`, the `mods` list, the `tools` list, extra `links` on mods and tools |
| `tournaments/*.yaml` | Civ 6 → Tournaments (tabs PL, Cloud, Past winners), Home "On now" | One file per tournament: running ones and past winners |
| `about.md` | About CPL | The text about CPL, `partnersIntro`, the `partners` list, the `streamers` list |
| `privacy.md` | Privacy | Owner only |
| `site.yaml` | Every page | Owner only: Discord invite, which games and sections show, footer links |

### Rules pages (`rules/*.md`)

```markdown
---
title: PL rules
description: The rules for the CPL Premier League.
updatedOn: 2026-11-18
---

## Scheduling

Games are played on…
```

- **Change `updatedOn` every time you change the rules.** Use today's date as `YYYY-MM-DD`. The page shows it as
  "Last updated". A date in the future fails the check.
- Use `##` for sections and `###` for sub-sections. Don't use `#`: the page title is already the top heading.
- The search box on the rules pages finds rules by their `##` and `###` sections, so give each rule its own
  heading with words people would search for (for example `### Unit stacking`).
- Rules that differ between games go under headings that start with the game: `## Civ 6: banned exploits`,
  `## Civ 7: banned exploits`.
- The rules on this site are the master copy. If a rule changes, change it here first, then in Discord.
- The tabs are fixed: General, In-game, Exploits, Cloud, PL, Discord. A new file in `rules/` fails the check.

### Lists (`home.yaml`, `resources.yaml`, `about.md`)

Each item in a list starts with `- ` and its fields line up under it:

```yaml
tools:
  - name: CivReplay
    summary: Upload your games to civgg to get replays and stats.
    url: https://civgg-five.vercel.app/upload
    links:
      - label: GitHub
        url: https://github.com/bartsake/civreplay-releases
```

- `name`: up to 80 characters. `summary`: one line, up to 160 characters.
- Order in the file is the order on the page.
- Partners need an `invite` (a permanent Discord invite), a `website`, or both. The panel opens the invite when there is one.
- Streamers need a `name` and a `url`.
- Mods and tools may have up to 3 extra `links` (each a short `label` and a `url`), shown at the bottom of the panel.

### Tournaments (`tournaments/*.yaml`)

One file per tournament. **The file name is part of the web address**: `pl-season-7.yaml` in the PL tab is
`/civ6/tournaments/pl/#pl-season-7`. Use lowercase letters, numbers and hyphens, and never rename it.
For a new season, make a new file (copy the last one) instead of editing the old one.

A running tournament:

```yaml
name: CPL Premier League Season 7
game: civ6
category: pl
order: 1
format: League, 3 divisions
description: Weekly league games. Top of each division goes up.
rules: /rules/pl/
brackets:
  - name: Division 1
    challonge: https://challonge.com/CPL_PL_S7_D1
  - name: Division 2
    challonge: https://challonge.com/CPL_PL_S7_D2
```

- `name` and `game` (`civ6` or `civ7`) are required.
- `category` is required while it runs: the tab it shows under, `pl` or `cloud`.
- `order`: a number from 1 to 99. Lower numbers show first in their tab; tournaments without one come after, by file name.
- `format`: short, up to 60 characters. `description`: one line, up to 300 characters.
- `rules`: a rules page on this site (`/rules/general/`, `/rules/in-game/`, `/rules/exploits/`, `/rules/cloud/`,
  `/rules/pl/`, `/rules/discord/`) or a link starting with `https://`.
- `brackets`: up to 10. For `challonge`, open the bracket on challonge.com and copy the address from the browser.
  Links like `https://challonge.com/abc123`, `https://challonge.com/abc123/standings` and
  `https://yourgroup.challonge.com/abc123` all work. The standings are read from Challonge every time the site is built (at least once a day).
- No `brackets` yet: the page shows the tournament as "Starting soon".

**When a tournament ends**, add `winners` (the winner, or the top 3 in order) and `endedOn`. It then moves to
the **Past winners** tab and its brackets are no longer shown (`category` can stay):

```yaml
winners: [Player A, Player B, Player C]
endedOn: 2027-02-14
```

An old event from before the website needs only `name`, `game` and `winners` (`endedOn` if you know it).
If the winners are clans or teams, add `teams: true`: the first place then reads "Winners".
Past winners show newest `endedOn` first, then those without a date.

## Icons (`icons/`)

Mod panels show the mod's Steam Workshop image; Discord panels show the server's icon. They live in
`src/content/icons/`, named after the link:

- `workshop-<id>` for a Workshop item (the number after `?id=` in its link), for example `workshop-2865001760.jpg`
- `discord-<invite code>` for a Discord invite (the part after `discord.gg/`), for example `discord-civfr.png`
- `tournament-<file name>` for a tournament's badge, for example `tournament-ccc-17.png` for
  `tournaments/ccc-17.yaml`. It shows next to the tournament's name (optional; round images look best)

A panel with no image here shows a plain icon instead, so a new mod or partner never breaks the page.

**After adding a mod or partner** (owner, on a PC): run `npm run icons` in the repo. It downloads the
missing images, lists every Discord invite and says whether it expires, then you commit the new files.
`npm run icons -- --force` downloads them all again (for a changed server icon).

**Editors on github.com:** upload a PNG, JPEG or WebP to `src/content/icons/` with the name above
(**Add file** → **Upload files**). Square images look best.

## When a check fails

1. On the pull request, click **Details** next to the red **verify** check.
2. Look for the error that names a file or collection from this folder (for example `home` or `rules`).
   It says which field is wrong and why, for example `joinSteps: must have exactly 3 steps` or
   `updatedOn: must not be in the future`.
3. Edit the same file on your branch to fix it. The check runs again by itself.

Common causes: a missing or misspelled field name, a Challonge link that isn't a bracket page, a wrong indent in YAML, a link without `https://`,
a temporary Discord invite format, or text over the length limit. If you can't find it, ask
@ProjectCisco on the pull request.
