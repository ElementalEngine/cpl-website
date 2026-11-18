import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import type { AstroIntegration } from 'astro';
import { defineConfig, fontProviders } from 'astro/config';
import { addHashesToHeaders, collectInlineHashes } from './scripts/lib/csp';
import { redirectsFile } from './scripts/lib/redirects';
import { isLive, isNoindex, robotsTxt, sitemapXml } from './scripts/lib/seo';
import { listHtmlFiles, urlPathFor } from './scripts/lib/site-pages';
import { shortLinks } from './src/lib/nav';

// engines and no sitemap is written. Change it to the live domain at go-live.
const SITE = 'https://cpl.elementalengine.net';

/** Adds a CSP hash for each inline script and style in the built pages to `dist/_headers`. */
function cspHashes(): AstroIntegration {
  return {
    name: 'csp-hashes',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const files = await listHtmlFiles(root);
        const pages = await Promise.all(
          files.map((file) => readFile(join(root, file), 'utf8'))
        );
        const hashes = collectInlineHashes(pages);
        const headersFile = join(root, '_headers');
        const headers = await readFile(headersFile, 'utf8');
        await writeFile(headersFile, addHashesToHeaders(headers, hashes));
        logger.info(
          `CSP: ${hashes.script.length} inline script and ${hashes.style.length} inline style hash(es) added`
        );
      },
    },
  };
}

/** Writes `robots.txt`, `sitemap.xml` (live only) and `_redirects` from the built pages. */
function siteFiles(site: string): AstroIntegration {
  return {
    name: 'site-files',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const files = await listHtmlFiles(root);
        const pages = await Promise.all(
          files.map(async (file) => ({
            path: urlPathFor(file),
            html: await readFile(join(root, file), 'utf8'),
          }))
        );
        const built = pages.map((page) => page.path);

        await writeFile(join(root, 'robots.txt'), robotsTxt(site));
        await writeFile(join(root, '_redirects'), redirectsFile(shortLinks(), built));
        if (isLive(site)) {
          const listed = pages.filter((page) => !isNoindex(page.html)).map((page) => page.path);
          await writeFile(join(root, 'sitemap.xml'), sitemapXml(site, listed));
          logger.info(`Live: robots.txt allows search engines; sitemap lists ${listed.length} page(s)`);
        } else {
          logger.info('Preview: robots.txt blocks search engines; no sitemap');
        }
      },
    },
  };
}

export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // External stylesheets only, so the CSP needs no 'unsafe-inline'.
    inlineStylesheets: 'never',
  },
  markdown: {
    // The highlighter writes style="" on every code block, which the CSP blocks.
    syntaxHighlight: false,
  },
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Inter',
      cssVariable: '--font-inter',
      fallbacks: ['sans-serif'],
      options: {
        variants: [
          {
            // Inter 4.1, Latin + Latin Extended, weights 400–700 (SIL OFL 1.1).
            src: ['./src/assets/fonts/inter-latin-wght.woff2'],
            weight: '400 700',
            style: 'normal',
          },
        ],
      },
    },
  ],
  integrations: [cspHashes(), siteFiles(SITE)],
  vite: {
    // Never inline scripts or assets: each becomes a file the CSP allows as 'self'.
    build: { assetsInlineLimit: 0 },
    plugins: [tailwindcss()],
  },
});
