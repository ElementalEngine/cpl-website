/** One searchable part of a rules page: the text under one heading. */
export interface RuleSection {
  /** Rules page path, e.g. "/rules/exploits/". */
  page: string;
  /** Tab label, e.g. "Exploits". */
  set: string;
  /** Heading id on the page; empty for the text above the first heading. */
  id: string;
  heading: string;
  text: string;
}

export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

/** Markdown to plain words: no links, emphasis, list markers or HTML. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/<[^>]+>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits a rules page into one section per `##` or `###` heading (deeper headings stay
 * in their section). `headings` are the page's rendered headings, in order, so each
 * section links to the same id the page uses.
 */
export function sectionsOf(
  page: { path: string; set: string; title: string; body: string },
  headings: readonly Heading[]
): RuleSection[] {
  const sections: RuleSection[] = [];
  let current: RuleSection = { page: page.path, set: page.set, id: '', heading: page.title, text: '' };
  const lines: string[] = [];
  const flush = () => {
    current.text = plainText(lines.join('\n'));
    if (current.text || current.id) sections.push(current);
    lines.length = 0;
  };
  let next = 0;
  let fenced = false;
  for (const line of page.body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const match = fenced ? null : /^(#{1,6})\s+\S/.exec(line);
    if (!match) {
      lines.push(line);
      continue;
    }
    const heading = headings[next++];
    if (!heading || heading.depth > 3) {
      lines.push(heading?.text ?? line);
      continue;
    }
    flush();
    current = { page: page.path, set: page.set, id: heading.slug, heading: heading.text, text: '' };
  }
  flush();
  return sections;
}

export interface SearchResult {
  section: RuleSection;
  /** A short piece of the text around the first match. */
  snippet: string;
}

const SNIPPET = 140;

function snippetOf(text: string, word: string): string {
  const at = text.toLowerCase().indexOf(word);
  if (at < 0) return text.length > SNIPPET ? `${text.slice(0, SNIPPET).trimEnd()}…` : text;
  const start = Math.max(0, at - Math.floor(SNIPPET / 3));
  const end = Math.min(text.length, start + SNIPPET);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

/**
 * Sections that contain every word of the query (case does not matter). Matches in a
 * heading come first, then the rest, in page order.
 */
export function searchRules(sections: readonly RuleSection[], query: string, limit = 20): SearchResult[] {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 0);
  if (words.join('').length < 2) return [];
  const scored = sections.flatMap((section, order) => {
    const heading = section.heading.toLowerCase();
    const all = `${heading} ${section.text.toLowerCase()}`;
    if (!words.every((word) => all.includes(word))) return [];
    const inHeading = words.every((word) => heading.includes(word));
    return [{ section, order, rank: inHeading ? 0 : 1 }];
  });
  scored.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return scored.slice(0, limit).map(({ section }) => ({
    section,
    snippet: snippetOf(section.text, words[0]),
  }));
}
