import { promises as fs } from "node:fs";
import { join } from "node:path";
import {
  RepoSessionSchema,
  type RepoSession,
  type RecentRepoSummary,
} from "@arlo-doc/shared";
import { ensureArloIgnored } from "./worktreeLayout.js";

/**
 * Reads and writes `<repo>/.arlo/session.json` — the per-repository record of
 * which draft worktrees are open and which tab was focused.
 *
 * It mirrors persistenceStore's philosophy: a missing or corrupt file yields an
 * empty session rather than an error, worktree entries whose directory has
 * vanished from disk are dropped on read, and every write is atomic
 * (tmp + rename) and best-effort — a failure is logged, never thrown.
 */

function sessionPath(repoRoot: string): string {
  return join(repoRoot, ".arlo", "session.json");
}

/**
 * Returns the session recorded for `repoRoot`, or an empty one when there is no
 * file yet. Worktree entries pointing at a directory that no longer exists are
 * pruned, and `activeTabId` is repaired if it pointed at a pruned entry.
 */
export async function readRepoSession(repoRoot: string): Promise<RepoSession> {
  const empty = RepoSessionSchema.parse({ repoPath: repoRoot });

  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(sessionPath(repoRoot), "utf-8"));
  } catch {
    return empty;
  }

  const parsed = RepoSessionSchema.safeParse(raw);
  const session = parsed.success ? parsed.data : empty;

  const checked = await Promise.all(
    session.worktrees.map(async (wt) => {
      try {
        await fs.access(wt.worktreePath);
        return wt;
      } catch {
        return null;
      }
    }),
  );
  const worktrees = checked.filter(
    (wt): wt is NonNullable<(typeof checked)[number]> => wt !== null,
  );

  const validIds = new Set(worktrees.map((wt) => wt.id));
  const activeTabId =
    session.activeTabId !== null && validIds.has(session.activeTabId)
      ? session.activeTabId
      : (worktrees[0]?.id ?? null);

  return { ...session, repoPath: repoRoot, worktrees, activeTabId };
}

/**
 * Persists `session` to `<repoRoot>/.arlo/session.json` and makes sure the file
 * is gitignored. `updatedAt` and `repoPath` are stamped here so callers cannot
 * forget them. Invalid input is refused (logged, not thrown).
 */
export async function writeRepoSession(
  repoRoot: string,
  session: RepoSession,
): Promise<void> {
  const parsed = RepoSessionSchema.safeParse(session);
  if (!parsed.success) {
    console.error(
      "[repoSessionStore] refusing to write invalid session:",
      parsed.error.message,
    );
    return;
  }

  const dir = join(repoRoot, ".arlo");
  const target = sessionPath(repoRoot);
  const tmp = `${target}.${process.pid}.tmp`;
  try {
    await fs.mkdir(dir, { recursive: true });
    const payload: RepoSession = {
      ...parsed.data,
      repoPath: repoRoot,
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf-8");
    await fs.rename(tmp, target); // atomic within a filesystem
    await ensureArloIgnored(repoRoot);
  } catch (err) {
    console.error("[repoSessionStore] failed to write session:", err);
    try {
      await fs.unlink(tmp);
    } catch {
      /* ignore cleanup error */
    }
  }
}

/**
 * Turns a list of recent repository paths into start-screen summaries, reading
 * each repo's session file for its draft count and last-opened time. A repo
 * whose directory has gone is omitted entirely.
 */
export async function summariseRecentRepos(
  paths: string[],
): Promise<RecentRepoSummary[]> {
  const summaries = await Promise.all(
    paths.map(async (path): Promise<RecentRepoSummary | null> => {
      try {
        await fs.access(path);
      } catch {
        return null;
      }
      const name = path.split("/").filter(Boolean).pop() ?? path;
      const session = await readRepoSession(path);
      return {
        path,
        name,
        worktreeCount: session.worktrees.filter((w) => !w.isMainTab).length,
        lastOpenedAt: session.updatedAt,
      };
    }),
  );
  return summaries.filter((s): s is RecentRepoSummary => s !== null);
}
