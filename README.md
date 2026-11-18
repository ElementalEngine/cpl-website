# CPL website

Public website for the Civilization Players League (CPL).

- **Preview:** https://cpl.elementalengine.net/ (not indexed)

## Stack

Astro 7, TypeScript (strict), Tailwind CSS 4, Node.js 24. Built to static files and served by Cloudflare Workers.
Data from `core-api-backend` and Challonge is fetched at build time only.

## Editing content

Page content lives in `src/content/`. Edit a file on github.com, open a pull request, and merge once checks pass.
Code and configuration changes require review from a code owner (`.github/CODEOWNERS`).

## Development

Requires Node.js 24.

| Command | Description |
|---|---|
| `npm ci` | Install pinned dependencies |
| `npm run dev` | Start the dev server |
| `npm run verify` | Type check, lint, test, Knip, build, contracts check, accessibility check |
| `npm run a11y` | Accessibility check of `dist/` |

The page `/styleguide/` shows every shared component with placeholder data (not linked, not indexed).
Use it for keyboard, contrast, zoom and reduced-motion checks in both themes.

Design tokens (colours, type sizes, breakpoints) live in `src/styles/global.css`. Only those colours exist.

### Accessibility check

Runs axe-core (WCAG 2.2 A/AA) against every built page in light and dark mode.

| Variable | Values | Default |
|---|---|---|
| `A11Y_BROWSER` | `zen`, `chrome` | `chrome` in CI, `zen` locally |
| `ZEN_PATH`, `CHROME_PATH` | Browser executable | Standard install location |

Skipped locally if the browser isn't found. Always runs in CI.

## Deployment

Deployed by GitHub Actions from `main`. See `OPERATIONS.md`.

The build also writes `robots.txt`, `sitemap.xml` and `_redirects`. Whether search engines may index the site
follows one setting, `SITE` in `astro.config.ts`: the preview host is always blocked.

## Licence

- **Code:** Apache License 2.0 (`LICENSE`).
- **Page content and images:** © Civilization Players League. Not covered by the code licence.
- **Font:** Inter, SIL Open Font License 1.1 (`public/licenses/inter-OFL.txt`). Subset to Latin and Latin Extended, weights 400–700.
