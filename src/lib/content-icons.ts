import type { ImageMetadata } from 'astro';

// Images in src/content/icons/, by file name without the extension.
const keyOf = (path: string) => path.replace(/^.*\//, '').replace(/\.[^.]+$/, '');
const rasters = import.meta.glob<ImageMetadata>('../content/icons/*.{png,jpg,jpeg,webp,gif}', {
  eager: true,
  import: 'default',
});
const svgs = import.meta.glob<string>('../content/icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});
const rasterByKey = new Map(Object.entries(rasters).map(([path, image]) => [keyOf(path), image]));
const svgByKey = new Map(Object.entries(svgs).map(([path, src]) => [keyOf(path), src]));

/** The image saved as `src/content/icons/<key>.*`: a raster for Astro to resize, or an SVG file URL. */
export function contentIcon(key: string | undefined): { raster?: ImageMetadata; svg?: string } {
  if (!key) return {};
  return { raster: rasterByKey.get(key), svg: svgByKey.get(key) };
}
