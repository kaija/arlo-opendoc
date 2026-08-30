/**
 * Property-based tests for FolderReader
 *
 * Task 3.4 — Property 5: Max-depth bound (REQ-003.5)
 * Task 3.5 — CP-001: FileTree round-trip stability (REQ-003)
 */
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { readFolder } from './folderReader.js';
import type { FileNode } from '@arlo-doc/shared';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Create a unique temp directory and return its path. */
async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(join(tmpdir(), 'arlo-test-'));
}

/** Recursively remove a temp directory, swallowing errors. */
async function removeTmpDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

/**
 * Build a chain of nested directories `depth` levels deep under `root`,
 * writing one marker file at each level.
 *
 * @returns the path of the deepest directory created
 */
async function buildNested(root: string, depth: number): Promise<string> {
  let current = root;
  for (let i = 0; i < depth; i++) {
    current = join(current, `level${i}`);
    await fs.mkdir(current);
    await fs.writeFile(join(current, `file${i}.txt`), `depth ${i}`);
  }
  return current;
}

/**
 * Return the maximum depth of any node reachable from `node`.
 * Root is depth 0.
 */
function maxDepth(node: FileNode, currentDepth = 0): number {
  if (node.children.length === 0) return currentDepth;
  return Math.max(...node.children.map((c) => maxDepth(c, currentDepth + 1)));
}

/**
 * Build an arbitrary directory tree under `root` from a spec:
 *   entries: Array<{ name: string; isDir: boolean; children?: EntrySpec[] }>
 * Skips names that start with '.' or are in EXCLUDED_NAMES — those would be
 * filtered by readFolder anyway and we want predictable trees.
 */
interface EntrySpec {
  name: string;
  isDir: boolean;
  children: EntrySpec[];
}

async function buildTree(root: string, entries: EntrySpec[]): Promise<void> {
  for (const entry of entries) {
    // Normalise: strip leading dots and excluded names so the tree we write is
    // exactly what readFolder will return (keeps round-trip comparison simple).
    if (entry.name.startsWith('.')) continue;
    const excluded = ['node_modules', 'dist', 'out', '.git', '.turbo'];
    if (excluded.includes(entry.name)) continue;
    // Ensure the name is non-empty after sanitisation
    if (!entry.name.trim()) continue;

    const entryPath = join(root, entry.name);
    if (entry.isDir) {
      await fs.mkdir(entryPath, { recursive: true });
      await buildTree(entryPath, entry.children);
    } else {
      await fs.writeFile(entryPath, entry.name);
    }
  }
}

// ─── fast-check arbitraries ──────────────────────────────────────────────────

/**
 * Arbitrary safe file/directory name: printable ASCII, no path separators,
 * no leading dot, no excluded names.
 */
const excluded = new Set(['node_modules', 'dist', 'out', '.git', '.turbo']);

const safeNameArb = fc
  .stringOf(
    fc.mapToConstant(
      { num: 26, build: (i) => String.fromCharCode(97 + i) }, // a-z
      { num: 26, build: (i) => String.fromCharCode(65 + i) }, // A-Z
      { num: 10, build: (i) => String.fromCharCode(48 + i) }, // 0-9
      { num: 3, build: (i) => ['_', '-', '+'][i]! },           // safe symbols
    ),
    { minLength: 1, maxLength: 20 },
  )
  .filter((n) => !excluded.has(n) && !n.startsWith('.'));

const entrySpecArb: fc.Arbitrary<EntrySpec> = fc.record({
  name: safeNameArb,
  isDir: fc.boolean(),
  children: fc.constant([] as EntrySpec[]), // leaf only; deep nesting via buildNested
});

// ─── Task 3.4 — Property 5: Max-depth bound ──────────────────────────────────

describe('Property 5: Max-depth bound (REQ-003.5)', () => {
  it('no node is reachable at depth > 10 for deeply nested real directories', async () => {
    // Build a chain 13 levels deep (well beyond MAX_DEPTH = 10)
    const root = await makeTmpDir();
    try {
      await buildNested(root, 13);
      const tree = await readFolder(root);
      const depth = maxDepth(tree);
      // Root is depth 0; children of root are depth 1; MAX_DEPTH cuts at depth 10
      expect(depth).toBeLessThanOrEqual(10);
    } finally {
      await removeTmpDir(root);
    }
  });

  it('property: for any deeply nested structure, no node in the tree exceeds depth 10', async () => {
    // **Validates: Requirements REQ-003.5**
    await fc.assert(
      fc.asyncProperty(
        // Generate a chain depth from 11–15 (always exceeds MAX_DEPTH)
        fc.integer({ min: 11, max: 15 }),
        async (chainDepth) => {
          const root = await makeTmpDir();
          try {
            await buildNested(root, chainDepth);
            const tree = await readFolder(root);
            const depth = maxDepth(tree);
            return depth <= 10;
          } finally {
            await removeTmpDir(root);
          }
        },
      ),
      { numRuns: 10 }, // each run creates real FS structures; 10 is sufficient
    );
  });

  it('nodes at exactly depth 10 are included but have no children', async () => {
    // Build exactly 10 levels deep (the last level should appear with children: [])
    const root = await makeTmpDir();
    try {
      await buildNested(root, 10);
      const tree = await readFolder(root);
      const depth = maxDepth(tree);
      // The chain has 10 levels of dirs below root → max reachable depth is 10
      expect(depth).toBe(10);
      // Walk to depth 10 and confirm children is []
      let node: FileNode = tree;
      for (let i = 0; i < 10; i++) {
        const nextDir = node.children.find((c) => c.kind === 'dir');
        expect(nextDir).toBeDefined();
        node = nextDir!;
      }
      // At depth 10 the node should have empty children (MAX_DEPTH cut-off)
      expect(node.children).toEqual([]);
    } finally {
      await removeTmpDir(root);
    }
  });
});

// ─── Task 3.5 — CP-001: FileTree round-trip stability ───────────────────────

describe('CP-001: FileTree round-trip stability (REQ-003)', () => {
  it('reading the same simple folder twice produces identical trees', async () => {
    const root = await makeTmpDir();
    try {
      await fs.writeFile(join(root, 'a.md'), 'hello');
      await fs.writeFile(join(root, 'b.txt'), 'world');
      await fs.mkdir(join(root, 'sub'));
      await fs.writeFile(join(root, 'sub', 'c.ts'), 'code');

      const [t1, t2] = await Promise.all([readFolder(root), readFolder(root)]);
      expect(t1).toEqual(t2);
    } finally {
      await removeTmpDir(root);
    }
  });

  it('property: any generated folder tree reads identically on two consecutive calls', async () => {
    // **Validates: Requirements REQ-003**
    await fc.assert(
      fc.asyncProperty(
        // Generate 1–8 top-level entries; keep shallow to avoid slow FS operations
        fc.array(entrySpecArb, { minLength: 1, maxLength: 8 }),
        async (entries) => {
          // De-duplicate names within the same directory to avoid FS conflicts.
          // Case-insensitive, because macOS/APFS is case-insensitive: "Ab" and
          // "aB" resolve to one entry there, so a case-sensitive de-dupe lets
          // buildTree try to create both (e.g. a file where a dir already
          // exists → EISDIR).
          const seen = new Set<string>();
          const unique = entries.filter((e) => {
            const key = e.name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          if (unique.length === 0) return true;

          const root = await makeTmpDir();
          try {
            await buildTree(root, unique);
            const [t1, t2] = await Promise.all([readFolder(root), readFolder(root)]);
            // Deep equality: same shape, same paths, same ordering
            expect(t1).toEqual(t2);
            return true;
          } finally {
            await removeTmpDir(root);
          }
        },
      ),
      { numRuns: 20 },
    );
  });

  it('round-trip is stable even with nested subdirectories', async () => {
    const root = await makeTmpDir();
    try {
      await fs.mkdir(join(root, 'docs'));
      await fs.mkdir(join(root, 'src'));
      await fs.writeFile(join(root, 'README.md'), '# hello');
      await fs.writeFile(join(root, 'docs', 'guide.md'), 'guide');
      await fs.writeFile(join(root, 'src', 'index.ts'), 'export {}');
      await fs.mkdir(join(root, 'src', 'utils'));
      await fs.writeFile(join(root, 'src', 'utils', 'helpers.ts'), '// helpers');

      const t1 = await readFolder(root);
      const t2 = await readFolder(root);
      expect(t1).toEqual(t2);
    } finally {
      await removeTmpDir(root);
    }
  });
});
