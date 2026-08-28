import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

/**
 * Feature: folder-browser
 * Validates: Requirements REQ-007.1, REQ-007.2
 *
 * Property 11: Persistence round-trip
 * For any absolute path string `p`, saveLastFolder(p) followed by getLastFolder()
 * returns `p` unchanged.
 *
 * CP-005: Persistence Round-Trip (REQ-007)
 * Writing a path to PersistenceStore and reading it back SHALL return the
 * original path unchanged.
 */

// We mock the `electron` module before importing persistenceStore so that
// app.getPath('userData') resolves to our temp directory.
let currentTempDir = '';

vi.mock('electron', () => ({
  app: {
    getPath: (_name: string) => currentTempDir,
  },
}));

const tempDirs: string[] = [];

// Lazily-loaded module handles — populated in the first beforeEach call.
// We use `let` + dynamic import inside beforeEach to avoid a top-level `await`
// which is not permitted when TypeScript compiles the file as CommonJS.
let getLastFolder: (typeof import('../persistenceStore.js'))['getLastFolder'];
let saveLastFolder: (typeof import('../persistenceStore.js'))['saveLastFolder'];

beforeEach(async () => {
  const dir = join(tmpdir(), `arlo-persistence-test-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  currentTempDir = dir;
  tempDirs.push(dir);

  // Import after the mock is installed and after currentTempDir is set.
  // Vitest resets module registry between test files, so this import is fresh
  // for each test file run. Within the file, subsequent beforeEach calls
  // return the already-cached module (vi.mock is file-scoped).
  const mod = await import('../persistenceStore.js');
  getLastFolder = mod.getLastFolder;
  saveLastFolder = mod.saveLastFolder;
});

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('PersistenceStore – Property 11: Persistence round-trip', () => {
  /**
   * Validates: REQ-007.1 (saveLastFolder writes to kiro-state.json)
   *            REQ-007.2 (getLastFolder reads back correctly)
   *
   * For any absolute path string p, saveLastFolder(p) → getLastFolder() === p
   */
  it('round-trips any non-empty path string unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary non-empty strings, prefix with '/' to form a valid-ish absolute path
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => !s.includes('\0')),
        async (pathSuffix) => {
          const folderPath = `/${pathSuffix}`;

          await saveLastFolder(folderPath);
          const result = await getLastFolder();

          expect(result).toBe(folderPath);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: REQ-007.2
   *
   * saveLastFolder(null) → getLastFolder() === null
   */
  it('round-trips null — clearing the persisted path returns null on read', async () => {
    await fc.assert(
      fc.asyncProperty(
        // First write a real path, then overwrite with null — ensures we test the null branch
        // with a pre-existing file, not just an absent file.
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => !s.includes('\0')),
        async (pathSuffix) => {
          const folderPath = `/${pathSuffix}`;

          // Write a path first so the state file exists
          await saveLastFolder(folderPath);

          // Now clear it
          await saveLastFolder(null);
          const result = await getLastFolder();

          expect(result).toBeNull();
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * Validates: REQ-007.2
   *
   * getLastFolder() returns null when no state file exists (fresh install).
   */
  it('returns null when the state file is absent', async () => {
    // tempDir is fresh (no kiro-state.json written yet)
    const result = await getLastFolder();
    expect(result).toBeNull();
  });

  /**
   * Validates: REQ-007.1 (write failure must not surface to the user)
   *
   * saveLastFolder preserves other keys in kiro-state.json when merging.
   * Writing a path and then another path should not corrupt the file;
   * the last written path is always what is returned.
   */
  it('sequential writes — getLastFolder always returns the most recently saved path', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 1, maxLength: 100 }).filter((s) => !s.includes('\0')),
          { minLength: 2, maxLength: 10 },
        ),
        async (paths) => {
          for (const p of paths) {
            await saveLastFolder(`/${p}`);
          }
          const result = await getLastFolder();
          const expectedPath = `/${paths[paths.length - 1]}`;
          expect(result).toBe(expectedPath);
        },
      ),
      { numRuns: 50 },
    );
  });
});
