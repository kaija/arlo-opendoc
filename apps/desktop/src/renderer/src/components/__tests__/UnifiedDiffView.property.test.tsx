/**
 * Feature: git-file-status-diff-viewer
 *
 * Property 10: UnifiedDiffView renders diff content with monospace preformatted styling
 *
 * For any non-empty unified diff string, `UnifiedDiffView` must render its
 * content inside a `<pre>` element with a monospace `fontFamily`, preserving
 * whitespace and newlines.
 *
 * Validates: Requirements 7.3
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

/** Extract the full style attribute value from the <pre> element, or null. */
function extractPreStyle(html: string): string | null {
  const match = html.match(/<pre[^>]+style="([^"]+)"/);
  return match?.[1] ?? null;
}

/** Return true when a <pre> element is present in the rendered output. */
function hasPreElement(html: string): boolean {
  return /<pre[\s>]/.test(html);
}

/** Return the text content inside the <pre> element, or null. */
function extractPreContent(html: string): string | null {
  const match = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
  return match?.[1] ?? null;
}

/**
 * Escape a string the same way React's renderToStaticMarkup escapes text
 * node content: &, <, >, ", and ' are replaced with their HTML entities.
 * This lets us compare raw diff strings against the HTML output.
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

/**
 * Arbitrary for non-empty diff strings.
 * Includes strings with newlines, spaces, leading +/- chars (common in unified
 * diffs) and other characters, reflecting real-world git diff output.
 */
const nonEmptyDiffString: fc.Arbitrary<string> = fc
  .string({ minLength: 1 })
  // Ensure the string is genuinely non-empty after trimming whitespace is NOT
  // required — we just need at least 1 character (could be whitespace).
  .filter((s) => s.length > 0);

/**
 * A more realistic diff string, containing lines that look like unified diff
 * output, to confirm whitespace is preserved verbatim.
 */
const realisticDiffArb: fc.Arbitrary<string> = fc.array(
  fc.oneof(
    fc.stringMatching(/^\+[^\n]{0,40}$/),
    fc.stringMatching(/^-[^\n]{0,40}$/),
    fc.stringMatching(/^ [^\n]{0,40}$/),
    fc.stringMatching(/^@@[^\n]{0,40}$/),
  ),
  { minLength: 1, maxLength: 20 },
).map((lines) => lines.join('\n'));

// ---------------------------------------------------------------------------
// Property 10: diff content rendered in <pre> with monospace styling
// Validates: Requirements 7.3
// ---------------------------------------------------------------------------

describe('UnifiedDiffView – Property 10: monospace preformatted diff rendering', () => {
  /**
   * Core property: for any non-empty diff string the component must render
   * a <pre> element that:
   *  - contains the diff string verbatim as its text content
   *  - has font-family:var(--font-mono) in its style attribute
   *  - has white-space:pre in its style attribute
   *
   * Validates: Requirements 7.3
   */
  it('renders any non-empty diff inside a <pre> with monospace font-family and white-space:pre', () => {
    fc.assert(
      fc.property(nonEmptyDiffString, (diff) => {
        const html = render(diff);

        // A <pre> element must be present
        expect(
          hasPreElement(html),
          `Expected a <pre> element for diff=${JSON.stringify(diff)}`,
        ).toBe(true);

        // The <pre> content must include the diff string.
        // renderToStaticMarkup HTML-escapes text node content, so we compare
        // against the escaped form of the raw diff string.
        const preContent = extractPreContent(html);
        expect(
          preContent,
          `<pre> content missing for diff=${JSON.stringify(diff)}`,
        ).not.toBeNull();
        expect(
          preContent,
          `<pre> content does not include diff for diff=${JSON.stringify(diff)}`,
        ).toContain(htmlEscape(diff));

        // The <pre> style must declare a monospace font-family
        const style = extractPreStyle(html);
        expect(
          style,
          `<pre> style missing for diff=${JSON.stringify(diff)}`,
        ).not.toBeNull();
        expect(
          style,
          `font-family:var(--font-mono) not found in style for diff=${JSON.stringify(diff)}`,
        ).toContain('font-family:var(--font-mono)');

        // The <pre> style must declare white-space:pre to preserve formatting
        expect(
          style,
          `white-space:pre not found in style for diff=${JSON.stringify(diff)}`,
        ).toContain('white-space:pre');
      }),
      { numRuns: 500 },
    );
  });

  /**
   * Realistic diff strings (with +/-/space/@@-prefixed lines and newlines)
   * must also pass the same structural requirements.
   *
   * Validates: Requirements 7.3
   */
  it('renders realistic unified-diff-shaped strings inside a styled <pre>', () => {
    fc.assert(
      fc.property(realisticDiffArb, (diff) => {
        const html = render(diff);

        expect(hasPreElement(html)).toBe(true);

        const style = extractPreStyle(html);
        expect(style).toContain('font-family:var(--font-mono)');
        expect(style).toContain('white-space:pre');

        const preContent = extractPreContent(html);
        expect(preContent).not.toBeNull();
        // All individual lines must appear in the pre content (HTML-escaped)
        for (const line of diff.split('\n')) {
          expect(preContent).toContain(htmlEscape(line));
        }
      }),
      { numRuns: 300 },
    );
  });

  // ---------------------------------------------------------------------------
  // Placeholder rendering: null or "" → "No changes to display"
  // ---------------------------------------------------------------------------

  /**
   * When diff is null or "", the component must render the placeholder text
   * "No changes to display" and must NOT render a <pre> element.
   */
  it('renders "No changes to display" placeholder when diff is null', () => {
    const html = render(null);
    expect(html).toContain('No changes to display');
    expect(hasPreElement(html)).toBe(false);
  });

  it('renders "No changes to display" placeholder when diff is an empty string', () => {
    const html = render('');
    expect(html).toContain('No changes to display');
    expect(hasPreElement(html)).toBe(false);
  });

  /**
   * Non-empty diffs must NEVER show the placeholder.
   *
   * Validates: Requirements 7.4 (inverse: content is shown, not placeholder)
   */
  it('never renders the placeholder when diff is non-empty', () => {
    fc.assert(
      fc.property(nonEmptyDiffString, (diff) => {
        const html = render(diff);
        expect(
          html,
          `Placeholder should NOT appear for non-empty diff=${JSON.stringify(diff)}`,
        ).not.toContain('No changes to display');
      }),
      { numRuns: 300 },
    );
  });

  // ---------------------------------------------------------------------------
  // Spot checks — concrete examples
  // ---------------------------------------------------------------------------

  it('renders a typical git diff hunk with correct structure', () => {
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

    expect(hasPreElement(html)).toBe(true);
    expect(extractPreStyle(html)).toContain('font-family:var(--font-mono)');
    expect(extractPreStyle(html)).toContain('white-space:pre');
    expect(extractPreContent(html)).toContain(htmlEscape('const y = 3;'));
    expect(extractPreContent(html)).toContain(htmlEscape('-const y = 2;'));
  });

  it('renders a single-character diff without losing content', () => {
    const html = render('x');
    expect(hasPreElement(html)).toBe(true);
    expect(extractPreContent(html)).toBe('x');
  });

  it('preserves leading/trailing whitespace inside the <pre>', () => {
    const diff = '  +  leading spaces\n\n  trailing newline  ';
    const html = render(diff);
    expect(hasPreElement(html)).toBe(true);
    expect(extractPreContent(html)).toContain(htmlEscape('  +  leading spaces'));
  });
});
