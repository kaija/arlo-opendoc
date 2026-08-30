/**
 * Feature: git-file-status-diff-viewer
 *
 * Property 10: UnifiedDiffView renders diff content as preformatted, monospace
 * text (spec requirement 7.3) and shows a placeholder for an empty diff (7.4).
 *
 * UnifiedDiffView was redesigned from a single <pre> block into a side-by-side
 * grid of monospace cells: it drops the `diff --git` / `index` / `---` / `+++`
 * header lines, strips the leading +/-/space marker from each body line, pairs
 * removed and added lines, and trims trailing blank rows. These tests therefore
 * assert the rendered styling (monospace font, white-space:pre) and the visible
 * body text, not a literal <pre> element or a verbatim copy of the input.
 *
 * Validates: Requirements 7.3, 7.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { UnifiedDiffView } from '../UnifiedDiffView.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function render(diff: string | null): string {
  return renderToStaticMarkup(<UnifiedDiffView diff={diff} />);
}

/** The monospace stack every diff cell renders with. */
const MONO = 'font-family:var(--font-mono)';
/** The whitespace-preserving declaration every diff cell renders with. */
const PREFORMATTED = 'white-space:pre';
/** Placeholder shown for a null / empty diff (spec 7.4). */
const PLACEHOLDER = 'No changes to display';

/**
 * Escape a string the same way React's renderToStaticMarkup escapes text
 * node content: &, <, >, ", and ' are replaced with their HTML entities.
 * This lets us look for raw diff text in the rendered HTML.
 */
function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Any non-empty string — the component always renders the diff grid for these. */
const nonEmptyDiffString: fc.Arbitrary<string> = fc.string({ minLength: 1 });

/**
 * A diff guaranteed to contain at least one substantive body line, so the
 * side-by-side grid always renders at least one monospace cell.
 */
const diffWithBodyArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom('+', '-', ' '),
    fc.stringMatching(/^[^\n]{0,59}$/).map((s) => `x${s}`),
    fc.array(fc.stringMatching(/^[+\- @]?[^\n]{0,40}$/), { maxLength: 10 }),
  )
  .map(([marker, body, rest]) => [`${marker}${body}`, ...rest].join('\n'));

// ---------------------------------------------------------------------------
// Property 10: preformatted monospace diff rendering
// Validates: Requirements 7.3, 7.4
// ---------------------------------------------------------------------------

describe('UnifiedDiffView – Property 10: monospace preformatted diff rendering', () => {
  it('renders diff bodies as monospace, whitespace-preserving text', () => {
    fc.assert(
      fc.property(diffWithBodyArb, (diff) => {
        const html = render(diff);
        expect(html, `monospace font missing for diff=${JSON.stringify(diff)}`).toContain(MONO);
        expect(html, `white-space:pre missing for diff=${JSON.stringify(diff)}`).toContain(
          PREFORMATTED,
        );
      }),
      { numRuns: 500 },
    );
  });

  it('never shows the placeholder for a non-empty diff', () => {
    fc.assert(
      fc.property(nonEmptyDiffString, (diff) => {
        const html = render(diff);
        expect(
          html,
          `placeholder shown for non-empty diff=${JSON.stringify(diff)}`,
        ).not.toContain(PLACEHOLDER);
      }),
      { numRuns: 500 },
    );
  });

  it('shows every body line of a synthesised added-line diff', () => {
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/^[A-Za-z0-9 ()_.;:=+-]{0,39}$/).map((s) => `a${s}`), {
          minLength: 1,
          maxLength: 15,
        }),
        (bodies) => {
          const diff = ['@@ -1 +1 @@', ...bodies.map((b) => `+${b}`)].join('\n');
          const html = render(diff);
          for (const body of bodies) {
            expect(html, `missing body ${JSON.stringify(body)}`).toContain(htmlEscape(body));
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  // -------------------------------------------------------------------------
  // Placeholder rendering: null or "" → "No changes to display" (spec 7.4)
  // -------------------------------------------------------------------------

  it('renders the placeholder and no monospace grid when diff is null', () => {
    const html = render(null);
    expect(html).toContain(PLACEHOLDER);
    expect(html).not.toContain(MONO);
  });

  it('renders the placeholder when diff is an empty string', () => {
    const html = render('');
    expect(html).toContain(PLACEHOLDER);
    expect(html).not.toContain(MONO);
  });

  // -------------------------------------------------------------------------
  // Spot checks — concrete inputs against the side-by-side parser
  // -------------------------------------------------------------------------

  it('strips header lines, drops +/- markers, and keeps the hunk header', () => {
    const diff = [
      'diff --git a/file.ts b/file.ts',
      'index abc..def 100644',
      '--- a/file.ts',
      '+++ b/file.ts',
      '@@ -1,3 +1,4 @@',
      ' const x = 1;',
      '-const y = 2;',
      '+const y = 3;',
      '+const z = 4;',
    ].join('\n');

    const html = render(diff);

    expect(html).toContain(MONO);
    expect(html).toContain(PREFORMATTED);
    // header lines are not rendered as diff content
    expect(html).not.toContain(htmlEscape('diff --git a/file.ts b/file.ts'));
    expect(html).not.toContain(htmlEscape('--- a/file.ts'));
    expect(html).not.toContain(htmlEscape('+++ b/file.ts'));
    // hunk header is kept verbatim
    expect(html).toContain(htmlEscape('@@ -1,3 +1,4 @@'));
    // body lines appear with their leading +/- marker removed
    expect(html).toContain(htmlEscape('const x = 1;'));
    expect(html).toContain(htmlEscape('const y = 2;'));
    expect(html).toContain(htmlEscape('const y = 3;'));
    expect(html).toContain(htmlEscape('const z = 4;'));
  });

  it('renders a single-character diff without losing content', () => {
    const html = render('x');
    expect(html).toContain(MONO);
    expect(html).toContain('>x<');
  });

  it('preserves interior whitespace inside a diff line', () => {
    const html = render('@@ hunk @@\n+  indented  body');
    expect(html).toContain(PREFORMATTED);
    expect(html).toContain(htmlEscape('  indented  body'));
  });
});
