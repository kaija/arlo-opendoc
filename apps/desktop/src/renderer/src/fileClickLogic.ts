/**
 * Pure async logic for handling a file click.
 *
 * Extracted from App.tsx so it can be unit-tested outside a React environment.
 * The React component wires `latestFileRef.current`, `update`, and
 * `window.arlodoc` to this function.
 */

import type { AppState } from './types';
import type { GitStatus } from '@arlo-doc/shared';

/** Minimal result type matching KbResult<T> from @arlo-doc/client. */
type KbResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

/** Subset of ClientInterface consumed by the file-click handler. */
export interface FileClickDeps {
  readFile(filePath: string): Promise<KbResult<string>>;
  gitStatus(): Promise<KbResult<GitStatus>>;
  gitDiff(filePath: string): Promise<KbResult<string>>;
}

/** Mutable box that holds the most-recently-requested file path. */
export interface LatestFileRef {
  current: string | null;
}

/** State updater — only the fields touched by handleFileClick. */
export type StateUpdater = (patch: Partial<AppState>) => void;

/**
 * Returns true for file paths that the app can open and preview.
 */
export function isSupportedFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('.mdx') || lower.endsWith('.txt');
}

/**
 * Core logic of handleFileClick, extracted for testability.
 *
 * Behaviour:
 * 1. Ignores unsupported file extensions immediately.
 * 2. Stamps `latestRef.current` with `filePath` and marks loading.
 * 3. Fires `readFile`, `gitStatus`, and `gitDiff` concurrently via Promise.all.
 * 4. Discards results if another file was opened (race-condition guard).
 * 5. On read failure: clears loading + activeFilePath + fileContent.
 * 6. On read success: stores content; merges gitStatus / fileDiff if ok.
 */
export async function handleFileClickLogic(
  filePath: string,
  latestRef: LatestFileRef,
  update: StateUpdater,
  deps: FileClickDeps,
): Promise<void> {
  if (!isSupportedFile(filePath)) return;

  latestRef.current = filePath;
  update({ fileLoading: true, activeFilePath: filePath });

  const [contentResult, statusResult, diffResult] = await Promise.all([
    deps.readFile(filePath),
    deps.gitStatus(),
    deps.gitDiff(filePath),
  ]);

  // Race-condition guard: discard stale results
  if (latestRef.current !== filePath) return;

  if (!contentResult.ok) {
    update({ fileLoading: false, activeFilePath: null, fileContent: null });
    return;
  }

  update({
    fileLoading: false,
    fileContent: contentResult.data,
    ...(statusResult.ok ? { gitStatus: statusResult.data } : {}),
    ...(diffResult.ok ? { fileDiff: diffResult.data } : {}),
  });
}
