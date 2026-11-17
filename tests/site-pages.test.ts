import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileFor, listHtmlFiles, urlPathFor } from '../scripts/lib/site-pages';

test('urlPathFor maps built files to trailing-slash URLs', () => {
  assert.equal(urlPathFor('index.html'), '/');
  assert.equal(urlPathFor('about/index.html'), '/about/');
  assert.equal(urlPathFor('civ6/ladder/ffa/2/index.html'), '/civ6/ladder/ffa/2/');
  assert.equal(urlPathFor('404.html'), '/404.html');
});

test('fileFor maps request paths back to built files', () => {
  assert.equal(fileFor('/'), 'index.html');
  assert.equal(fileFor('/about/'), 'about/index.html');
  assert.equal(fileFor('/_astro/site.css'), '_astro/site.css');
});

test('listHtmlFiles finds nested pages and skips other files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dist-'));
  await mkdir(join(dir, 'about'));
  await writeFile(join(dir, 'index.html'), '');
  await writeFile(join(dir, '404.html'), '');
  await writeFile(join(dir, 'about', 'index.html'), '');
  await writeFile(join(dir, 'robots.txt'), '');

  assert.deepEqual(await listHtmlFiles(dir), [
    '404.html',
    'about/index.html',
    'index.html',
  ]);
});
