import { createHash } from 'node:crypto';

/** CSP sources for the inline scripts and styles found in the built pages. */
export interface InlineHashes {
  script: string[];
  style: string[];
}

const INLINE_ELEMENT = /<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi;
// Hashes can't allow these, so the build refuses them.
const INLINE_ATTRIBUTE = /<[a-z][^>]*?\s(on[a-z]+|style)\s*=/i;

/** The CSP source for one inline script or style, hashed as browsers do. */
export function cspHash(content: string): string {
  // The HTML parser turns CRLF and CR into LF before the browser hashes.
  const text = content.replace(/\r\n?/g, '\n');
  const digest = createHash('sha256').update(text, 'utf8').digest('base64');
  return `'sha256-${digest}'`;
}

/** Hashes every inline script and style. Throws on inline event handlers or style attributes. */
export function collectInlineHashes(pages: Iterable<string>): InlineHashes {
  const script = new Set<string>();
  const style = new Set<string>();
  for (const html of pages) {
    const tagsOnly = html.replace(
      INLINE_ELEMENT,
      (_, tag: string, attrs: string) => `<${tag}${attrs}></${tag}>`
    );
    const attribute = INLINE_ATTRIBUTE.exec(tagsOnly);
    if (attribute) {
      throw new Error(
        `Inline "${attribute[1]}" attribute found; the CSP blocks it. Use a class or a script file instead.`
      );
    }
    for (const [, tag, attrs, content] of html.matchAll(INLINE_ELEMENT)) {
      if (tag.toLowerCase() === 'style') {
        style.add(cspHash(content));
      } else if (!/\ssrc\s*=/i.test(` ${attrs}`)) {
        script.add(cspHash(content));
      }
    }
  }
  return { script: [...script].sort(), style: [...style].sort() };
}

/** Adds the hashes to `script-src` and `style-src` of a CSP value. */
function addHashesToPolicy(policy: string, hashes: InlineHashes): string {
  const extra = new Map([
    ['script-src', hashes.script],
    ['style-src', hashes.style],
  ]);
  const directives = policy
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(/\s+/));

  for (const name of extra.keys()) {
    if (!directives.some(([directive]) => directive === name)) {
      throw new Error(`CSP has no ${name} directive`);
    }
  }
  return directives
    .map(([name, ...sources]) => {
      if (sources.includes("'unsafe-inline'")) {
        throw new Error(`CSP ${name} must not allow 'unsafe-inline'`);
      }
      return [name, ...sources, ...(extra.get(name) ?? [])].join(' ');
    })
    .join('; ');
}

/** Rewrites the single Content-Security-Policy line of a Cloudflare `_headers` file. */
export function addHashesToHeaders(headers: string, hashes: InlineHashes): string {
  let found = 0;
  const result = headers.replace(
    /^([ \t]+Content-Security-Policy:[ \t]*)(.+)$/gim,
    (_, lead: string, policy: string) => {
      found += 1;
      return lead + addHashesToPolicy(policy, hashes);
    }
  );
  if (found !== 1) {
    throw new Error(`Expected one Content-Security-Policy line in _headers, found ${found}`);
  }
  return result;
}
