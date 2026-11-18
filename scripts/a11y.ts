import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, resolve, sep } from 'node:path';
import axe from 'axe-core';
import puppeteer from 'puppeteer-core';
import { fileFor, listHtmlFiles, urlPathFor } from './lib/site-pages';

type Scheme = 'light' | 'dark';

interface BrowserChoice {
  pathVar: string;
  paths: Partial<Record<NodeJS.Platform, string>>;
  launch: (path: string, scheme: Scheme) => ReturnType<typeof puppeteer.launch>;
  perPageScheme: boolean;
}

const BROWSERS: Record<string, BrowserChoice> = {
  chrome: {
    pathVar: 'CHROME_PATH',
    paths: {
      win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      linux: '/usr/bin/google-chrome',
    },
    // GitHub's Ubuntu runners block Chrome's sandbox; only local pages are loaded.
    launch: (path) =>
      puppeteer.launch({
        browser: 'chrome',
        executablePath: path,
        args: ['--no-sandbox'],
      }),
    perPageScheme: true,
  },
  zen: {
    pathVar: 'ZEN_PATH',
    paths: {
      win32: 'C:\\Program Files\\Zen Browser\\zen.exe',
      darwin: '/Applications/Zen.app/Contents/MacOS/zen',
    },
    // Firefox-based: colour scheme is a startup preference (0 = dark, 1 = light).
    launch: (path, scheme) =>
      puppeteer.launch({
        browser: 'firefox',
        executablePath: path,
        extraPrefsFirefox: {
          'layout.css.prefers-color-scheme.content-override':
            scheme === 'dark' ? 0 : 1,
          // Reduced motion: every block is shown at load, so axe checks it all.
          'ui.prefersReducedMotion': 1,
        },
      }),
    perPageScheme: false,
  },
};

const DIST = resolve('dist');
const SCHEMES: Scheme[] = ['light', 'dark'];
const TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
];
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

const name = process.env.A11Y_BROWSER ?? (process.env.CI ? 'chrome' : 'zen');
const choice = BROWSERS[name];
if (!choice) {
  throw new Error(
    `A11Y_BROWSER must be one of: ${Object.keys(BROWSERS).join(', ')}`
  );
}
const browserPath =
  process.env[choice.pathVar] ?? choice.paths[process.platform];

if (!browserPath || !existsSync(browserPath)) {
  if (process.env.CI) throw new Error(`${name} not found at ${browserPath}`);
  console.log(`a11y: skipped (${name} not found; set ${choice.pathVar})`);
  process.exit(0);
}

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  const full = join(DIST, fileFor(path));
  const send = (status: number, file: string) =>
    readFile(file).then((body) => {
      res.writeHead(status, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      });
      res.end(body);
    });
  const notFound = () => send(404, join(DIST, '404.html'));
  if (!full.startsWith(DIST + sep)) {
    void notFound();
    return;
  }
  send(200, full).catch(notFound);
});

await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

let violations = 0;
try {
  const files = await listHtmlFiles(DIST);
  if (files.length === 0) throw new Error('No built pages in dist/');

  for (const scheme of SCHEMES) {
    const browser = await choice.launch(browserPath, scheme);
    try {
      for (const file of files) {
        const page = await browser.newPage();
        if (choice.perPageScheme) {
          await page.emulateMediaFeatures([
            { name: 'prefers-color-scheme', value: scheme },
            { name: 'prefers-reduced-motion', value: 'reduce' },
          ]);
        }
        await page.goto(base + urlPathFor(file), { waitUntil: 'load' });
        await page.addScriptTag({ content: axe.source });
        const result = await page.evaluate(
          (tags) =>
            (window as unknown as { axe: typeof axe }).axe.run(document, {
              runOnly: { type: 'tag', values: tags },
            }),
          TAGS
        );
        await page.close();

        for (const v of result.violations) {
          violations += 1;
          console.error(`✗ ${urlPathFor(file)} [${scheme}] ${v.id}: ${v.help}`);
          for (const node of v.nodes) {
            console.error(`    ${node.target.join(' ')}`);
          }
        }
      }
    } finally {
      await browser.close();
    }
  }

  console.log(
    `a11y (${name}): ${files.length} page(s) × ${SCHEMES.length} colour schemes, ${violations} violation(s)`
  );
} finally {
  server.close();
}

if (violations > 0) process.exitCode = 1;
