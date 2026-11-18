---
description: How the CPL website and the CPL Discord bots use your information.
updatedOn: 2026-11-18
---

This policy covers the CPL website and the three Discord bots that run the Civilization Players League (CPL): Authbot, Lady Justice and Mito Bot. ElementalEngine operates them for CPL.

**Contact:** <civplayersleague@ElementalEngine.onmicrosoft.com>

## Summary

- The website has no accounts, no forms and no cookies.
- The website shows public league information, including players' display names. There is no opt-out.
- The bots store what they need to verify players, run ranked games and moderate the server. They never read your messages.
- We do not sell your data, share it with advertisers, or use it to train machine learning or AI models.

## The website

### What it collects

Nothing that identifies you. There are no accounts, sign-ins or forms, and the site sets no cookies.

- **Hosting:** Cloudflare serves the website. Like any web host, it processes your IP address and browser details to deliver pages and protect the site from attacks.
- **Analytics:** Cloudflare Web Analytics counts page views and measures page speed. It uses no cookies and stores nothing on your device. We see totals, not individual visitors.

### What it shows

- **Tournament standings,** read from Challonge, with names as they appear there.
- **Leaderboards and season stats,** read from the CPL bots' records: each ranked player's display name, rating and results.

**Display names are public.** If you play ranked CPL games, your display name, rating and results can appear on this website for anyone to see. There is no opt-out. The website never shows Discord IDs, linked game accounts or anything else from your registration.

### Your theme choice

The website follows your device's light or dark setting. If you use the theme button, your choice (light or dark) is saved in your browser's storage on this device, so the next page uses it too. It is never sent to us.

To clear it, clear this site's data in your browser, or use this button:

<button type="button" data-theme-reset>Use device setting</button>

<p role="status" data-theme-status></p>

## The CPL Discord bots

The bots run inside the CPL Discord server. To do their jobs they store some information about members on servers we control, outside of Discord.

None of the three bots read, store or process the content of your messages. They work through slash commands, buttons and menus only. We do not track your presence or online status.

### Authbot: account verification

When you register, we store:

- Your Discord user ID, username and display name
- Your Discord locale, whether your Discord account is email-verified, and whether you have two-factor authentication turned on, recorded once, when you register
- The gaming account you link: platform (Steam, Epic, 2K or Xbox), account ID and account name
- For Steam registrations: your recorded playtime in Civilization VI and/or VII, and the time we verified you own the game
- Which games you are registered for, and how each registration was verified

Registration also creates a temporary session record holding a random session identifier and a one-time token. These are valid for minutes, not days, and expire automatically.

### Lady Justice: moderation

When a moderator issues a warning or suspension, we store:

- Your Discord user ID
- The infraction category or type, the tier reached, and the number of days applied
- The suspension start and end dates
- Any reason text the moderator entered
- The Discord role IDs you held at the time of suspension, so your roles can be restored automatically when the suspension ends

### Mito Bot: match reporting and ranked stats

When a match is reported, we store:

- The Discord user IDs of the players involved
- The match result and the game settings agreed for that match
- Your TrueSkill rating and your season and lifetime statistics

Match reports are submitted by uploading a Civilization save file. The file is read to work out the result of the game, and that result is what we keep.

### Why we collect it

- **To verify eligibility.** Confirming you own the game and have enough playtime is what gives access to ranked play.
- **To manage roles.** All three bots add and remove Discord roles: verification roles, rank roles and suspension roles.
- **To run the league.** Ratings, leaderboards and match history need a lasting record of results.
- **To enforce the rules.** Infraction history is what makes escalating penalties possible, and storing your roles is what allows them to be given back.

### Where it is stored

On MongoDB Atlas, reached only through our own backend service. Access is limited to the project maintainers. The website reads only the public information listed under "What it shows".

### How long we keep it

We keep your records for as long as the league runs, unless you ask us to delete them.

- **Verification records** stay so you do not have to verify again. They remain if you leave the Discord server, so returning members keep their verified status.
- **Match results and ratings** are part of the league's competitive record and are kept as historical results.
- **Infraction and suspension history** is kept so that penalties escalate correctly over time.
- **Registration sessions** expire automatically within minutes and are not kept.

### Third parties

- **Discord:** we receive your account information through Discord's API. Discord's own privacy policy covers your relationship with them.
- **Steam (Valve):** for Steam registrations we ask the Steam Web API to confirm game ownership and playtime. We send your Steam ID; we do not send Valve anything about your activity with us.

## Your choices

- **Access:** you can ask what we hold about you.
- **Deletion:** you can ask us to delete your verification record and the gaming account linked to it. Moderation history may be kept where it is needed for the integrity of the league; if we decline a deletion for that reason, we will tell you why.
- **Correction:** if a linked account or a match result is wrong, tell us and we will fix it.
- **Withdrawing:** leaving the CPL Discord server stops any further collection.

To make a request, email the contact address at the top of this page.

## Changes

If this policy changes materially, we will post a notice in the CPL Discord server. The "Last updated" date at the top always shows the current version.
