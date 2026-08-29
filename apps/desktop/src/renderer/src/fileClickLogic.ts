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
 * Known text / code file extensions the app can open and preview.
 * Any file with no recognised extension that also has no binary signature
 * will be caught by the UTF-8 read in the main process anyway, but we
 * gate the UI here to avoid attempting to load images or compiled binaries.
 */
const TEXT_EXTENSIONS = new Set([
  // Documents
  '.md', '.mdx', '.txt', '.rst', '.adoc', '.tex',
  // Web
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  // Scripts / config
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.json', '.jsonc', '.json5',
  '.yaml', '.yml', '.toml', '.ini', '.env',
  '.xml', '.svg',
  // Systems / backend
  '.py', '.rb', '.php', '.java', '.kt', '.kts',
  '.go', '.rs', '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp',
  '.cs', '.swift', '.m', '.mm',
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
  // Data / query
  '.sql', '.graphql', '.gql', '.proto',
  // Config / infra
  '.dockerfile', '.tf', '.tfvars', '.hcl', '.nginx',
  '.gradle', '.cmake', '.makefile',
  // Misc text
  '.csv', '.log', '.diff', '.patch', '.lock',
  '.gitignore', '.gitattributes', '.editorconfig',
  '.eslintrc', '.prettierrc', '.babelrc',
]);

/**
 * Returns true for file paths that the app can open and preview.
 * Covers all common text, markup, and source-code file types.
 */
export function isSupportedFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const dotIdx = lower.lastIndexOf('.');
  if (dotIdx === -1) {
    // No extension — treat files like Makefile, Dockerfile, Jenkinsfile as text
    const basename = lower.split('/').pop() ?? lower;
    return ['makefile', 'dockerfile', 'jenkinsfile', 'gemfile', 'rakefile', 'procfile'].includes(basename);
  }
  const ext = lower.slice(dotIdx);
  return TEXT_EXTENSIONS.has(ext);
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
