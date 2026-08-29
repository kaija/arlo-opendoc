/**
 * Pure utility for deriving the git status map shown in FileBrowser.
 *
 * Extracted from App.tsx so it can be unit-tested outside a React environment.
 */

import path from 'path-browserify';
import type { GitStatus } from '@arlo-doc/shared';

/**
 * Maps each GitStatusFile status string to the single display letter.
 *
 * Design table:
 *   modified  → "M"
 *   renamed   → "M"
 *   added     → "A"
 *   untracked → "A"
 *   deleted   → "D"
 */
const STATUS_LETTER: Record<string, string> = {
  modified: 'M',
  renamed: 'M',
  added: 'A',
  untracked: 'A',
  deleted: 'D',
};

/**
 * Derives a `Map<absolutePath, letter>` from the given `GitStatus` object.
 *
 * @param gitStatus - The current git status for the open folder.
 * @param folderPath - The absolute root path of the open folder.
 * @returns A map of absolute file paths to single-letter status codes.
 */
export function deriveGitStatusMap(
  gitStatus: GitStatus | null,
  folderPath: string | null,
): Map<string, string> {
  if (!gitStatus || !folderPath) return new Map();

  const map = new Map<string, string>();
  for (const file of gitStatus.files) {
    const abs = path.join(folderPath, file.path);
    const letter = STATUS_LETTER[file.status] ?? 'M';
    map.set(abs, letter);
  }
  return map;
}
