# Page content

Page text (Markdown) and lists (YAML) for the website.

## Who can change what

- Files in this folder have no code owner: editors can merge their own changes once checks pass.
- `site.yaml` and `privacy.md` require review from @ProjectCisco. `site.yaml` holds the Discord invite, which games and sections are shown, and the footer links.
- Everything outside this folder requires review from @ProjectCisco.

## How to edit

1. Open the file on github.com and click the pencil icon.
2. Make your change.
3. Click **Commit changes…**, choose **Create a new branch**, then **Propose changes** and **Create pull request**.
4. Wait for the **verify** check to turn green.
5. Click **Squash and merge**. The site updates within a few minutes.

If **verify** fails, the site is not changed. Open the check's details to see which line needs fixing.

## Rules

- Never rename a file: its name is part of the page's web address.
- Links must start with `https://`.
- When you change a rules page, update its `updatedOn` date.
