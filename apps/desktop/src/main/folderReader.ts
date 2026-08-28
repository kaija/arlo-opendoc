import { promises as fs, Dirent } from 'node:fs';
import { join } from 'node:path';
import type { FileNode } from '@arlo-doc/shared';
import { EXCLUDED_NAMES } from '@arlo-doc/shared';

const MAX_DEPTH = 10;

/**
 * Reads folderPath recursively up to MAX_DEPTH levels deep.
 * Hidden entries (name starts with '.') and EXCLUDED_NAMES directories are skipped.
 * Permission errors on individual entries are caught; the entry is appended to
 * root.skippedPaths and processing continues with siblings.
 */
export async function readFolder(folderPath: string): Promise<FileNode> {
  const root: FileNode = {
    name: folderPath.split('/').pop() ?? folderPath,
    path: folderPath,
    kind: 'dir',
    children: [],
    skippedPaths: [],
  };
  await readDirInto(root, folderPath, 0, root.skippedPaths);
  return root;
}

async function readDirInto(
  node: FileNode,
  dirPath: string,
  depth: number,
  skippedPaths: string[],
): Promise<void> {
  if (depth >= MAX_DEPTH) return; // children stay []

  let entries: Dirent[];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (err) {
    skippedPaths.push(dirPath);
    return;
  }

  const dirs: FileNode[] = [];
  const files: FileNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory() && (EXCLUDED_NAMES as readonly string[]).includes(entry.name)) continue;

    const entryPath = join(dirPath, entry.name);
    const child: FileNode = {
      name: entry.name,
      path: entryPath,
      kind: entry.isDirectory() ? 'dir' : 'file',
      children: [],
      skippedPaths: [],
    };

    try {
      if (entry.isDirectory()) {
        await readDirInto(child, entryPath, depth + 1, skippedPaths);
        dirs.push(child);
      } else {
        files.push(child);
      }
    } catch (err) {
      skippedPaths.push(entryPath);
    }
  }

  // Sort: dirs first (case-insensitive alpha), then files (case-insensitive alpha)
  const cmp = (a: FileNode, b: FileNode) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  dirs.sort(cmp);
  files.sort(cmp);

  node.children = [...dirs, ...files];
}
