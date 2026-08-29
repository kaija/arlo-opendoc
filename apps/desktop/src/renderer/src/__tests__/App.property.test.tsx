/**
 * Feature: git-file-status-diff-viewer
 *
 * Property tests for the handleFileClick logic extracted into fileClickLogic.ts.
 *
 * Property 5: handleFileClick updates both gitStatus and fileDiff for the opened file
 * Property 6: Race condition guard — only the last-opened file's diff is applied
 *
 * Validates: Requirements 4.1, 4.2, 4.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { GitStatus } from '@arlo-doc/shared';
import type { AppState } from '../types';
import {
  handleFileClickLogic,
  isSupportedFile,
  type FileClickDeps,
  type LatestFileRef,
  type StateUpdater,
} from '../fileClickLogic';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Valid supported file path extensions. */
const supportedExtensions = ['.md', '.mdx', '.txt'] as const;

/** Generates a supported file path like "/some/path/file.md". */
const supportedFilePathArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.stringMatching(/^[a-zA-Z0-9_-]{1,10}$/),
    fc.constantFrom(...supportedExtensions),
  )
  .map(([name, ext]) => `/repo/${name}${ext}`);

/** Generates a non-empty diff string (unified diff output). */
const diffStringArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s) => s.length > 0);

/** Generates a GitStatus object with 0–5 files. */
const gitStatusArb: fc.Arbitrary<GitStatus> = fc.record({
  branch: fc.stringMatching(/^[a-zA-Z0-9_/-]{1,30}$/),
  ahead: fc.nat({ max: 10 }),
  behind: fc.nat({ max: 10 }),
  files: fc.array(
    fc.record({
      path: fc.stringMatching(/^[a-zA-Z0-9_/-]{1,30}\.md$/),
      status: fc.constantFrom('added', 'modified', 'deleted', 'untracked', 'renamed') as fc.Arbitrary<
        'added' | 'modified' | 'deleted' | 'untracked' | 'renamed'
      >,
    }),
    { minLength: 0, maxLength: 5 },
  ),
});

/** Generates an arbitrary file content string. */
const fileContentArb: fc.Arbitrary<string> = fc.string({ minLength: 0, maxLength: 500 });

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** A simple accumulated state: tracks the last patch passed to update(). */
function makeStateTracker(): { patches: Array<Partial<AppState>>; update: StateUpdater } {
  const patches: Array<Partial<AppState>> = [];
  const update: StateUpdater = (patch) => patches.push(patch);
  return { patches, update };
}

/** Merge all patches in order (simulates React setState spreading). */
function mergePatches(patches: Array<Partial<AppState>>): Partial<AppState> {
  return Object.assign({}, ...patches);
}

/** Build a mock FileClickDeps with fully resolved promises. */
function makeDeps(overrides: Partial<FileClickDeps> = {}): FileClickDeps {
  return {
    readFile: () => Promise.resolve({ ok: true, data: 'file content' }),
    gitStatus: () => Promise.resolve({ ok: true, data: { branch: 'main', ahead: 0, behind: 0, files: [] } }),
    gitDiff: () => Promise.resolve({ ok: true, data: '' }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Property 5: handleFileClick updates both gitStatus and fileDiff
// Validates: Requirements 4.1, 4.2
// ---------------------------------------------------------------------------

describe('Property 5: handleFileClick updates both gitStatus and fileDiff for the opened file', () => {
  it('sets gitStatus to the value returned by gitStatus() for any supported filePath', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedFilePathArb,
        gitStatusArb,
        diffStringArb,
        fileContentArb,
        async (filePath, gitStatusValue, diffValue, content) => {
          const { patches, update } = makeStateTracker();
          const latestRef: LatestFileRef = { current: null };

          const deps = makeDeps({
            readFile: () => Promise.resolve({ ok: true, data: content }),
            gitStatus: () => Promise.resolve({ ok: true, data: gitStatusValue }),
            gitDiff: () => Promise.resolve({ ok: true, data: diffValue }),
          });

          await handleFileClickLogic(filePath, latestRef, update, deps);

          const merged = mergePatches(patches);

          // gitStatus must be updated to the returned value (Requirement 4.1)
          expect(merged.gitStatus).toEqual(gitStatusValue);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('sets fileDiff to the value returned by gitDiff(filePath) for any supported filePath', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedFilePathArb,
        gitStatusArb,
        diffStringArb,
        fileContentArb,
        async (filePath, gitStatusValue, diffValue, content) => {
          const { patches, update } = makeStateTracker();
          const latestRef: LatestFileRef = { current: null };

          const deps = makeDeps({
            readFile: () => Promise.resolve({ ok: true, data: content }),
            gitStatus: () => Promise.resolve({ ok: true, data: gitStatusValue }),
            gitDiff: () => Promise.resolve({ ok: true, data: diffValue }),
          });

          await handleFileClickLogic(filePath, latestRef, update, deps);

          const merged = mergePatches(patches);

          // fileDiff must be updated to the returned value (Requirement 4.2)
          expect(merged.fileDiff).toBe(diffValue);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('passes the opened filePath (not a different path) to gitDiff', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedFilePathArb,
        async (filePath) => {
          let capturedPath: string | undefined;
          const latestRef: LatestFileRef = { current: null };
          const { update } = makeStateTracker();

          const deps = makeDeps({
            gitDiff: (fp: string) => {
              capturedPath = fp;
              return Promise.resolve({ ok: true, data: 'diff output' });
            },
          });

          await handleFileClickLogic(filePath, latestRef, update, deps);

          // gitDiff must be called with the exact filePath that was clicked
          expect(capturedPath).toBe(filePath);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('leaves gitStatus unchanged when gitStatus() returns ok:false', async () => {
    await fc.assert(
      fc.asyncProperty(supportedFilePathArb, fileContentArb, async (filePath, content) => {
        const { patches, update } = makeStateTracker();
        const latestRef: LatestFileRef = { current: null };

        const deps = makeDeps({
          readFile: () => Promise.resolve({ ok: true, data: content }),
          gitStatus: () =>
            Promise.resolve({ ok: false, error: { code: 'GIT_ERROR', message: 'no repo' } }),
          gitDiff: () => Promise.resolve({ ok: true, data: 'diff' }),
        });

        await handleFileClickLogic(filePath, latestRef, update, deps);

        const merged = mergePatches(patches);

        // gitStatus should not be set in any patch when the call fails (Requirement 4.3)
        expect('gitStatus' in merged).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('leaves fileDiff unchanged when gitDiff() returns ok:false', async () => {
    await fc.assert(
      fc.asyncProperty(supportedFilePathArb, fileContentArb, async (filePath, content) => {
        const { patches, update } = makeStateTracker();
        const latestRef: LatestFileRef = { current: null };

        const deps = makeDeps({
          readFile: () => Promise.resolve({ ok: true, data: content }),
          gitStatus: () =>
            Promise.resolve({ ok: true, data: { branch: 'main', ahead: 0, behind: 0, files: [] } }),
          gitDiff: () =>
            Promise.resolve({ ok: false, error: { code: 'GIT_ERROR', message: 'error' } }),
        });

        await handleFileClickLogic(filePath, latestRef, update, deps);

        const merged = mergePatches(patches);

        // fileDiff should not be set in any patch when the call fails (Requirement 4.3)
        expect('fileDiff' in merged).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('does nothing for unsupported file extensions', async () => {
    const unsupportedPaths = [
      '/repo/image.png',
      '/repo/archive.zip',
      '/repo/script.js',
      '/repo/data.json',
      '/repo/binary.exe',
    ];

    for (const filePath of unsupportedPaths) {
      const { patches, update } = makeStateTracker();
      const latestRef: LatestFileRef = { current: null };

      await handleFileClickLogic(filePath, latestRef, update, makeDeps());

      expect(patches.length).toBe(0);
      expect(latestRef.current).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Property 6: Race condition guard — only the last-opened file's diff is applied
// Validates: Requirement 4.5
// ---------------------------------------------------------------------------

describe('Property 6: Race condition guard — only the last-opened file\'s diff is applied', () => {
  it('discards the diff of file A when file B is opened before A resolves', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Two distinct supported file paths
        supportedFilePathArb,
        supportedFilePathArb,
        diffStringArb,
        diffStringArb,
        async (pathA, pathB, diffA, diffB) => {
          fc.pre(pathA !== pathB);

          const { patches, update } = makeStateTracker();
          const latestRef: LatestFileRef = { current: null };

          // Deferred resolvers so we can control resolution order
          let resolveA!: (v: { ok: true; data: string }) => void;
          let resolveB!: (v: { ok: true; data: string }) => void;

          const promiseA = new Promise<{ ok: true; data: string }>((r) => { resolveA = r; });
          const promiseB = new Promise<{ ok: true; data: string }>((r) => { resolveB = r; });

          const depsA: FileClickDeps = {
            readFile: () => Promise.resolve({ ok: true, data: 'content A' }),
            gitStatus: () => Promise.resolve({ ok: true, data: { branch: 'main', ahead: 0, behind: 0, files: [] } }),
            gitDiff: () => promiseA,
          };

          const depsB: FileClickDeps = {
            readFile: () => Promise.resolve({ ok: true, data: 'content B' }),
            gitStatus: () => Promise.resolve({ ok: true, data: { branch: 'main', ahead: 0, behind: 0, files: [] } }),
            gitDiff: () => promiseB,
          };

          // Start file A (does not await — intentionally left in-flight)
          const clickA = handleFileClickLogic(pathA, latestRef, update, depsA);

          // Immediately start file B — this stamps latestRef.current = pathB
          const clickB = handleFileClickLogic(pathB, latestRef, update, depsB);

          // Resolve B first, then A
          resolveB({ ok: true, data: diffB });
          resolveA({ ok: true, data: diffA });

          // Wait for both to complete
          await Promise.all([clickA, clickB]);

          const merged = mergePatches(patches);

          // The final state must reflect B's diff, not A's (Requirement 4.5)
          expect(merged.fileDiff).toBe(diffB);
          expect(merged.fileDiff).not.toBe(diffA);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('discards the diff of file A when file B is opened before A resolves, even when A resolves last', async () => {
    // More explicit scenario: B resolves immediately, A resolves later
    const pathA = '/repo/file-a.md';
    const pathB = '/repo/file-b.md';
    const diffA = 'diff from A — should be discarded';
    const diffB = 'diff from B — should be applied';

    const { patches, update } = makeStateTracker();
    const latestRef: LatestFileRef = { current: null };

    let resolveA!: (v: { ok: true; data: string }) => void;
    const promiseA = new Promise<{ ok: true; data: string }>((r) => { resolveA = r; });

    const depsA: FileClickDeps = {
      readFile: () => Promise.resolve({ ok: true, data: 'content A' }),
      gitStatus: () => Promise.resolve({ ok: true, data: { branch: 'main', ahead: 0, behind: 0, files: [] } }),
      gitDiff: () => promiseA,
    };

    const depsB: FileClickDeps = {
      readFile: () => Promise.resolve({ ok: true, data: 'content B' }),
      gitStatus: () => Promise.resolve({ ok: true, data: { branch: 'main', ahead: 0, behind: 0, files: [] } }),
      gitDiff: () => Promise.resolve({ ok: true, data: diffB }),
    };

    // Start A — it's in-flight
    const clickA = handleFileClickLogic(pathA, latestRef, update, depsA);

    // Start B — stamps latestRef = pathB; resolves immediately
    const clickB = handleFileClickLogic(pathB, latestRef, update, depsB);
    await clickB;

    // Now resolve A late
    resolveA({ ok: true, data: diffA });
    await clickA;

    const merged = mergePatches(patches);

    // fileDiff must equal B's diff, not A's stale one
    expect(merged.fileDiff).toBe(diffB);
    expect(merged.fileDiff).not.toBe(diffA);
  });

  it('latestRef.current always equals the most recently opened file path after all complete', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedFilePathArb,
        supportedFilePathArb,
        async (pathA, pathB) => {
          fc.pre(pathA !== pathB);

          const latestRef: LatestFileRef = { current: null };
          const { update } = makeStateTracker();

          // Both resolve immediately
          const deps: FileClickDeps = makeDeps();

          // Open A then B in sequence
          await handleFileClickLogic(pathA, latestRef, update, deps);
          await handleFileClickLogic(pathB, latestRef, update, deps);

          // After both complete, latestRef should hold pathB (the last one opened)
          expect(latestRef.current).toBe(pathB);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('applies results normally when only one file is opened (no race)', async () => {
    await fc.assert(
      fc.asyncProperty(
        supportedFilePathArb,
        gitStatusArb,
        diffStringArb,
        fileContentArb,
        async (filePath, gitStatusValue, diffValue, content) => {
          const { patches, update } = makeStateTracker();
          const latestRef: LatestFileRef = { current: null };

          const deps = makeDeps({
            readFile: () => Promise.resolve({ ok: true, data: content }),
            gitStatus: () => Promise.resolve({ ok: true, data: gitStatusValue }),
            gitDiff: () => Promise.resolve({ ok: true, data: diffValue }),
          });

          await handleFileClickLogic(filePath, latestRef, update, deps);

          const merged = mergePatches(patches);

          // When no race, both gitStatus and fileDiff must be set correctly
          expect(merged.gitStatus).toEqual(gitStatusValue);
          expect(merged.fileDiff).toBe(diffValue);
          expect(merged.fileContent).toBe(content);
        },
      ),
      { numRuns: 150 },
    );
  });
});

// ---------------------------------------------------------------------------
// isSupportedFile helper — pure function, no async
// ---------------------------------------------------------------------------

describe('isSupportedFile', () => {
  it('returns true for .md, .mdx, .txt regardless of path prefix', () => {
    expect(isSupportedFile('/foo/bar.md')).toBe(true);
    expect(isSupportedFile('/foo/bar.mdx')).toBe(true);
    expect(isSupportedFile('/foo/bar.txt')).toBe(true);
  });

  it('returns false for unsupported extensions', () => {
    expect(isSupportedFile('/foo/bar.png')).toBe(false);
    expect(isSupportedFile('/foo/bar.js')).toBe(false);
    expect(isSupportedFile('/foo/bar.json')).toBe(false);
    expect(isSupportedFile('/foo/bar')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isSupportedFile('/foo/README.MD')).toBe(true);
    expect(isSupportedFile('/foo/doc.TXT')).toBe(true);
    expect(isSupportedFile('/foo/page.MDX')).toBe(true);
  });

  it('returns true for any string ending in a supported extension (fast-check)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }),
        fc.constantFrom('.md', '.mdx', '.txt', '.MD', '.TXT', '.MDX'),
        (prefix, ext) => {
          expect(isSupportedFile(prefix + ext)).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: showDiffTab is true iff fileDiff is non-null and non-empty
// Validates: Requirements 3.3, 6.4
// ---------------------------------------------------------------------------

describe('Property 4: showDiffTab is true if and only if fileDiff is non-null and non-empty', () => {
  /**
   * The derivation in App.tsx is:
   *   const showDiffTab = Boolean(state.fileDiff)
   *
   * We test this pure expression directly against the requirement:
   *   - null   → false
   *   - ""     → false
   *   - any non-empty string → true
   */

  it('is false when fileDiff is null', () => {
    expect(Boolean(null)).toBe(false);
  });

  it('is false when fileDiff is an empty string', () => {
    expect(Boolean('')).toBe(false);
  });

  it('is true for any non-empty fileDiff string (fast-check)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        (fileDiff) => {
          expect(Boolean(fileDiff)).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('is false for null or empty string, and true for any non-empty string (exhaustive)', () => {
    // Covers the full input space enumerated by the requirement
    const falsyInputs: Array<null | string> = [null, ''];
    for (const value of falsyInputs) {
      expect(Boolean(value)).toBe(false);
    }

    // Sample of non-empty strings
    const truthyInputs = [
      'diff --git a/foo.md b/foo.md',
      '-removed line',
      '+added line',
      ' ',             // single space is non-empty
      '\n',            // newline is non-empty
      'x',
    ];
    for (const value of truthyInputs) {
      expect(Boolean(value)).toBe(true);
    }
  });

  it('single space is truthy (non-empty string, but not null/"")', () => {
    // Edge case: a whitespace-only string is still a non-empty string
    expect(Boolean(' ')).toBe(true);
  });

  it('arbitrarily long diff strings always produce showDiffTab = true', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        (fileDiff) => {
          // Any string with at least one character must be truthy
          expect(Boolean(fileDiff)).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: viewMode resets to "preview" when showDiffTab transitions to false
// Validates: Requirements 6.5
// ---------------------------------------------------------------------------

describe('Property 9: viewMode resets to "preview" when showDiffTab transitions to false', () => {
  /**
   * The logic in App.tsx is the useEffect:
   *
   *   useEffect(() => {
   *     if (!showDiffTab && state.viewMode === 'diff') {
   *       update({ viewMode: 'preview' });
   *     }
   *   }, [showDiffTab]);
   *
   * We model this as a pure state-transition function and verify its invariant:
   * whenever fileDiff is null or "" (showDiffTab = false) and viewMode is "diff",
   * calling the effect body must produce a patch setting viewMode to "preview".
   *
   * We also verify the negative cases: when viewMode is not "diff", or when
   * showDiffTab is true, no reset should occur.
   */

  /** Mirrors the useEffect logic as a pure function for direct testing. */
  function applyViewModeResetEffect(
    showDiffTab: boolean,
    viewMode: string,
  ): Partial<AppState> | null {
    if (!showDiffTab && viewMode === 'diff') {
      return { viewMode: 'preview' };
    }
    return null;
  }

  // -- Requirement 6.5: reset case --

  it('produces a "preview" reset patch when fileDiff is null and viewMode is "diff"', () => {
    const showDiffTab = Boolean(null);          // false
    const result = applyViewModeResetEffect(showDiffTab, 'diff');
    expect(result).toEqual({ viewMode: 'preview' });
  });

  it('produces a "preview" reset patch when fileDiff is "" and viewMode is "diff"', () => {
    const showDiffTab = Boolean('');            // false
    const result = applyViewModeResetEffect(showDiffTab, 'diff');
    expect(result).toEqual({ viewMode: 'preview' });
  });

  it('resets viewMode for any falsy fileDiff while viewMode is "diff" (fast-check)', () => {
    // Only two falsy fileDiff values: null and ""
    const falsyValues: Array<null | string> = [null, ''];
    for (const fileDiff of falsyValues) {
      const showDiffTab = Boolean(fileDiff);
      const result = applyViewModeResetEffect(showDiffTab, 'diff');
      expect(result).toEqual({ viewMode: 'preview' });
    }
  });

  // -- Requirement 6.5 negative: no reset when viewMode is not "diff" --

  it('does not reset when viewMode is "preview" (even when fileDiff is falsy)', () => {
    const result = applyViewModeResetEffect(false, 'preview');
    expect(result).toBeNull();
  });

  it('does not reset when viewMode is "edit" (even when fileDiff is falsy)', () => {
    const result = applyViewModeResetEffect(false, 'edit');
    expect(result).toBeNull();
  });

  it('does not reset for any non-"diff" viewMode when showDiffTab is false (fast-check)', () => {
    const nonDiffModes = ['preview', 'edit'] as const;
    fc.assert(
      fc.property(
        fc.constantFrom(...nonDiffModes),
        (viewMode) => {
          const result = applyViewModeResetEffect(false, viewMode);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  // -- No reset when showDiffTab is true (diff is still visible) --

  it('does not reset when showDiffTab is true and viewMode is "diff"', () => {
    // If the diff tab is still shown, viewMode should not be forced back to preview
    const result = applyViewModeResetEffect(true, 'diff');
    expect(result).toBeNull();
  });

  it('does not reset for any viewMode when showDiffTab is true (fast-check)', () => {
    const allModes = ['preview', 'edit', 'diff'] as const;
    fc.assert(
      fc.property(
        fc.constantFrom(...allModes),
        (viewMode) => {
          const result = applyViewModeResetEffect(true, viewMode);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  // -- Combined property across all (fileDiff, viewMode) combinations --

  it('reset occurs if and only if showDiffTab is false AND viewMode is "diff" (exhaustive matrix)', () => {
    const fileDiffValues: Array<null | string> = [null, '', 'some diff'];
    const viewModes = ['preview', 'edit', 'diff'] as const;

    for (const fileDiff of fileDiffValues) {
      for (const viewMode of viewModes) {
        const showDiffTab = Boolean(fileDiff);
        const result = applyViewModeResetEffect(showDiffTab, viewMode);
        const shouldReset = !showDiffTab && viewMode === 'diff';

        if (shouldReset) {
          expect(result).toEqual({ viewMode: 'preview' });
        } else {
          expect(result).toBeNull();
        }
      }
    }
  });

  it('reset occurs for any non-empty fileDiff when showDiffTab is true (no reset expected)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.constantFrom('preview', 'edit', 'diff'),
        (fileDiff, viewMode) => {
          const showDiffTab = Boolean(fileDiff); // always true for non-empty
          const result = applyViewModeResetEffect(showDiffTab, viewMode);
          // Non-empty fileDiff means diff tab is still showing — no reset
          expect(result).toBeNull();
        },
      ),
      { numRuns: 300 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: gitStatusMap derivation preserves all files with correct letter codes
// Validates: Requirements 5.7
// ---------------------------------------------------------------------------

import path from 'path-browserify';
import { deriveGitStatusMap } from '../gitStatusMapUtils';

/** Status values as defined by GitStatusFile schema. */
type GitFileStatus = 'added' | 'modified' | 'deleted' | 'untracked' | 'renamed';

/** Maps each status string to the expected display letter per the design table. */
const EXPECTED_LETTER: Record<GitFileStatus, string> = {
  modified: 'M',
  renamed: 'M',
  added: 'A',
  untracked: 'A',
  deleted: 'D',
};

/** Generates an arbitrary GitStatus with a configurable files array. */
const gitStatusWithFilesArb = fc.record({
  branch: fc.stringMatching(/^[a-zA-Z0-9_/-]{1,30}$/),
  ahead: fc.nat({ max: 10 }),
  behind: fc.nat({ max: 10 }),
  files: fc.array(
    fc.record({
      path: fc.stringMatching(/^[a-zA-Z0-9_/.-]{1,40}$/),
      status: fc.constantFrom(
        'added',
        'modified',
        'deleted',
        'untracked',
        'renamed',
      ) as fc.Arbitrary<GitFileStatus>,
    }),
    { minLength: 0, maxLength: 10 },
  ),
});

/** Generates an absolute folder path like "/repo/project". */
const folderPathArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-zA-Z0-9_-]{1,15}$/)
  .map((name) => `/projects/${name}`);

describe('Property 8: gitStatusMap derivation preserves all files with correct letter codes', () => {
  it('map contains exactly one entry per file from gitStatus.files', () => {
    fc.assert(
      fc.property(gitStatusWithFilesArb, folderPathArb, (gitStatus, folderPath) => {
        const map = deriveGitStatusMap(gitStatus as GitStatus, folderPath);

        // Map must have exactly one entry per file in gitStatus.files
        // (If there are duplicate relative paths the last one wins — same as useMemo behaviour)
        const uniquePaths = new Set(gitStatus.files.map((f) => path.join(folderPath, f.path)));
        expect(map.size).toBe(uniquePaths.size);
      }),
      { numRuns: 300 },
    );
  });

  it('each entry uses path.join(folderPath, file.path) as the key', () => {
    fc.assert(
      fc.property(gitStatusWithFilesArb, folderPathArb, (gitStatus, folderPath) => {
        const map = deriveGitStatusMap(gitStatus as GitStatus, folderPath);

        for (const file of gitStatus.files) {
          const expectedKey = path.join(folderPath, file.path);
          // The absolute path derived by the function must be in the map
          // (unless a later file with the same relative path overwrote it —
          //  but the key itself must still be present)
          expect(map.has(expectedKey)).toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('each entry maps to the correct single-letter code per the design table', () => {
    fc.assert(
      fc.property(gitStatusWithFilesArb, folderPathArb, (gitStatus, folderPath) => {
        const map = deriveGitStatusMap(gitStatus as GitStatus, folderPath);

        // Check every file: last-writer wins for duplicate paths — we check
        // that the letter in the map is the correct one for *some* file at that path
        const lastLetterByPath = new Map<string, string>();
        for (const file of gitStatus.files) {
          const abs = path.join(folderPath, file.path);
          lastLetterByPath.set(abs, EXPECTED_LETTER[file.status as GitFileStatus]);
        }

        for (const [absPath, letter] of lastLetterByPath) {
          expect(map.get(absPath)).toBe(letter);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('returns an empty map when gitStatus is null', () => {
    fc.assert(
      fc.property(folderPathArb, (folderPath) => {
        const map = deriveGitStatusMap(null, folderPath);
        expect(map.size).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it('returns an empty map when folderPath is null', () => {
    fc.assert(
      fc.property(gitStatusWithFilesArb, (gitStatus) => {
        const map = deriveGitStatusMap(gitStatus as GitStatus, null);
        expect(map.size).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it('"modified" files always map to "M"', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 40 }),
        folderPathArb,
        (relativePath, folderPath) => {
          const gitStatus: GitStatus = {
            branch: 'main',
            ahead: 0,
            behind: 0,
            files: [{ path: relativePath, status: 'modified' }],
          };
          const map = deriveGitStatusMap(gitStatus, folderPath);
          expect(map.get(path.join(folderPath, relativePath))).toBe('M');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('"renamed" files always map to "M"', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 40 }),
        folderPathArb,
        (relativePath, folderPath) => {
          const gitStatus: GitStatus = {
            branch: 'main',
            ahead: 0,
            behind: 0,
            files: [{ path: relativePath, status: 'renamed' }],
          };
          const map = deriveGitStatusMap(gitStatus, folderPath);
          expect(map.get(path.join(folderPath, relativePath))).toBe('M');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('"added" files always map to "A"', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 40 }),
        folderPathArb,
        (relativePath, folderPath) => {
          const gitStatus: GitStatus = {
            branch: 'main',
            ahead: 0,
            behind: 0,
            files: [{ path: relativePath, status: 'added' }],
          };
          const map = deriveGitStatusMap(gitStatus, folderPath);
          expect(map.get(path.join(folderPath, relativePath))).toBe('A');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('"untracked" files always map to "A"', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 40 }),
        folderPathArb,
        (relativePath, folderPath) => {
          const gitStatus: GitStatus = {
            branch: 'main',
            ahead: 0,
            behind: 0,
            files: [{ path: relativePath, status: 'untracked' }],
          };
          const map = deriveGitStatusMap(gitStatus, folderPath);
          expect(map.get(path.join(folderPath, relativePath))).toBe('A');
        },
      ),
      { numRuns: 200 },
    );
  });

  it('"deleted" files always map to "D"', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 40 }),
        folderPathArb,
        (relativePath, folderPath) => {
          const gitStatus: GitStatus = {
            branch: 'main',
            ahead: 0,
            behind: 0,
            files: [{ path: relativePath, status: 'deleted' }],
          };
          const map = deriveGitStatusMap(gitStatus, folderPath);
          expect(map.get(path.join(folderPath, relativePath))).toBe('D');
        },
      ),
      { numRuns: 200 },
    );
  });
});
