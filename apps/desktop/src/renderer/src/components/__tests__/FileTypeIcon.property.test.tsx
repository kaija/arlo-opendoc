import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FileTypeIcon } from '../FileTypeIcon.js';

/**
 * Feature: folder-browser
 *
 * Helper: render FileTypeIcon to an HTML string and extract the `data-icon` attribute value.
 * Returns `null` if the attribute is absent or the element is empty.
 */
function renderDataIcon(fileName: string): string | null {
  const html = renderToStaticMarkup(<FileTypeIcon fileName={fileName} />);
  const match = html.match(/data-icon="([^"]+)"/);
  return match?.[1] ?? null;
}

/**
 * All known extension → icon-group mappings, as declared in REQ-005.
 */
const KNOWN_EXTENSIONS: Record<string, string> = {
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.json': 'json',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.svg': 'image',
  '.webp': 'image',
  '.sh': 'shell',
  '.bash': 'shell',
  '.txt': 'text',
};

const KNOWN_EXTENSION_STRINGS = Object.keys(KNOWN_EXTENSIONS);

// ---------------------------------------------------------------------------
// Property 8: FileTypeIcon totality
// Validates: Requirements REQ-005.1, REQ-005.2, REQ-005.3
// ---------------------------------------------------------------------------

describe('FileTypeIcon – Property 8: Totality', () => {
  /**
   * For any `fileName` string, `FileTypeIcon` renders an SVG element with a
   * non-empty `data-icon` attribute; never returns null, undefined, or an
   * element without `data-icon`.
   *
   * Validates: Requirements REQ-005.1, REQ-005.2, REQ-005.3
   */
  it('always renders a non-empty data-icon attribute for any fileName', () => {
    fc.assert(
      fc.property(fc.string(), (fileName) => {
        const html = renderToStaticMarkup(<FileTypeIcon fileName={fileName} />);

        // Must produce non-empty output
        expect(html.length, `Empty render for fileName=${JSON.stringify(fileName)}`).toBeGreaterThan(0);

        // Must contain an SVG element
        expect(html, `No <svg> for fileName=${JSON.stringify(fileName)}`).toContain('<svg');

        // Must have a data-icon attribute
        const dataIcon = renderDataIcon(fileName);
        expect(
          dataIcon,
          `Missing or empty data-icon for fileName=${JSON.stringify(fileName)}`,
        ).toBeTruthy();

        // The data-icon value must be a non-empty string
        expect(
          typeof dataIcon === 'string' && dataIcon.length > 0,
          `data-icon is empty for fileName=${JSON.stringify(fileName)}`,
        ).toBe(true);
      }),
      { numRuns: 1000 },
    );
  });

  it('renders the generic icon for filenames with no extension', () => {
    const noExtNames = ['README', 'Makefile', 'Dockerfile', 'LICENSE', 'CHANGELOG'];
    for (const name of noExtNames) {
      expect(renderDataIcon(name)).toBe('generic');
    }
  });

  it('renders the generic icon for dot-only filenames (.gitignore, .env)', () => {
    const dotOnly = ['.gitignore', '.env', '.npmrc', '.eslintrc', '.a'];
    for (const name of dotOnly) {
      expect(renderDataIcon(name)).toBe('generic');
    }
  });

  it('renders the correct icon for every known extension', () => {
    for (const [ext, expectedIcon] of Object.entries(KNOWN_EXTENSIONS)) {
      // Verify with a plain filename like "file.md"
      expect(renderDataIcon(`file${ext}`)).toBe(expectedIcon);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 9: FileTypeIcon case-insensitivity
// Validates: Requirement REQ-005.2
// ---------------------------------------------------------------------------

/**
 * Randomly mutate the case of characters in a string.
 * Each character is independently toggled to upper or lower case.
 */
function randomiseCase(s: string, seed: boolean[]): string {
  return s
    .split('')
    .map((ch, i) => (seed[i % seed.length] ? ch.toUpperCase() : ch.toLowerCase()))
    .join('');
}

describe('FileTypeIcon – Property 9: Case-insensitivity', () => {
  /**
   * For any known extension, changing the case of extension characters produces
   * the same `data-icon` value.
   *
   * e.g. `.MD`, `.md`, `.Md` all produce data-icon="markdown"
   *
   * Validates: Requirement REQ-005.2
   */
  it('produces the same data-icon for any casing of a known extension', () => {
    fc.assert(
      fc.property(
        // Pick a known extension at random
        fc.constantFrom(...KNOWN_EXTENSION_STRINGS),
        // Generate an array of booleans to drive case randomisation
        fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }),
        (ext, caseSeed) => {
          const expectedIcon = KNOWN_EXTENSIONS[ext];

          // Produce a variant of the extension with randomised casing
          // Only randomise the extension part after the dot, keeping the dot intact
          const extBody = ext.slice(1); // e.g. "md" from ".md"
          const mutatedExtBody = randomiseCase(extBody, caseSeed);
          const mutatedExt = `.${mutatedExtBody}`; // e.g. ".MD", ".mD"

          const fileName = `file${mutatedExt}`;
          const dataIcon = renderDataIcon(fileName);

          expect(
            dataIcon,
            `Expected data-icon="${expectedIcon}" for "${fileName}" (from ext "${ext}"), got "${dataIcon}"`,
          ).toBe(expectedIcon);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('produces the same icon for explicit casing variants of every known extension', () => {
    const casingVariants: Array<(s: string) => string> = [
      (s) => s.toLowerCase(),
      (s) => s.toUpperCase(),
      (s) => (s[0] ?? '').toUpperCase() + s.slice(1).toLowerCase(),
    ];

    for (const [ext, expectedIcon] of Object.entries(KNOWN_EXTENSIONS)) {
      const extBody = ext.slice(1);
      for (const variant of casingVariants) {
        const fileName = `file.${variant(extBody)}`;
        expect(
          renderDataIcon(fileName),
          `data-icon mismatch for "${fileName}" — expected "${expectedIcon}"`,
        ).toBe(expectedIcon);
      }
    }
  });
});
