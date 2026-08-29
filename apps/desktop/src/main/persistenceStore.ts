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
  openWorktrees: PersistedWorktree[];
  activeTabId: string | null;
}

// Legacy internal shape — kept only to read old files that only have KiroState
interface LegacyState {
  lastFolderPath?: string | null;
}

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

  return { lastFolderPath, openWorktrees, activeTabId };
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
