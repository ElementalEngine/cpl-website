// Searches every rules page as you type. The index is fetched once, on first use.
import { searchRules, type RuleSection } from '../lib/rules-search';

const form = document.querySelector<HTMLFormElement>('[data-rules-search]');
const input = form?.querySelector<HTMLInputElement>('[data-rules-search-input]');
const status = form?.querySelector<HTMLElement>('[data-rules-search-status]');
const list = form?.querySelector<HTMLElement>('[data-rules-search-results]');

const LIMIT = 20;

let index: Promise<RuleSection[]> | undefined;

/** The search index. A failed download isn't kept, so the next search tries again. */
function load(): Promise<RuleSection[]> {
  index ??= fetch('/data/rules-search.json')
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data: unknown) => {
      if (!Array.isArray(data)) throw new Error('unexpected index');
      return data as RuleSection[];
    })
    .catch(() => {
      index = undefined;
      return [];
    });
  return index;
}

function show(query: string, sections: RuleSection[]) {
  if (!status || !list) return;
  list.replaceChildren();
  if (query.length < 2) {
    status.textContent = '';
    return;
  }
  if (sections.length === 0) {
    status.textContent = 'Search is not available right now.';
    return;
  }
  // One more than shown, to tell when there are more.
  const results = searchRules(sections, query, LIMIT + 1);
  const shown = results.slice(0, LIMIT);
  status.textContent =
    results.length === 0
      ? `No rules match "${query}".`
      : results.length > LIMIT
        ? `More than ${LIMIT} results for "${query}". Showing the first ${LIMIT}: add a word to narrow it down.`
        : `${results.length} result${results.length === 1 ? '' : 's'} for "${query}".`;
  for (const { section, snippet } of shown) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = section.id ? `${section.page}#${section.id}` : section.page;
    link.className = 'link inline-flex min-h-11 items-center font-semibold';
    link.textContent = section.id ? `${section.set}: ${section.heading}` : section.set;
    const text = document.createElement('p');
    text.className = 'text-sm text-text-2';
    text.textContent = snippet;
    item.append(link, text);
    list.append(item);
  }
}

if (form && input) {
  let latest = 0;
  input.addEventListener('focus', () => void load(), { once: true });
  input.addEventListener('input', async () => {
    const query = input.value.trim();
    const run = ++latest;
    const sections = query.length < 2 ? [] : await load();
    if (run === latest) show(query, sections);
  });
  form.addEventListener('submit', (event) => event.preventDefault());
}
