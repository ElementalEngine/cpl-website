import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://cpl.elementalengine.net',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // External stylesheets only, so the CSP needs no 'unsafe-inline'.
    inlineStylesheets: 'never',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
