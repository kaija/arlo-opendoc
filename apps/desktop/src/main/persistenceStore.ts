import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

// ── Persisted shape ────────────────────────────────────────────────────────

export interface PersistedWorktree {
  id: string;
  title: string;
  worktreePath: string;
  branch: string;
  isMainTab?: boolean;
}

export interface PersistedState {
  lastFolderPath: string | null;
  /**
   * @deprecated The per-repo `<repo>/.arlo/session.json` is now the source of
   * truth for a repository's open worktrees. These fields are still read so an
   * older file migrates cleanly, but new writes leave them empty.
   */
  openWorktrees: PersistedWorktree[];
  /** @deprecated see `openWorktrees`. */
  activeTabId: string | null;
  /** Absolute repo-root paths, most-recently-opened first. Capped and pruned. */
  recentRepos: string[];
}

// Legacy internal shape — kept only to read old files that only have KiroState
interface LegacyState {
  lastFolderPath?: string | null;
}

/** How many entries `recentRepos` keeps. */
export const RECENT_REPOS_MAX = 10;

function statePath(): string {
  return join(app.getPath('userData'), 'kiro-state.json');
}

// ── Read ───────────────────────────────────────────────────────────────────

/**
 * Returns the last persisted folder path — kept for backwards compatibility.
 * Prefer `getPersistedState` for new callers.
 */
export async function getLastFolder(): Promise<string | null> {
  try {
    const raw = await fs.readFile(statePath(), 'utf-8');
    const parsed = JSON.parse(raw) as LegacyState;
    return typeof parsed.lastFolderPath === 'string' ? parsed.lastFolderPath : null;
  } catch {
    // File not found, invalid JSON, or any other error: return null silently
    return null;
  }
}

/**
 * Returns the full persisted state, including open worktrees.
 *
 * Each worktree path is verified to still exist on disk via `fs.access`.
 * Paths that have been deleted since the last run are silently dropped (REQ-9.3).
 */
export async function getPersistedState(): Promise<PersistedState> {
  const empty: PersistedState = {
    lastFolderPath: null,
    openWorktrees: [],
    activeTabId: null,
    recentRepos: [],
  };

  let raw: PersistedState & LegacyState;
  try {
    const text = await fs.readFile(statePath(), 'utf-8');
    raw = JSON.parse(text) as PersistedState & LegacyState;
  } catch {
    return empty;
  }

  const lastFolderPath =
    typeof raw.lastFolderPath === 'string' ? raw.lastFolderPath : null;

  // recentRepos: keep only strings, dedupe (first wins), drop paths that no
  // longer exist on disk, and cap the list.
  const rawRecent = Array.isArray(raw.recentRepos) ? raw.recentRepos : [];
  const seen = new Set<string>();
  const candidates = rawRecent.filter(
    (p): p is string => typeof p === 'string' && p.length > 0 && !seen.has(p) && (seen.add(p), true),
  );
  const recentExists = await Promise.all(
    candidates.map(async (p) => {
      try {
        await fs.access(p);
        return p;
      } catch {
        return null;
      }
    }),
  );
  const recentRepos = recentExists
    .filter((p): p is string => p !== null)
    .slice(0, RECENT_REPOS_MAX);

  // Validate and filter the worktrees array — be defensive about corrupt data
  const rawWorktrees = Array.isArray(raw.openWorktrees) ? raw.openWorktrees : [];

  // Verify each path still exists on disk; drop missing ones silently
  const checkedWorktrees = await Promise.all(
    rawWorktrees.map(async (wt) => {
      if (
        typeof wt.id !== 'string' ||
        typeof wt.title !== 'string' ||
        typeof wt.worktreePath !== 'string' ||
        typeof wt.branch !== 'string'
      ) {
        return null; // malformed entry
      }
      try {
        await fs.access(wt.worktreePath);
        return wt as PersistedWorktree;
      } catch {
        return null; // path no longer exists on disk
      }
    }),
  );

  const openWorktrees = checkedWorktrees.filter(
    (wt): wt is PersistedWorktree => wt !== null,
  );

  // If the previously active tab was pruned, fall back to the first remaining one
  const validIds = new Set(openWorktrees.map((wt) => wt.id));
  const activeTabId =
    typeof raw.activeTabId === 'string' && validIds.has(raw.activeTabId)
      ? raw.activeTabId
      : (openWorktrees[0]?.id ?? null);

  return { lastFolderPath, openWorktrees, activeTabId, recentRepos };
}

/**
 * Records that a repository was just opened: moves it to the front of
 * `recentRepos` (deduped, capped) and points `lastFolderPath` at it. Merges
 * with the existing file so unrelated keys survive. Best-effort — a write
 * failure is logged, never thrown.
 */
export async function noteRepoOpened(repoPath: string): Promise<void> {
  if (typeof repoPath !== 'string' || repoPath.length === 0) return;
  const stateFile = statePath();
  const tmpFile = stateFile + '.tmp';
  try {
    let existing: Record<string, unknown> = {};
    try {
      existing = JSON.parse(await fs.readFile(stateFile, 'utf-8')) as Record<string, unknown>;
    } catch {
      // File absent or corrupt — start fresh
    }
    const prior = Array.isArray(existing['recentRepos'])
      ? (existing['recentRepos'] as unknown[]).filter(
          (p): p is string => typeof p === 'string' && p.length > 0 && p !== repoPath,
        )
      : [];
    const recentRepos = [repoPath, ...prior].slice(0, RECENT_REPOS_MAX);
    const next = { ...existing, lastFolderPath: repoPath, recentRepos };
    await fs.writeFile(tmpFile, JSON.stringify(next, null, 2), 'utf-8');
    await fs.rename(tmpFile, stateFile);
  } catch (err) {
    console.error('[PersistenceStore] Failed to record opened repo:', err);
    try {
      await fs.unlink(tmpFile);
    } catch {
      /* ignore cleanup error */
    }
  }
}

// ── Write ──────────────────────────────────────────────────────────────────

/**
 * Persists the full application state (worktrees + active tab + last folder).
 *
 * Uses a write-to-tmp-then-rename strategy for atomicity. Write failure is
 * silently logged and must never surface to the user (REQ-007.1).
 */
export async function saveState(state: PersistedState): Promise<void> {
  const stateFile = statePath();
  const tmpFile = stateFile + '.tmp';
  try {
    // Merge with any extra keys in the existing file to preserve forward-compat
    let existing: Record<string, unknown> = {};
    try {
      const raw = await fs.readFile(stateFile, 'utf-8');
      existing = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // File absent or corrupt — start fresh
    }
    const next = {
      ...existing,
      lastFolderPath: state.lastFolderPath,
      openWorktrees: state.openWorktrees,
      activeTabId: state.activeTabId,
    };
    await fs.writeFile(tmpFile, JSON.stringify(next, null, 2), 'utf-8');
    await fs.rename(tmpFile, stateFile); // atomic on all supported platforms
  } catch (err) {
    // Write failure must not surface to the user (REQ-007.1)
    console.error('[PersistenceStore] Failed to save state:', err);
    try {
      await fs.unlink(tmpFile);
    } catch {
      /* ignore cleanup error */
    }
  }
}

/**
 * Convenience wrapper — persists only the last folder path, keeping
 * other persisted fields intact. Kept for the `arlo-doc:readFolder` handler
 * which calls this fire-and-forget on every folder open.
 */
export async function saveLastFolder(folderPath: string | null): Promise<void> {
  const stateFile = statePath();
  const tmpFile = stateFile + '.tmp';
  try {
    let existing: Record<string, unknown> = {};
    try {
      const raw = await fs.readFile(stateFile, 'utf-8');
      existing = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // File absent or corrupt — start fresh
    }
    const next = { ...existing, lastFolderPath: folderPath };
    await fs.writeFile(tmpFile, JSON.stringify(next, null, 2), 'utf-8');
    await fs.rename(tmpFile, stateFile);
  } catch (err) {
    console.error('[PersistenceStore] Failed to save state:', err);
    try {
      await fs.unlink(tmpFile);
    } catch {
      /* ignore cleanup error */
    }
  }
}
