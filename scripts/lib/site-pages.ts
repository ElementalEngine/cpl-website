import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

/** Every built HTML file under `dir`, relative to it, with `/` separators. */
export async function listHtmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) =>
      relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/')
    )
    .sort();
}

/** The URL a visitor uses for a built file: `about/index.html` → `/about/`. */
export function urlPathFor(file: string): string {
  if (file === 'index.html') return '/';
  if (file.endsWith('/index.html')) {
    return `/${file.slice(0, -'index.html'.length)}`;
  }
  return `/${file}`;
}

/** The built file for a request path (`/about/` → `about/index.html`). */
export function fileFor(urlPath: string): string {
  const path = urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath;
  return path.replace(/^\/+/, '');
}
