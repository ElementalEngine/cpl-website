import assert from 'node:assert/strict';
import { test } from 'node:test';
import { plainText, searchRules, sectionsOf, type Heading } from '../src/lib/rules-search';

const body = `Every exploit counts as cheating under the [general rules](/rules/general/).

## Civ 6: banned exploits

### Unit stacking

Units of the **same type** may not be stacked.

- Ships on land must move into water.

#### A deeper note

Still part of unit stacking.

\`\`\`
## not a heading
\`\`\`

### Spy trading

Trading spies during a game is banned.
`;

const headings: Heading[] = [
  { depth: 2, slug: 'civ-6-banned-exploits', text: 'Civ 6: banned exploits' },
  { depth: 3, slug: 'unit-stacking', text: 'Unit stacking' },
  { depth: 4, slug: 'a-deeper-note', text: 'A deeper note' },
  { depth: 3, slug: 'spy-trading', text: 'Spy trading' },
];

const sections = sectionsOf({ path: '/rules/exploits/', set: 'Exploits', title: 'Exploits', body }, headings);

test('a rules page splits into one section per ## or ### heading, with the page’s own ids', () => {
  assert.deepEqual(
    sections.map((s) => [s.id, s.heading]),
    [
      ['', 'Exploits'],
      ['civ-6-banned-exploits', 'Civ 6: banned exploits'],
      ['unit-stacking', 'Unit stacking'],
      ['spy-trading', 'Spy trading'],
    ]
  );
  assert.equal(sections[0].text, 'Every exploit counts as cheating under the general rules.');
  assert.match(sections[2].text, /same type may not be stacked\. Ships on land/);
  assert.match(sections[2].text, /A deeper note Still part of unit stacking/, '#### stays in its section');
  assert.match(sections[2].text, /## not a heading/, 'code blocks are not headings');
});

test('markdown becomes plain words', () => {
  assert.equal(plainText('> **Note:** see [PL rules](/rules/pl/) and `code`.\n1. one\n- two'), 'Note: see PL rules and code. one two');
  assert.equal(plainText('<button data-x>Use</button> it'), 'Use it');
});

test('search: every word must match; heading matches first; any case', () => {
  assert.deepEqual(
    searchRules(sections, 'STACKING').map((r) => r.section.id),
    ['unit-stacking']
  );
  assert.deepEqual(searchRules(sections, 'spies banned').map((r) => r.section.id), ['spy-trading']);
  assert.deepEqual(searchRules(sections, 'banned').map((r) => r.section.id)[0], 'civ-6-banned-exploits');
  assert.deepEqual(searchRules(sections, 'nothing here'), []);
  assert.deepEqual(searchRules(sections, 'a'), [], 'one letter is too short');
});

test('search: the snippet shows the text around the first word', () => {
  const long = [{ page: '/rules/cloud/', set: 'Cloud', id: 'quitting', heading: 'Quitting', text: `${'x '.repeat(100)}quit tier drops after 1 year ${'y '.repeat(100)}` }];
  const [result] = searchRules(long, 'tier');
  assert.match(result.snippet, /^….*quit tier drops after 1 year.*…$/);
  assert.ok(result.snippet.length <= 142);
});
