export interface FileNode {
  /** Entry name (basename, not full path). */
  name: string;
  /** Absolute path on disk. */
  path: string;
  kind: 'file' | 'dir';
  /** For files: always []. For dirs: resolved children (empty when depth limit reached). */
  children: FileNode[];
  /**
   * Only meaningful on the root node returned by readFolder.
   * Absolute paths of entries that were skipped due to permission errors.
   */
  skippedPaths: string[];
}

export const EXCLUDED_NAMES = [
  'node_modules',
  'dist',
  'out',
  '.git',
  '.turbo',
] as const;
