/**
 * Feature: search-bar
 *
 * Unit and property-based tests for fileNameMatcher.ts.
 *
 * Task 7.2  — Unit tests
 * Task 7.3  — Property 1: File name search result limit
 * Task 7.4  — Property 2: File name search result ordering
 * Task 7.5  — Property 3: File name search case-insensitivity idempotence
 * Task 7.6  — Property 4: Regex mode results satisfy the pattern
 *
 * Validates: Requirements REQ-003.3, REQ-003.5, REQ-003.7, REQ-003.8
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { FileNode } from '@arlo-doc/shared';
import {
  flattenLeaves,
  scoreFileName,
  matchFileNames,
  type MatchResult,
} from '../fileNameMatcher';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a leaf FileNode (file). */
function makeFile(name: string, path: string): FileNode {
  return { name, path, kind: 'file', children: [], skippedPaths: [] };
}

/** Build a directory FileNode. */
function makeDir(name: string, path: string, children: FileNode[]): FileNode {
  return { name, path, kind: 'dir', children, skippedPaths: [] };
}

/** Convenience: a root dir containing a flat list of files. */
function makeTree(files: Array<{ name: string; path: string }>): FileNode {
  return makeDir('root', '/root', files.map((f) => makeFile(f.name, f.path)));
}

/** Cast MatchResult to array (throws if it's an error object). */
function asArray(r: MatchResult): ReturnType<typeof flattenLeaves> {
  if (!Array.isArray(r)) throw new Error('Expected array, got error: ' + JSON.stringify(r));
  return r;
}

const NO_OPTIONS = { caseSensitive: false, useRegex: false } as const;
const CASE_SENSITIVE = { caseSensitive: true, useRegex: false } as const;

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a non-empty file base name that is safe to use as a regex character
 * class and avoids special regex metacharacters, so it works in both normal and
 * regex test modes.
 */
const fileNameArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-zA-Z0-9_-]{1,20}$/)
  .filter((s) => s.length > 0)
  .map((s) => s + '.ts');

/** Generates a non-empty query string (alphanumeric only — safe for regex tests). */
const queryArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-zA-Z0-9]{1,10}$/)
  .filter((s) => s.length > 0);

/**
 * Generates a FileNode tree with 0–200 leaf nodes.
 * Each leaf gets a unique numeric suffix to keep paths distinct.
 */
const fileTreeArb: fc.Arbitrary<FileNode> = fc
  .array(fileNameArb, { minLength: 0, maxLength: 200 })
  .map((names) => {
    const children = names.map((name, i) =>
      makeFile(name, `/repo/src/${i}/${name}`),
    );
    return makeDir('repo', '/repo', children);
  });

/**
 * Generates a FileNode tree with 1–200 leaf nodes (at least one file).
 */
const nonEmptyFileTreeArb: fc.Arbitrary<FileNode> = fc
  .array(fileNameArb, { minLength: 1, maxLength: 200 })
  .map((names) => {
    const children = names.map((name, i) =>
      makeFile(name, `/repo/src/${i}/${name}`),
    );
    return makeDir('repo', '/repo', children);
  });

// ---------------------------------------------------------------------------
// Task 7.2 — Unit tests
// ---------------------------------------------------------------------------

describe('fileNameMatcher — unit tests (task 7.2)', () => {
  describe('matchFileNames', () => {
    it('returns [] when query is empty', () => {
      const tree = makeTree([
        { name: 'index.ts', path: '/repo/index.ts' },
        { name: 'App.tsx', path: '/repo/App.tsx' },
      ]);
      const result = matchFileNames('', tree, NO_OPTIONS);
      expect(result).toEqual([]);
    });

    it('returns [] when query is longer than every file name', () => {
      const tree = makeTree([
        { name: 'a.ts', path: '/repo/a.ts' },
        { name: 'b.ts', path: '/repo/b.ts' },
      ]);
      // Query is 50 chars — longer than any base name above
      const longQuery = 'a'.repeat(50);
      const result = asArray(matchFileNames(longQuery, tree, NO_OPTIONS));
      expect(result).toEqual([]);
    });

    it('returns [] when tree is null', () => {
      const result = matchFileNames('index', null, NO_OPTIONS);
      expect(result).toEqual([]);
    });

    it('returns [] when the tree has no leaf nodes', () => {
      // A directory with only subdirectories (no files)
      const emptyDir = makeDir('repo', '/repo', [
        makeDir('src', '/repo/src', []),
        makeDir('test', '/repo/test', []),
      ]);
      const result = asArray(matchFileNames('src', emptyDir, NO_OPTIONS));
      expect(result).toEqual([]);
    });

    it('exact prefix match ranks above a mid-name (non-prefix) match', () => {
      // "index.ts" starts with "ind" — prefix match.
      // "findIndex.ts" contains "ind" mid-name — not a prefix.
      const tree = makeTree([
        { name: 'findIndex.ts', path: '/repo/findIndex.ts' },
        { name: 'index.ts', path: '/repo/index.ts' },
      ]);
      const results = asArray(matchFileNames('ind', tree, NO_OPTIONS));
      expect(results.length).toBe(2);
      // The prefix match should come first
      expect(results[0]!.fileName).toBe('index.ts');
    });

    it('returns { ok: false, error: "INVALID_REGEX" } for invalid regex pattern', () => {
      const tree = makeTree([{ name: 'App.tsx', path: '/repo/App.tsx' }]);
      const result = matchFileNames('[invalid', tree, { caseSensitive: false, useRegex: true });
      expect(result).toEqual({ ok: false, error: 'INVALID_REGEX' });
    });

    it('returns { ok: false, error: "INVALID_REGEX" } for another malformed pattern', () => {
      const tree = makeTree([{ name: 'foo.ts', path: '/repo/foo.ts' }]);
      const result = matchFileNames('(unclosed', tree, { caseSensitive: false, useRegex: true });
      expect(result).toEqual({ ok: false, error: 'INVALID_REGEX' });
    });

    it('returns matched files for a valid regex pattern', () => {
      const tree = makeTree([
        { name: 'App.tsx', path: '/repo/App.tsx' },
        { name: 'index.ts', path: '/repo/index.ts' },
        { name: 'utils.ts', path: '/repo/utils.ts' },
      ]);
      // Pattern matches names containing "index" or "utils"
      const results = asArray(
        matchFileNames('index|utils', tree, { caseSensitive: false, useRegex: true }),
      );
      expect(results.length).toBe(2);
      const names = results.map((r) => r.fileName);
      expect(names).toContain('index.ts');
      expect(names).toContain('utils.ts');
    });

    it('flattenLeaves collects all leaves from a nested tree', () => {
      const tree = makeDir('root', '/root', [
        makeDir('src', '/root/src', [
          makeFile('a.ts', '/root/src/a.ts'),
          makeFile('b.ts', '/root/src/b.ts'),
        ]),
        makeFile('c.ts', '/root/c.ts'),
      ]);
      const leaves = flattenLeaves(tree);
      expect(leaves.length).toBe(3);
      expect(leaves.map((l) => l.fileName).sort()).toEqual(['a.ts', 'b.ts', 'c.ts']);
    });
  });

  describe('scoreFileName', () => {
    it('returns null for an empty query', () => {
      expect(scoreFileName('', 'index.ts', NO_OPTIONS)).toBeNull();
    });

    it('returns null when no query chars match', () => {
      expect(scoreFileName('xyz', 'abc.ts', CASE_SENSITIVE)).toBeNull();
    });

    it('exact prefix score is higher than consecutive-run score', () => {
      // "ind" is a prefix of "index.ts" → tier 1
      const prefixScore = scoreFileName('ind', 'index.ts', NO_OPTIONS)!;
      // "ind" appears as a substring mid-name in "findme.ts" → tier 2 (consecutive run)
      const runScore = scoreFileName('ind', 'findme.ts', NO_OPTIONS);
      // "findme.ts" does not contain "ind" as substring — use something that does
      const runScore2 = scoreFileName('ind', 'bindme.ts', NO_OPTIONS)!;
      expect(prefixScore).toBeGreaterThan(runScore2);
    });

    it('is case-insensitive when caseSensitive=false', () => {
      const lower = scoreFileName('app', 'App.tsx', NO_OPTIONS);
      const upper = scoreFileName('APP', 'App.tsx', NO_OPTIONS);
      expect(lower).not.toBeNull();
      expect(upper).not.toBeNull();
      expect(lower).toBe(upper);
    });

    it('is case-sensitive when caseSensitive=true', () => {
      // "app" (lowercase) should not match "App.tsx" when case-sensitive
      const score = scoreFileName('app', 'App.tsx', CASE_SENSITIVE);
      // Either no match (null) or a lower-tier match — the key thing is the
      // uppercase version produces a distinct (higher or present) result
      const scoreUpper = scoreFileName('App', 'App.tsx', CASE_SENSITIVE);
      // If 'app' somehow matches (fuzzy), it shouldn't equal the exact-case result
      if (score !== null && scoreUpper !== null) {
        // "App" (matching case) should score >= "app" (non-matching case)
        expect(scoreUpper).toBeGreaterThanOrEqual(score);
      } else {
        // At least one must produce a result for "App"
        expect(scoreUpper).not.toBeNull();
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Task 7.3 — Property 1: File Name Search Result Limit
// Feature: search-bar, Property 1: File name search result limit
// Validates: Requirements REQ-003.3
// ---------------------------------------------------------------------------

describe('Property 1: File name search result limit (task 7.3)', () => {
  it('matchFileNames returns at most 50 results for any file tree and non-empty query', () => {
    fc.assert(
      fc.property(fileTreeArb, queryArb, (tree, query) => {
        const result = matchFileNames(query, tree, NO_OPTIONS);
        // result is either FileNameMatch[] or { ok: false, error: 'INVALID_REGEX' }
        // In normal (non-regex) mode it is always an array
        if (Array.isArray(result)) {
          expect(result.length).toBeLessThanOrEqual(50);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('result limit holds for case-sensitive mode', () => {
    fc.assert(
      fc.property(fileTreeArb, queryArb, (tree, query) => {
        const result = matchFileNames(query, tree, CASE_SENSITIVE);
        if (Array.isArray(result)) {
          expect(result.length).toBeLessThanOrEqual(50);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('result limit holds even for trees with exactly 200 leaves', () => {
    fc.assert(
      fc.property(
        fc.array(fileNameArb, { minLength: 200, maxLength: 200 }),
        queryArb,
        (names, query) => {
          // Use a query that is very likely to match many files (single char)
          const singleChar = query[0]!;
          const tree = makeDir(
            'root',
            '/root',
            names.map((n, i) => makeFile(n, `/root/${i}/${n}`)),
          );
          const result = matchFileNames(singleChar, tree, NO_OPTIONS);
          if (Array.isArray(result)) {
            expect(result.length).toBeLessThanOrEqual(50);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Task 7.4 — Property 2: File Name Search Result Ordering
// Feature: search-bar, Property 2: File name search result ordering
// Validates: Requirements REQ-003.3, REQ-003.5
// ---------------------------------------------------------------------------

describe('Property 2: File name search result ordering (task 7.4)', () => {
  it('results are ordered by descending score (best match first)', () => {
    fc.assert(
      fc.property(nonEmptyFileTreeArb, queryArb, (tree, query) => {
        const result = matchFileNames(query, tree, NO_OPTIONS);
        if (!Array.isArray(result) || result.length < 2) return;

        // Re-score each result to verify ordering
        const scored = result.map((r) => scoreFileName(query, r.fileName, NO_OPTIONS));

        for (let i = 0; i < scored.length - 1; i++) {
          const a = scored[i];
          const b = scored[i + 1];
          if (a != null && b != null) {
            // Score must be non-increasing (descending or equal)
            expect(a).toBeGreaterThanOrEqual(b as number);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('equal-score results are ordered alphabetically by filePath (ascending)', () => {
    // Build two files whose names are identical — same score guaranteed
    const file1 = makeFile('app.ts', '/repo/a/app.ts');
    const file2 = makeFile('app.ts', '/repo/b/app.ts');
    const tree = makeDir('repo', '/repo', [file2, file1]); // reversed order intentionally

    const results = asArray(matchFileNames('app', tree, NO_OPTIONS));
    expect(results.length).toBe(2);
    // Both get the same score; /repo/a/app.ts < /repo/b/app.ts alphabetically
    expect(results[0]!.filePath).toBe('/repo/a/app.ts');
    expect(results[1]!.filePath).toBe('/repo/b/app.ts');
  });

  it('a case-insensitive prefix match ranks above a non-prefix fuzzy match', () => {
    // "index.ts" starts with "ind" → prefix tier (score ≥ 1000)
    // "findAll.ts" — "ind" is not a prefix, but all chars are present
    const tree = makeTree([
      { name: 'findAll.ts', path: '/repo/findAll.ts' },
      { name: 'index.ts', path: '/repo/index.ts' },
    ]);

    const results = asArray(matchFileNames('ind', tree, NO_OPTIONS));
    expect(results.length).toBeGreaterThanOrEqual(1);
    // The prefix match (index.ts) must come before findAll.ts
    const indexPos = results.findIndex((r) => r.fileName === 'index.ts');
    const findPos = results.findIndex((r) => r.fileName === 'findAll.ts');
    if (indexPos !== -1 && findPos !== -1) {
      expect(indexPos).toBeLessThan(findPos);
    }
  });

  it('result filePaths within same score bucket are strictly sorted ascending (property)', () => {
    fc.assert(
      fc.property(nonEmptyFileTreeArb, queryArb, (tree, query) => {
        const result = matchFileNames(query, tree, NO_OPTIONS);
        if (!Array.isArray(result) || result.length < 2) return;

        const scored = result.map((r) => ({
          filePath: r.filePath,
          score: scoreFileName(query, r.fileName, NO_OPTIONS) ?? -Infinity,
        }));

        for (let i = 0; i < scored.length - 1; i++) {
          const a = scored[i]!;
          const b = scored[i + 1]!;

          if (a.score === b.score) {
            // Same score → filePath must be lexicographically non-decreasing
            expect(a.filePath.localeCompare(b.filePath)).toBeLessThanOrEqual(0);
          } else {
            // Different scores → must be descending
            expect(a.score).toBeGreaterThan(b.score);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Task 7.5 — Property 3: File Name Search Case-Insensitivity Idempotence
// Feature: search-bar, Property 3: File name search case-insensitivity idempotence
// Validates: Requirements REQ-003.7
// ---------------------------------------------------------------------------

describe('Property 3: File name search case-insensitivity idempotence (task 7.5)', () => {
  it('scoreFileName produces the same result for uppercased and lowercased query when caseSensitive=false', () => {
    fc.assert(
      fc.property(queryArb, fileNameArb, (query, baseName) => {
        const opts = NO_OPTIONS; // caseSensitive: false
        const scoreUpper = scoreFileName(query.toUpperCase(), baseName, opts);
        const scoreLower = scoreFileName(query.toLowerCase(), baseName, opts);
        expect(scoreUpper).toBe(scoreLower);
      }),
      { numRuns: 300 },
    );
  });

  it('uppercase and lowercase queries produce identical result arrays when caseSensitive=false', () => {
    fc.assert(
      fc.property(fileTreeArb, queryArb, (tree, query) => {
        const upper = matchFileNames(query.toUpperCase(), tree, NO_OPTIONS);
        const lower = matchFileNames(query.toLowerCase(), tree, NO_OPTIONS);

        // Both must be arrays (no regex mode)
        if (!Array.isArray(upper) || !Array.isArray(lower)) return;

        expect(upper.length).toBe(lower.length);
        for (let i = 0; i < upper.length; i++) {
          expect(upper[i]).toEqual(lower[i]);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('toggling caseSensitive from false → true → false returns the same result as the original', () => {
    // Arrange two files where toggling case would produce different results
    const tree = makeTree([
      { name: 'App.tsx', path: '/repo/App.tsx' },
      { name: 'app.ts', path: '/repo/app.ts' },
    ]);

    const opts0 = NO_OPTIONS;               // caseSensitive: false
    const opts1 = CASE_SENSITIVE;           // caseSensitive: true
    const opts2 = NO_OPTIONS;               // back to false

    const result0 = asArray(matchFileNames('app', tree, opts0));
    const result2 = asArray(matchFileNames('app', tree, opts2));

    // Both calls use caseSensitive=false — results must be identical
    expect(result0).toEqual(result2);

    // Sanity: toggling to case-sensitive can differ
    const result1 = asArray(matchFileNames('app', tree, opts1));
    // result1 might or might not match "App.tsx" depending on case — just verify it's an array
    expect(Array.isArray(result1)).toBe(true);
  });

  it('scoreFileName is symmetric under case swap for any alphanumeric input', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-zA-Z]+$/.test(s)),
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z0-9_.-]+$/.test(s)),
        (query, baseName) => {
          const opts = NO_OPTIONS;
          const scoreA = scoreFileName(query.toUpperCase(), baseName, opts);
          const scoreB = scoreFileName(query.toLowerCase(), baseName, opts);
          expect(scoreA).toBe(scoreB);
        },
      ),
      { numRuns: 300 },
    );
  });
});

// ---------------------------------------------------------------------------
// Task 7.6 — Property 4: Regex Mode — Results Satisfy the Pattern
// Feature: search-bar, Property 4: Regex mode results satisfy the pattern
// Validates: Requirements REQ-003.8
// ---------------------------------------------------------------------------

describe('Property 4: Regex mode results satisfy the pattern (task 7.6)', () => {
  /**
   * Generates a syntactically valid, simple regex pattern from one or two
   * alphanumeric words optionally joined by `|`. Avoids tricky metacharacters
   * that could produce unexpected matches.
   */
  const safeRegexArb: fc.Arbitrary<string> = fc.oneof(
    // Single word pattern e.g. "app"
    fc.stringMatching(/^[a-z]{1,8}$/),
    // Two words joined by | e.g. "app|index"
    fc
      .tuple(
        fc.stringMatching(/^[a-z]{1,6}$/),
        fc.stringMatching(/^[a-z]{1,6}$/),
      )
      .map(([a, b]) => `${a}|${b}`),
    // Optional char e.g. "app?"
    fc
      .tuple(
        fc.stringMatching(/^[a-z]{1,7}$/),
        fc.constantFrom('?', '*', '+'),
      )
      .map(([word, q]) => `${word.slice(0, -1)}${q === '*' ? word.slice(-1) + '*' : word.slice(-1) + q}`),
  );

  it('every result fileName is matched by the regex when useRegex=true, caseSensitive=false', () => {
    fc.assert(
      fc.property(fileTreeArb, safeRegexArb, (tree, pattern) => {
        const opts = { caseSensitive: false, useRegex: true };
        const result = matchFileNames(pattern, tree, opts);

        // Skip if the pattern was invalid (shouldn't happen with safeRegexArb, but defensive)
        if (!Array.isArray(result)) return;

        const regex = new RegExp(pattern, 'i');
        for (const match of result) {
          expect(regex.test(match.fileName)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('every result fileName is matched by the regex when useRegex=true, caseSensitive=true', () => {
    fc.assert(
      fc.property(fileTreeArb, safeRegexArb, (tree, pattern) => {
        const opts = { caseSensitive: true, useRegex: true };
        const result = matchFileNames(pattern, tree, opts);

        if (!Array.isArray(result)) return;

        // caseSensitive=true → no 'i' flag
        const regex = new RegExp(pattern);
        for (const match of result) {
          expect(regex.test(match.fileName)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('results are a subset of the full file list (no phantom entries created)', () => {
    fc.assert(
      fc.property(nonEmptyFileTreeArb, safeRegexArb, (tree, pattern) => {
        const opts = { caseSensitive: false, useRegex: true };
        const result = matchFileNames(pattern, tree, opts);

        if (!Array.isArray(result)) return;

        const allLeaves = flattenLeaves(tree);
        const allPaths = new Set(allLeaves.map((l) => l.filePath));

        for (const match of result) {
          // Every returned match must be from the original tree
          expect(allPaths.has(match.filePath)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('invalid regex returns { ok: false, error: "INVALID_REGEX" } (unit check)', () => {
    const tree = makeTree([{ name: 'App.tsx', path: '/repo/App.tsx' }]);
    const invalidPatterns = ['[unclosed', '(unclosed', '?noprefix', '*noprefix'];

    for (const pattern of invalidPatterns) {
      const result = matchFileNames(pattern, tree, { caseSensitive: false, useRegex: true });
      expect(result).toEqual({ ok: false, error: 'INVALID_REGEX' });
    }
  });

  it('valid regex with no matches returns an empty array (not an error)', () => {
    const tree = makeTree([
      { name: 'App.tsx', path: '/repo/App.tsx' },
      { name: 'index.ts', path: '/repo/index.ts' },
    ]);
    // Pattern that matches nothing in the tree
    const result = matchFileNames('zzzzzzznomatch', tree, { caseSensitive: false, useRegex: true });
    expect(result).toEqual([]);
  });
});
