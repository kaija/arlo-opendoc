import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { FileNode } from '@arlo-doc/shared';
import { EXCLUDED_NAMES } from '@arlo-doc/shared';
import { readFolder } from '../folderReader.js';

/**
 * Feature: folder-browser
 * Property 4: Tree sort invariant
 * Validates: Requirements REQ-003.4
 *
 * For every FileNode of kind: 'dir' in a tree produced by readFolder,
 * the children array satisfies:
 *   1. All dirs come before all files.
 *   2. Within the dirs group, names are in case-insensitive ascending order.
 *   3. Within the files group, names are in case-insensitive ascending order.
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Collect every dir node in the tree (breadth-first). */
function allDirNodes(root: FileNode): FileNode[] {
  const result: FileNode[] = [];
  const queue: FileNode[] = [root];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.kind === 'dir') {
      result.push(node);
      queue.push(...node.children);
    }
  }
  return result;
}

/**
 * Compare two names exactly as folderReader.ts does (case-insensitive
 * `localeCompare`). The hand-rolled invariant below must use the *same*
 * collation as the implementation — a plain `>` compares by code point, which
 * disagrees with `localeCompare` on punctuation (e.g. "-" vs "_"), so a
 * code-point check spuriously fails on names like "w-" / "w_".
 */
const nameCmp = (a: string, b: string): number =>
  a.toLowerCase().localeCompare(b.toLowerCase());

/** Assert the sort invariant for a single dir node's children. */
function assertSortInvariant(node: FileNode): void {
  const children = node.children;

  // Find the index of the first file (if any)
  const firstFileIdx = children.findIndex((c) => c.kind === 'file');

  if (firstFileIdx === -1) {
    // All children are dirs — verify dir order
    for (let i = 1; i < children.length; i++) {
      if (nameCmp(children[i - 1]!.name, children[i]!.name) > 0) {
        throw new Error(
          `Dir-only children of "${node.name}" are not in case-insensitive order: ` +
            `"${children[i - 1]!.name}" before "${children[i]!.name}"`,
        );
      }
    }
    return;
  }

  // Every child after the first file must also be a file (no dir after a file)
  for (let i = firstFileIdx + 1; i < children.length; i++) {
    if (children[i]!.kind === 'dir') {
      throw new Error(
        `Dir "${children[i]!.name}" appears after a file in children of "${node.name}". ` +
          `Dirs must come before files.`,
      );
    }
  }

  const dirs = children.slice(0, firstFileIdx);
  const files = children.slice(firstFileIdx);

  // Dirs sub-array: case-insensitive ascending
  for (let i = 1; i < dirs.length; i++) {
    if (nameCmp(dirs[i - 1]!.name, dirs[i]!.name) > 0) {
      throw new Error(
        `Dirs in "${node.name}" are not sorted: "${dirs[i - 1]!.name}" before "${dirs[i]!.name}"`,
      );
    }
  }

  // Files sub-array: case-insensitive ascending
  for (let i = 1; i < files.length; i++) {
    if (nameCmp(files[i - 1]!.name, files[i]!.name) > 0) {
      throw new Error(
        `Files in "${node.name}" are not sorted: "${files[i - 1]!.name}" before "${files[i]!.name}"`,
      );
    }
  }
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

/**
 * An entry name that is safe to use on disk:
 *   - At least 1 character, at most 30
 *   - Only alphanumeric, hyphen, underscore, dot (no leading dot so HiddenFilter never removes it)
 *   - First char is alphanumeric (avoids leading dot / hyphen issues)
 *   - Not a member of EXCLUDED_NAMES (so ExcludeFilter never removes it)
 *   - No null bytes
 */
const safeNameArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.char().filter((c) => /[a-zA-Z0-9]/.test(c)),
    fc.stringOf(
      fc.char().filter((c) => /[a-zA-Z0-9\-_.]/.test(c)),
      { minLength: 0, maxLength: 29 },
    ),
  )
  .map(([first, rest]) => first + rest)
  .filter((name) => !(EXCLUDED_NAMES as readonly string[]).includes(name));

/**
 * A flat directory layout: an array of { name, isDir } entries.
 * We allow duplicate names after lower-casing on purpose — the OS de-dupes them
 * when creating files, so we deduplicate by case-insensitive name ourselves.
 */
const entryListArb: fc.Arbitrary<Array<{ name: string; isDir: boolean }>> = fc
  .array(
    fc.record({ name: safeNameArb, isDir: fc.boolean() }),
    { minLength: 0, maxLength: 20 },
  )
  .map((entries) => {
    // De-duplicate by case-insensitive name to avoid OS-level conflicts
    const seen = new Set<string>();
    return entries.filter(({ name }) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

// ─── Test ────────────────────────────────────────────────────────────────────

describe('FolderReader — Property 4: Tree sort invariant', () => {
  /**
   * Validates: Requirements REQ-003.4
   *
   * For any generated directory with a mix of file and subdirectory entries,
   * readFolder must return a tree where every dir node's children satisfy:
   *   dirs-before-files, and case-insensitive alpha order within each group.
   */
  it('Property 4: every dir node children are dirs-first then files, each group in case-insensitive alpha order', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Two levels: root entries + one subdirectory's entries
        entryListArb,
        entryListArb,
        async (rootEntries, subEntries) => {
          const tmp = await mkdtemp(join(tmpdir(), 'arlo-sort-test-'));
          try {
            // Create root-level entries
            for (const { name, isDir } of rootEntries) {
              const p = join(tmp, name);
              if (isDir) {
                await mkdir(p, { recursive: true });
              } else {
                await writeFile(p, '');
              }
            }

            // Pick the first subdir (if any) and populate it
            const firstSubDir = rootEntries.find((e) => e.isDir);
            if (firstSubDir) {
              for (const { name, isDir } of subEntries) {
                const p = join(tmp, firstSubDir.name, name);
                if (isDir) {
                  await mkdir(p, { recursive: true });
                } else {
                  await writeFile(p, '');
                }
              }
            }

            const tree = await readFolder(tmp);

            // Check sort invariant on every dir node (root + all descendants)
            for (const dirNode of allDirNodes(tree)) {
              assertSortInvariant(dirNode);
            }
          } finally {
            await rm(tmp, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
