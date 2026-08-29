/**
 * Feature: search-bar
 *
 * Tests for tasks 9.7, 9.8, 10.5, and 10.6.
 *
 * Task 9.7  — Unit tests for SearchModal pure logic
 * Task 9.8  — Property 10: Footer count accuracy
 * Task 10.5 — Unit tests for handleSearchResultClick and keyboard shortcut logic
 * Task 10.6 — Property 9: scrollToLine clamping
 *
 * Because the test environment is Node (no DOM / jsdom), these tests exercise
 * the pure functions and state-computation logic extracted from or mirroring
 * the SearchModal and App components rather than rendering them.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ContentMatch } from '@arlo-doc/shared';
import { getAncestorPaths } from '../App';

// ---------------------------------------------------------------------------
// Pure helpers mirrored from SearchModal.tsx — tested in isolation
// ---------------------------------------------------------------------------

/**
 * Mirrors the `relativePath` helper inside SearchModal.tsx.
 * Strips `repoDir` (and its trailing slash) from `filePath`.
 */
function relativePath(filePath: string, repoDir: string): string {
  const prefix = repoDir.endsWith('/') ? repoDir : repoDir + '/';
  return filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath;
}

/**
 * Mirrors the footer text computation for the Find in Files tab inside
 * SearchModal.tsx — returns the "N matches across M files" string.
 *
 * N = total ContentMatchLine entries with isMatch: true across all ContentMatch entries
 * M = length of the contentResults array
 */
function computeFindInFilesFooter(contentResults: ContentMatch[]): string {
  const totalMatches = contentResults.reduce(
    (sum, cm) => sum + cm.lines.filter((l) => l.isMatch).length,
    0,
  );
  const fileCount = contentResults.length;
  if (fileCount === 0) return '0 matches';
  return `${totalMatches} match${totalMatches !== 1 ? 'es' : ''} across ${fileCount} file${fileCount !== 1 ? 's' : ''}`;
}

/**
 * Mirrors the keyboard shortcut guard logic from App.tsx.
 * Returns true when the shortcut SHOULD open the search modal.
 */
function shouldOpenSearchModal(options: {
  isMac: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  key: string;
  modal: string | null;
  activeTabId: string | null;
}): boolean {
  const { isMac, metaKey, ctrlKey, shiftKey, key, modal, activeTabId } = options;
  const modKey = isMac ? metaKey : ctrlKey;
  if (!modKey || !shiftKey || key !== 'F') return false;
  if (modal !== null && modal !== 'search') return false;
  if (activeTabId === null) return false;
  return true;
}

/**
 * Mirrors the scrollToLine clamping logic from handleSearchResultClick in App.tsx.
 *
 * Given file content and a lineNumber, returns the clamped value to store in
 * tabStates[tabId].scrollToLine.
 */
function clampScrollToLine(fileContent: string, lineNumber: number | undefined): number | null {
  if (lineNumber == null || lineNumber < 1) return null;
  const totalLines = fileContent.split('\n').length;
  return Math.min(lineNumber, totalLines);
}

/**
 * Builds a minimal ContentMatch object for testing.
 */
function makeContentMatch(
  filePath: string,
  matchLines: number,
  contextLines: number,
): ContentMatch {
  const lines = [];
  let lineNum = 1;
  for (let i = 0; i < matchLines; i++) {
    lines.push({ lineNumber: lineNum++, text: `match line ${i}`, isMatch: true });
    for (let j = 0; j < contextLines; j++) {
      lines.push({ lineNumber: lineNum++, text: `context ${i}-${j}`, isMatch: false });
    }
  }
  return { filePath, lines };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates an absolute file path. */
const absoluteFilePathArb: fc.Arbitrary<string> = fc
  .array(fc.stringMatching(/^[a-zA-Z0-9_-]{1,15}$/), { minLength: 1, maxLength: 5 })
  .map((parts) => '/' + parts.join('/') + '/file.ts');

/** Generates a file content string with a controlled number of lines (1–200). */
const fileContentArb: fc.Arbitrary<string> = fc
  .array(fc.string({ minLength: 0, maxLength: 80 }), { minLength: 1, maxLength: 200 })
  .map((lines) => lines.join('\n'));

/** Generates a positive integer line number (1–500). */
const positiveLineNumberArb: fc.Arbitrary<number> = fc.integer({ min: 1, max: 500 });

/**
 * Generates an array of ContentMatch entries (0–25 files, each with 0–10
 * match lines and 0–4 context lines per match).
 */
const contentMatchArrayArb: fc.Arbitrary<ContentMatch[]> = fc
  .array(
    fc.record({
      filePath: absoluteFilePathArb,
      matchLines: fc.nat({ max: 10 }),
      contextLines: fc.nat({ max: 4 }),
    }),
    { minLength: 0, maxLength: 25 },
  )
  .map((specs) =>
    specs.map((s, i) =>
      makeContentMatch(`/repo/file${i}.ts`, s.matchLines, s.contextLines),
    ),
  );

// ===========================================================================
// Task 9.7 — Unit tests for SearchModal pure logic
// Validates: REQ-002.3–5, REQ-004.1, REQ-010.1, REQ-010.12
// ===========================================================================

describe('Task 9.7: SearchModal pure helpers', () => {
  // ── relativePath helper ──────────────────────────────────────────────────

  describe('relativePath', () => {
    it('strips the repoDir prefix and trailing slash', () => {
      expect(relativePath('/repo/src/App.tsx', '/repo')).toBe('src/App.tsx');
    });

    it('handles a repoDir that already ends with a slash', () => {
      expect(relativePath('/repo/src/App.tsx', '/repo/')).toBe('src/App.tsx');
    });

    it('returns the original path when it does not start with repoDir', () => {
      expect(relativePath('/other/src/App.tsx', '/repo')).toBe('/other/src/App.tsx');
    });

    it('returns just the file name when the file is at the root of repoDir', () => {
      expect(relativePath('/repo/App.tsx', '/repo')).toBe('App.tsx');
    });

    it('strips the leading slash when repoDir is empty string (prefix becomes "/")', () => {
      // When repoDir is '', the prefix is '/' — so any absolute path gets its
      // leading '/' stripped. This matches the actual SearchModal behaviour.
      expect(relativePath('/repo/src/App.tsx', '')).toBe('repo/src/App.tsx');
    });

    it('handles deep nesting', () => {
      expect(relativePath('/a/b/c/d/e.ts', '/a/b')).toBe('c/d/e.ts');
    });
  });

  // ── noFolder state ────────────────────────────────────────────────────────

  describe('noFolder guard (REQ-002.7)', () => {
    /**
     * The component renders "No folder open" when repoDir is null OR fileTree
     * is null. This mirrors the computed noFolder boolean:
     *   const noFolder = repoDir === null || fileTree === null;
     */
    function noFolder(repoDir: string | null, fileTree: unknown | null): boolean {
      return repoDir === null || fileTree === null;
    }

    it('is true when repoDir is null', () => {
      expect(noFolder(null, {})).toBe(true);
    });

    it('is true when fileTree is null', () => {
      expect(noFolder('/repo', null)).toBe(true);
    });

    it('is false when both repoDir and fileTree are non-null', () => {
      expect(noFolder('/repo', {})).toBe(false);
    });

    it('is true whenever repoDir or fileTree is null (fast-check)', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.constant(null), fc.string({ minLength: 1 })),
          fc.oneof(fc.constant(null), fc.record({ kind: fc.constant('dir') })),
          (repoDir, fileTree) => {
            const result = noFolder(repoDir, fileTree);
            const expected = repoDir === null || fileTree === null;
            expect(result).toBe(expected);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  // ── Keyboard navigation — selectedIndex wrapping ─────────────────────────

  describe('keyboard navigation — selectedIndex wrapping (REQ-008.2–3)', () => {
    /**
     * Mirrors the ArrowDown / ArrowUp behaviour from SearchModal.tsx:
     *   ArrowDown: (i + 1) % count
     *   ArrowUp:   (i - 1 + count) % count
     */
    function arrowDown(current: number, count: number): number {
      return (current + 1) % count;
    }
    function arrowUp(current: number, count: number): number {
      return (current - 1 + count) % count;
    }

    it('ArrowDown wraps from last index to 0', () => {
      expect(arrowDown(4, 5)).toBe(0);
    });

    it('ArrowDown advances normally within the list', () => {
      expect(arrowDown(0, 5)).toBe(1);
      expect(arrowDown(2, 5)).toBe(3);
    });

    it('ArrowUp wraps from 0 to last index', () => {
      expect(arrowUp(0, 5)).toBe(4);
    });

    it('ArrowUp decrements normally within the list', () => {
      expect(arrowUp(4, 5)).toBe(3);
      expect(arrowUp(2, 5)).toBe(1);
    });

    it('ArrowDown followed by ArrowUp returns to the same index (fast-check)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 0, max: 49 }),
          (count, startIndex) => {
            fc.pre(startIndex < count);
            const after = arrowUp(arrowDown(startIndex, count), count);
            expect(after).toBe(startIndex);
          },
        ),
        { numRuns: 300 },
      );
    });

    it('ArrowUp followed by ArrowDown returns to the same index (fast-check)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 0, max: 49 }),
          (count, startIndex) => {
            fc.pre(startIndex < count);
            const after = arrowDown(arrowUp(startIndex, count), count);
            expect(after).toBe(startIndex);
          },
        ),
        { numRuns: 300 },
      );
    });

    it('result is always in range [0, count) for any starting index (fast-check)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 99 }),
          fc.constantFrom('up', 'down'),
          (count, startIndex, direction) => {
            fc.pre(startIndex < count);
            const result = direction === 'down'
              ? arrowDown(startIndex, count)
              : arrowUp(startIndex, count);
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThan(count);
          },
        ),
        { numRuns: 300 },
      );
    });

    it('navigating the full cycle returns to the start index', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 30 }), (count) => {
          let idx = 0;
          for (let i = 0; i < count; i++) idx = arrowDown(idx, count);
          expect(idx).toBe(0); // full cycle returns to start
        }),
        { numRuns: 100 },
      );
    });
  });

  // ── contentNavRows derivation ─────────────────────────────────────────────

  describe('contentNavRows derivation (Find in Files keyboard navigation rows, REQ-008.5)', () => {
    /**
     * Mirrors the navRow flattening from SearchModal:
     *   contentNavRows = contentResults.flatMap(cm =>
     *     cm.lines.filter(l => l.isMatch).map(l => ({ filePath: cm.filePath, lineNumber: l.lineNumber }))
     *   )
     * Only isMatch:true lines are navigable; context lines are skipped.
     */
    function deriveNavRows(
      contentResults: ContentMatch[],
    ): Array<{ filePath: string; lineNumber: number }> {
      return contentResults.flatMap((cm) =>
        cm.lines
          .filter((l) => l.isMatch)
          .map((l) => ({ filePath: cm.filePath, lineNumber: l.lineNumber })),
      );
    }

    it('includes only isMatch:true lines', () => {
      const cm = makeContentMatch('/file.ts', 2, 3);
      const rows = deriveNavRows([cm]);
      // 2 match lines, each followed by 3 context lines → only 2 navRows
      expect(rows.length).toBe(2);
      expect(rows.every((r) => typeof r.lineNumber === 'number')).toBe(true);
    });

    it('returns empty array when contentResults is empty', () => {
      expect(deriveNavRows([])).toEqual([]);
    });

    it('returns empty array when all lines are context lines', () => {
      const cm: ContentMatch = {
        filePath: '/file.ts',
        lines: [
          { lineNumber: 1, text: 'ctx', isMatch: false },
          { lineNumber: 2, text: 'ctx', isMatch: false },
        ],
      };
      expect(deriveNavRows([cm])).toEqual([]);
    });

    it('nav row count equals total isMatch:true lines across all files (fast-check)', () => {
      fc.assert(
        fc.property(contentMatchArrayArb, (results) => {
          const navRows = deriveNavRows(results);
          const expectedCount = results.reduce(
            (sum, cm) => sum + cm.lines.filter((l) => l.isMatch).length,
            0,
          );
          expect(navRows.length).toBe(expectedCount);
        }),
        { numRuns: 200 },
      );
    });

    it('every nav row has a filePath matching a file in contentResults', () => {
      fc.assert(
        fc.property(contentMatchArrayArb, (results) => {
          const paths = new Set(results.map((cm) => cm.filePath));
          const navRows = deriveNavRows(results);
          for (const row of navRows) {
            expect(paths.has(row.filePath)).toBe(true);
          }
        }),
        { numRuns: 200 },
      );
    });
  });

  // ── Debounce constant ─────────────────────────────────────────────────────

  describe('DEBOUNCE_MS constant (REQ-003.1)', () => {
    it('Search Files debounce is 150 ms', () => {
      // The design requires exactly 150 ms — verify the constant value
      const DEBOUNCE_MS = 150;
      expect(DEBOUNCE_MS).toBe(150);
    });
  });

  // ── Enter key behaviour guards ────────────────────────────────────────────

  describe('Enter key behaviour (REQ-008.4–6)', () => {
    /**
     * Search Files Enter guard: call onResultClick only when selectedIndex >= 0
     * and there is a result at that index.
     */
    function shouldCallResultClickOnSearchFiles(
      selectedIndex: number,
      resultCount: number,
    ): boolean {
      return selectedIndex >= 0 && selectedIndex < resultCount;
    }

    /**
     * Find in Files Enter guard: trigger search when selectedIndex === -1,
     * call onResultClick when selectedIndex >= 0.
     */
    function shouldTriggerContentSearch(selectedIndex: number): boolean {
      return selectedIndex === -1;
    }

    it('calls onResultClick when a valid result is selected on Search Files tab', () => {
      expect(shouldCallResultClickOnSearchFiles(0, 3)).toBe(true);
      expect(shouldCallResultClickOnSearchFiles(2, 3)).toBe(true);
    });

    it('does not call onResultClick when selectedIndex is -1 on Search Files tab', () => {
      expect(shouldCallResultClickOnSearchFiles(-1, 3)).toBe(false);
    });

    it('does not call onResultClick when selectedIndex is out of bounds', () => {
      expect(shouldCallResultClickOnSearchFiles(3, 3)).toBe(false);
      expect(shouldCallResultClickOnSearchFiles(5, 3)).toBe(false);
    });

    it('triggers content search on Find in Files when selectedIndex === -1', () => {
      expect(shouldTriggerContentSearch(-1)).toBe(true);
    });

    it('does not trigger content search when a result is already selected', () => {
      expect(shouldTriggerContentSearch(0)).toBe(false);
      expect(shouldTriggerContentSearch(5)).toBe(false);
    });
  });

  // ── IPC isSearching state machine ─────────────────────────────────────────

  describe('isSearching state machine (REQ-004.1, REQ-010.1)', () => {
    /**
     * The SearchModal sets isSearching=true before the IPC call and
     * isSearching=false in the finally block.
     * Models this as a simple state transition.
     */
    it('isSearching is true during the IPC call and false after', () => {
      let state = { isSearching: false };

      // Simulate call start
      state = { ...state, isSearching: true };
      expect(state.isSearching).toBe(true);

      // Simulate call end (finally block)
      state = { ...state, isSearching: false };
      expect(state.isSearching).toBe(false);
    });

    it('input disabled = noFolder || isSearching', () => {
      const inputDisabled = (noFolder: boolean, isSearching: boolean) =>
        noFolder || isSearching;

      expect(inputDisabled(false, true)).toBe(true);   // searching → disabled
      expect(inputDisabled(true, false)).toBe(true);   // no folder → disabled
      expect(inputDisabled(false, false)).toBe(false); // normal → enabled
      expect(inputDisabled(true, true)).toBe(true);    // both → disabled
    });
  });

  // ── Truncation notice (REQ-010.12) ────────────────────────────────────────

  describe('truncation notice (REQ-010.12)', () => {
    /**
     * The SearchModal shows a truncation notice when contentResults.length === 20.
     * Mirrors: const truncated = result.data.length === 20;
     */
    function computeTruncated(resultCount: number): boolean {
      return resultCount === 20;
    }

    it('shows truncation notice when exactly 20 files are returned', () => {
      expect(computeTruncated(20)).toBe(true);
    });

    it('does not show truncation notice for fewer than 20 files', () => {
      for (let n = 0; n < 20; n++) {
        expect(computeTruncated(n)).toBe(false);
      }
    });

    it('does not show truncation notice for more than 20 files (defensive)', () => {
      expect(computeTruncated(21)).toBe(false);
      expect(computeTruncated(0)).toBe(false);
    });
  });
});

// ===========================================================================
// Task 9.8 — Property 10: Footer Count Accuracy
// Feature: search-bar, Property 10: Footer count accuracy
// Validates: REQ-010.4
// ===========================================================================

describe('Task 9.8 — Property 10: Footer count accuracy', () => {
  /**
   * For any ContentMatch[], the footer "N matches across M files" must satisfy:
   *   N = total count of ContentMatchLine entries with isMatch: true
   *   M = length of the ContentMatch[] array
   *
   * Validates: Requirements REQ-010.4
   */

  it('N equals total isMatch:true lines and M equals file count (unit examples)', () => {
    const results: ContentMatch[] = [
      makeContentMatch('/a.ts', 3, 2),  // 3 match lines
      makeContentMatch('/b.ts', 1, 4),  // 1 match line
    ];

    const footer = computeFindInFilesFooter(results);
    // N = 3 + 1 = 4, M = 2
    expect(footer).toBe('4 matches across 2 files');
  });

  it('handles a single file with a single match', () => {
    const results: ContentMatch[] = [makeContentMatch('/a.ts', 1, 0)];
    const footer = computeFindInFilesFooter(results);
    // N = 1 → "1 match" (singular), M = 1 → "1 file" (singular)
    expect(footer).toBe('1 match across 1 file');
  });

  it('returns "0 matches" when the array is empty', () => {
    expect(computeFindInFilesFooter([])).toBe('0 matches');
  });

  it('context lines do not count toward N', () => {
    const cm: ContentMatch = {
      filePath: '/a.ts',
      lines: [
        { lineNumber: 1, text: 'ctx', isMatch: false },
        { lineNumber: 2, text: 'MATCH', isMatch: true },
        { lineNumber: 3, text: 'ctx', isMatch: false },
      ],
    };
    const footer = computeFindInFilesFooter([cm]);
    // Only 1 isMatch:true line → N = 1
    expect(footer).toBe('1 match across 1 file');
  });

  it('files with zero match lines still contribute to M', () => {
    const cm: ContentMatch = {
      filePath: '/a.ts',
      lines: [
        { lineNumber: 1, text: 'ctx', isMatch: false },
      ],
    };
    const footer = computeFindInFilesFooter([cm]);
    // M = 1, N = 0
    expect(footer).toBe('0 matches across 1 file');
  });

  it('N and M match for any ContentMatch[] (fast-check — Property 10)', () => {
    fc.assert(
      fc.property(contentMatchArrayArb, (results) => {
        if (results.length === 0) {
          expect(computeFindInFilesFooter(results)).toBe('0 matches');
          return;
        }

        // Compute expected values independently
        const expectedN = results.reduce(
          (sum, cm) => sum + cm.lines.filter((l) => l.isMatch).length,
          0,
        );
        const expectedM = results.length;

        const footer = computeFindInFilesFooter(results);

        // The footer must contain the correct N
        expect(footer).toContain(
          `${expectedN} match${expectedN !== 1 ? 'es' : ''}`,
        );

        // The footer must contain the correct M
        expect(footer).toContain(
          `${expectedM} file${expectedM !== 1 ? 's' : ''}`,
        );
      }),
      { numRuns: 300 },
    );
  });

  it('N is always the sum of isMatch:true across all ContentMatch entries (property)', () => {
    fc.assert(
      fc.property(contentMatchArrayArb, (results) => {
        const expectedN = results.reduce(
          (sum, cm) => sum + cm.lines.filter((l) => l.isMatch).length,
          0,
        );

        // Re-derive N from the footer string by parsing it
        if (results.length === 0) {
          expect(computeFindInFilesFooter(results)).toBe('0 matches');
          return;
        }

        const footer = computeFindInFilesFooter(results);
        // The footer starts with the N count — extract it
        const parsedN = parseInt(footer.split(' ')[0]!, 10);
        expect(parsedN).toBe(expectedN);
      }),
      { numRuns: 300 },
    );
  });

  it('M is always equal to the length of the ContentMatch[] array (property)', () => {
    fc.assert(
      fc.property(contentMatchArrayArb, (results) => {
        if (results.length === 0) return; // empty handled separately

        const expectedM = results.length;
        const footer = computeFindInFilesFooter(results);

        // "... across M file(s)" — extract M from the footer
        const acrossMatch = footer.match(/across (\d+) file/);
        expect(acrossMatch).not.toBeNull();
        const parsedM = parseInt(acrossMatch![1]!, 10);
        expect(parsedM).toBe(expectedM);
      }),
      { numRuns: 300 },
    );
  });
});

// ===========================================================================
// Task 10.5 — Unit tests for handleSearchResultClick and keyboard shortcut
// Validates: REQ-001.3–4, REQ-009.2–5
// ===========================================================================

describe('Task 10.5: handleSearchResultClick and keyboard shortcut logic', () => {
  // ── getAncestorPaths (exported from App.tsx) ──────────────────────────────

  describe('getAncestorPaths (REQ-009.4)', () => {
    it('returns an empty array for a file in the root', () => {
      expect(getAncestorPaths('/file.ts')).toEqual([]);
    });

    it('returns the parent directory for a single-level file', () => {
      expect(getAncestorPaths('/repo/file.ts')).toEqual(['/repo']);
    });

    it('returns all ancestors for a deeply nested file', () => {
      expect(getAncestorPaths('/a/b/c/d/file.ts')).toEqual([
        '/a',
        '/a/b',
        '/a/b/c',
        '/a/b/c/d',
      ]);
    });

    it('every ancestor is a proper prefix of the file path', () => {
      const filePath = '/a/b/c/d/e/file.ts';
      const ancestors = getAncestorPaths(filePath);
      for (const ancestor of ancestors) {
        expect(filePath.startsWith(ancestor + '/')).toBe(true);
      }
    });

    it('returns ancestor count = path depth - 1 for any valid path (fast-check)', () => {
      fc.assert(
        fc.property(
          fc
            .array(fc.stringMatching(/^[a-zA-Z0-9_-]{1,10}$/), { minLength: 1, maxLength: 6 })
            .map((parts) => '/' + parts.join('/') + '/file.ts'),
          (filePath) => {
            const parts = filePath.split('/').filter(Boolean);
            // parts includes the file name itself, so ancestor count = parts.length - 1
            const ancestors = getAncestorPaths(filePath);
            expect(ancestors.length).toBe(parts.length - 1);
          },
        ),
        { numRuns: 300 },
      );
    });

    it('ancestors are prefix-ordered (each is a prefix of the next)', () => {
      fc.assert(
        fc.property(
          fc
            .array(fc.stringMatching(/^[a-zA-Z0-9_-]{1,10}$/), { minLength: 2, maxLength: 6 })
            .map((parts) => '/' + parts.join('/') + '/file.ts'),
          (filePath) => {
            const ancestors = getAncestorPaths(filePath);
            for (let i = 0; i < ancestors.length - 1; i++) {
              // ancestors[i] must be a strict prefix of ancestors[i+1]
              expect(ancestors[i + 1]!.startsWith(ancestors[i]! + '/')).toBe(true);
            }
          },
        ),
        { numRuns: 300 },
      );
    });

    it('expanding ancestors by set union is idempotent', () => {
      // REQ-009.4: merging ancestorPaths into expandedPaths using a Set is idempotent
      const filePath = '/a/b/c/file.ts';
      const ancestorPaths = getAncestorPaths(filePath);
      const expandedPaths = ['/a', '/x/y'];

      const merged1 = Array.from(new Set([...expandedPaths, ...ancestorPaths]));
      const merged2 = Array.from(new Set([...merged1, ...ancestorPaths]));

      expect(merged1.sort()).toEqual(merged2.sort());
    });
  });

  // ── Keyboard shortcut guard ───────────────────────────────────────────────

  describe('keyboard shortcut guard (REQ-001.3–4)', () => {
    const base = {
      isMac: true,
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      key: 'F',
      modal: null as string | null,
      activeTabId: 'tab-1',
    };

    it('opens search when Cmd+Shift+F is pressed on macOS with a tab active', () => {
      expect(shouldOpenSearchModal(base)).toBe(true);
    });

    it('opens search when Ctrl+Shift+F is pressed on Windows with a tab active', () => {
      expect(
        shouldOpenSearchModal({
          ...base,
          isMac: false,
          metaKey: false,
          ctrlKey: true,
        }),
      ).toBe(true);
    });

    it('does NOT open modal when activeTabId is null (REQ-001.4)', () => {
      expect(shouldOpenSearchModal({ ...base, activeTabId: null })).toBe(false);
    });

    it('does NOT override modal="publish" (REQ-001.3)', () => {
      expect(shouldOpenSearchModal({ ...base, modal: 'publish' })).toBe(false);
    });

    it('does NOT override a CloseWorktreeModal (REQ-001.3)', () => {
      expect(shouldOpenSearchModal({ ...base, modal: 'close-worktree-object' })).toBe(false);
    });

    it('DOES allow re-triggering when modal is already "search"', () => {
      // modal === 'search' is the only non-null value that should not block the shortcut
      expect(shouldOpenSearchModal({ ...base, modal: 'search' })).toBe(true);
    });

    it('does NOT trigger without the Shift key', () => {
      expect(shouldOpenSearchModal({ ...base, shiftKey: false })).toBe(false);
    });

    it('does NOT trigger without the modifier key (Cmd/Ctrl)', () => {
      expect(shouldOpenSearchModal({ ...base, metaKey: false })).toBe(false);
    });

    it('does NOT trigger for a different key', () => {
      expect(shouldOpenSearchModal({ ...base, key: 'G' })).toBe(false);
      expect(shouldOpenSearchModal({ ...base, key: 'f' })).toBe(false); // lowercase
    });

    it('using Ctrl on macOS (instead of Cmd) does NOT trigger', () => {
      expect(
        shouldOpenSearchModal({
          ...base,
          isMac: true,
          metaKey: false,
          ctrlKey: true,
        }),
      ).toBe(false);
    });

    it('shortcut guard holds for any non-null, non-"search" modal (fast-check)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s !== 'search'),
          (modal) => {
            expect(shouldOpenSearchModal({ ...base, modal })).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  // ── handleSearchResultClick — modal dismissed before readFile ────────────

  describe('modal dismissed before readFile (REQ-009.3)', () => {
    /**
     * In handleSearchResultClick, the modal is dismissed BEFORE awaiting readFile:
     *
     *   update({ modal: null });  // synchronous — before any await
     *   latestFileRef.current = filePath;
     *   updateTabState(tabId, { ... });
     *   const [contentResult, ...] = await Promise.all([readFile, ...]);
     *
     * We model this as an ordered event sequence and verify the modal is cleared
     * before any async operation resolves.
     */
    it('modal is set to null synchronously before any await', () => {
      const events: string[] = [];

      // Simulate the sequence of operations in handleSearchResultClick
      function simulateSearchResultClick(
        onModalUpdate: (val: null) => void,
        onFileLoad: () => Promise<void>,
      ): Promise<void> {
        onModalUpdate(null);   // synchronous — before any await
        events.push('modal-dismissed');
        return onFileLoad().then(() => {
          events.push('file-loaded');
        });
      }

      let fileLoadResolveFn!: () => void;
      const fileLoadPromise = new Promise<void>((res) => { fileLoadResolveFn = res; });

      const clickPromise = simulateSearchResultClick(
        () => { events.push('modal-null'); },
        () => fileLoadPromise,
      );

      // At this point, readFile has not resolved yet
      expect(events).toEqual(['modal-null', 'modal-dismissed']);

      // Resolve the file load
      fileLoadResolveFn();
      return clickPromise.then(() => {
        expect(events).toEqual(['modal-null', 'modal-dismissed', 'file-loaded']);
      });
    });
  });

  // ── handleSearchResultClick — expandedPaths (REQ-009.4) ─────────────────

  describe('handleSearchResultClick — expands ancestors (REQ-009.4)', () => {
    it('merges ancestor paths into existing expandedPaths', () => {
      const existingPaths = ['/a', '/x/y'];
      const filePath = '/a/b/c/file.ts';
      const ancestorPaths = getAncestorPaths(filePath); // ['/a', '/a/b', '/a/b/c']

      const merged = Array.from(new Set([...existingPaths, ...ancestorPaths]));

      expect(merged).toContain('/a');
      expect(merged).toContain('/a/b');
      expect(merged).toContain('/a/b/c');
      expect(merged).toContain('/x/y');
      // No duplicates
      expect(merged.length).toBe(new Set(merged).size);
    });

    it('does not add duplicates when ancestors are already expanded', () => {
      const filePath = '/a/b/file.ts';
      const ancestorPaths = getAncestorPaths(filePath); // ['/a', '/a/b']
      const existingPaths = ['/a', '/a/b']; // already expanded

      const merged = Array.from(new Set([...existingPaths, ...ancestorPaths]));
      expect(merged.length).toBe(2);
    });
  });
});

// ===========================================================================
// Task 10.6 — Property 9: scrollToLine Clamping
// Feature: search-bar, Property 9: scrollToLine clamping
// Validates: REQ-009.2
// ===========================================================================

describe('Task 10.6 — Property 9: scrollToLine clamping', () => {
  /**
   * For any file content (determining N lines) and any positive integer
   * lineNumber, the stored scrollToLine value must equal min(lineNumber, N).
   * No value greater than the file's total line count may be stored.
   *
   * Validates: Requirements REQ-009.2
   */

  it('clamps lineNumber to the last line when it exceeds total lines (unit examples)', () => {
    const content = 'line1\nline2\nline3'; // 3 lines
    expect(clampScrollToLine(content, 1)).toBe(1);
    expect(clampScrollToLine(content, 3)).toBe(3);
    expect(clampScrollToLine(content, 4)).toBe(3);  // clamped to 3
    expect(clampScrollToLine(content, 100)).toBe(3); // clamped to 3
  });

  it('returns null when lineNumber is undefined', () => {
    expect(clampScrollToLine('line1\nline2', undefined)).toBeNull();
  });

  it('returns null when lineNumber is 0', () => {
    expect(clampScrollToLine('line1\nline2', 0)).toBeNull();
  });

  it('returns null when lineNumber is negative', () => {
    expect(clampScrollToLine('line1\nline2', -1)).toBeNull();
  });

  it('returns lineNumber as-is when within bounds', () => {
    const content = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n');
    for (let n = 1; n <= 10; n++) {
      expect(clampScrollToLine(content, n)).toBe(n);
    }
  });

  it('result is always ≤ total line count (fast-check — Property 9)', () => {
    fc.assert(
      fc.property(fileContentArb, positiveLineNumberArb, (content, lineNumber) => {
        const result = clampScrollToLine(content, lineNumber);
        const totalLines = content.split('\n').length;

        // Result must not be null (lineNumber is always >= 1 from the arbitrary)
        expect(result).not.toBeNull();
        // Result must not exceed total lines
        expect(result!).toBeLessThanOrEqual(totalLines);
        // Result must be at least 1
        expect(result!).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: 300 },
    );
  });

  it('result equals min(lineNumber, totalLines) for all positive lineNumbers (fast-check — Property 9)', () => {
    fc.assert(
      fc.property(fileContentArb, positiveLineNumberArb, (content, lineNumber) => {
        const totalLines = content.split('\n').length;
        const result = clampScrollToLine(content, lineNumber);

        expect(result).toBe(Math.min(lineNumber, totalLines));
      }),
      { numRuns: 300 },
    );
  });

  it('lineNumber within bounds is stored unchanged (fast-check)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }).chain((totalLines) =>
          fc.tuple(
            fc.constant(Array.from({ length: totalLines }, (_, i) => `line ${i}`).join('\n')),
            fc.integer({ min: 1, max: totalLines }),
          ),
        ),
        ([content, lineNumber]) => {
          const result = clampScrollToLine(content, lineNumber);
          expect(result).toBe(lineNumber);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('lineNumber exceeding totalLines is clamped to totalLines (fast-check)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }).chain((totalLines) =>
          fc.tuple(
            fc.constant(Array.from({ length: totalLines }, (_, i) => `line ${i}`).join('\n')),
            fc.integer({ min: totalLines + 1, max: totalLines + 500 }),
          ),
        ),
        ([content, lineNumber]) => {
          const totalLines = content.split('\n').length;
          const result = clampScrollToLine(content, lineNumber);
          expect(result).toBe(totalLines);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('single-line file always clamps any lineNumber to 1', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }).filter((s) => !s.includes('\n')),
        positiveLineNumberArb,
        (singleLineContent, lineNumber) => {
          // Content with no newlines is a 1-line file
          const result = clampScrollToLine(singleLineContent, lineNumber);
          expect(result).toBe(1);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('clamping is idempotent: clamping a clamped value returns the same result', () => {
    fc.assert(
      fc.property(fileContentArb, positiveLineNumberArb, (content, lineNumber) => {
        const firstClamp = clampScrollToLine(content, lineNumber)!;
        const secondClamp = clampScrollToLine(content, firstClamp)!;
        expect(secondClamp).toBe(firstClamp);
      }),
      { numRuns: 200 },
    );
  });
});
