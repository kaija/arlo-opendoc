/**
 * Pure async logic for handling a file click.
 *
 * Extracted from App.tsx so it can be unit-tested outside a React environment.
 * The React component wires `activeTabId`, `latestFileRef`, `updateTabState`,
 * and `window.arlodoc` to this function.
 */

import type { WorktreeTabState } from './types';
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

/** Updater that patches a single tab's state by its ID. */
export type TabStateUpdater = (tabId: string, patch: Partial<WorktreeTabState>) => void;

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
 *
 * All state updates go into `tabStates[activeTabId]` via `updateTabState`.
 */
export async function handleFileClickLogic(
  filePath: string,
  activeTabId: string,
  latestRef: LatestFileRef,
  updateTabState: TabStateUpdater,
  deps: FileClickDeps,
): Promise<void> {
  if (!isSupportedFile(filePath)) return;

  latestRef.current = filePath;
  updateTabState(activeTabId, { fileLoading: true, activeFilePath: filePath });

  const [contentResult, statusResult, diffResult] = await Promise.all([
    deps.readFile(filePath),
    deps.gitStatus(),
    deps.gitDiff(filePath),
  ]);

  // Race-condition guard: discard stale results
  if (latestRef.current !== filePath) return;

  if (!contentResult.ok) {
    updateTabState(activeTabId, { fileLoading: false, activeFilePath: null, fileContent: null });
    return;
  }

  updateTabState(activeTabId, {
    fileLoading: false,
    fileContent: contentResult.data,
    savedContent: contentResult.data,
    ...(statusResult.ok ? { gitStatus: statusResult.data } : {}),
    ...(diffResult.ok ? { fileDiff: diffResult.data } : {}),
  });
}
