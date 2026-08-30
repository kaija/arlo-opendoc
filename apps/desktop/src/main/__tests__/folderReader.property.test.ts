import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { readFolder } from '../folderReader.js';
import { EXCLUDED_NAMES } from '@arlo-doc/shared';
import type { FileNode } from '@arlo-doc/shared';

/**
 * Feature: folder-browser
 * Validates: Requirements REQ-003.2, REQ-003.3
 *
 * Property 3: HiddenFilter exclusion invariant
 * For any FileNode tree produced by FolderReader, no node anywhere in the tree
 * SHALL have a `name` starting with `.` or equal to an EXCLUDED_NAMES member.
 */

// Collect temp dirs for cleanup after each test
const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

/** Recursively collect every FileNode in the tree (including the root). */
function traverseAll(node: FileNode): FileNode[] {
  const result: FileNode[] = [node];
  for (const child of node.children) {
    result.push(...traverseAll(child));
  }
  return result;
}

/** Create a temp directory and return its absolute path. */
async function makeTempDir(): Promise<string> {
  const dir = join(tmpdir(), `arlo-test-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

/**
 * Valid entry name: non-empty, no path separators, no null bytes,
 * does NOT start with `.`, and is NOT in EXCLUDED_NAMES.
 */
const safeNameArb = fc
  .string({ minLength: 1, maxLength: 32 })
  .filter(
    (s) =>
      !s.startsWith('.') &&
      !s.includes('/') &&
      !s.includes('\\') &&
      !s.includes('\0') &&
      !(EXCLUDED_NAMES as readonly string[]).includes(s),
  );

/**
 * Entries to write: a mix of safe names, dot-prefixed names, and EXCLUDED_NAMES.
 * The property test creates these on disk and then verifies they are filtered out.
 */
const entryNamesArb = fc
  .tuple(
    // At least one safe name so the folder is never entirely empty
    fc.array(safeNameArb, { minLength: 1, maxLength: 5 }),
    // Zero or more dot-prefixed names (should be filtered).
    // Guard against the suffix being "." or ".." — ".${suffix}" would then be
    // ".." or "...", and writing "join(root, '..')" escapes into the parent
    // temp dir (EISDIR on the tmpdir itself).
    fc.array(
      fc
        .string({ minLength: 1, maxLength: 16 })
        .filter(
          (s) =>
            !s.includes('/') &&
            !s.includes('\\') &&
            !s.includes('\0') &&
            s !== '.' &&
            s !== '..',
        )
        .map((s) => `.${s}`),
      { minLength: 0, maxLength: 3 },
    ),
    // Zero or more EXCLUDED_NAMES members (should be filtered)
    fc.array(fc.constantFrom(...EXCLUDED_NAMES), { minLength: 0, maxLength: 2 }),
  )
  .map(([safe, hidden, excluded]) => ({ safe, hidden, excluded }));

describe('FolderReader – Property 3: HiddenFilter exclusion invariant', () => {
  /**
   * Validates: REQ-003.2 (hidden/dot-prefixed entries excluded)
   *            REQ-003.3 (EXCLUDED_NAMES directories excluded)
   */
  it('no node in the tree has a name starting with "." or matching EXCLUDED_NAMES', async () => {
    await fc.assert(
      fc.asyncProperty(entryNamesArb, async ({ safe, hidden, excluded }) => {
        const root = await makeTempDir();

        // Write safe entries as files
        for (const name of safe) {
          await writeFile(join(root, name), '');
        }

        // Write dot-prefixed entries as files (should be filtered)
        for (const name of hidden) {
          await writeFile(join(root, name), '');
        }

        // Write EXCLUDED_NAMES entries as directories (should be filtered)
        for (const name of excluded) {
          await mkdir(join(root, name), { recursive: true });
          // Put a file inside so FolderReader would descend if it didn't filter
          await writeFile(join(root, name, 'should-not-appear.txt'), '');
        }

        const tree = await readFolder(root);
        const allNodes = traverseAll(tree);

        // Skip the root node itself — its name is the temp dir basename, not filtered
        const nonRoot = allNodes.slice(1);

        for (const node of nonRoot) {
          expect(
            node.name.startsWith('.'),
            `Node "${node.name}" starts with '.' but should have been excluded`,
          ).toBe(false);

          expect(
            (EXCLUDED_NAMES as readonly string[]).includes(node.name),
            `Node "${node.name}" is in EXCLUDED_NAMES but should have been excluded`,
          ).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('files inside EXCLUDED_NAMES directories never appear in the tree', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...EXCLUDED_NAMES),
        fc.array(safeNameArb, { minLength: 1, maxLength: 4 }),
        async (excludedDir, fileNames) => {
          const root = await makeTempDir();

          // Create the excluded directory with files inside it
          const excludedPath = join(root, excludedDir);
          await mkdir(excludedPath, { recursive: true });
          for (const name of fileNames) {
            await writeFile(join(excludedPath, name), '');
          }

          // Also create one safe file at the root level to ensure tree is non-empty
          await writeFile(join(root, 'safe-file.txt'), '');

          const tree = await readFolder(root);
          const allNodes = traverseAll(tree);
          const allPaths = allNodes.map((n) => n.path);

          // No path should be inside the excluded directory
          for (const path of allPaths) {
            expect(
              path.startsWith(excludedPath),
              `Path "${path}" is inside excluded directory "${excludedDir}"`,
            ).toBe(false);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
