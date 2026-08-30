import { z } from "zod";

/**
 * Per-repository session record, stored at `<repo>/.arlo/session.json`.
 *
 * This — not global app state — is the source of truth for which draft
 * worktrees a repository has open and which tab was focused. It lives inside
 * the repo so every repository remembers its own sessions independently, and
 * the app can ask "which repo?" on every launch without anyone losing their
 * place.
 *
 * The file records absolute, machine-local worktree paths, so it is gitignored
 * (see the desktop app's worktreeLayout.ts) — it is per-checkout state, never
 * shared team configuration.
 */

export const RepoSessionWorktreeSchema = z
  .object({
    /** Stable id, reused across restarts so the focused tab can be restored. */
    id: z.string().min(1),
    /** Tab display name — "Untitled" until set by the user or the agent. */
    title: z.string(),
    /** Absolute path of the worktree root on disk. */
    worktreePath: z.string().min(1),
    branch: z.string(),
    /** True for the repo's own root tab, which is not a throwaway worktree. */
    isMainTab: z.boolean().optional(),
    /**
     * Reserved for future AI session history: the id of the agent conversation
     * bound to this worktree. Optional and nullable so today's build writes it
     * as absent and a later build can populate it without a schema bump.
     */
    aiSessionId: z.string().nullish(),
  })
  // Unknown keys round-trip untouched, so a newer build's fields survive a
  // save by an older one.
  .passthrough();
export type RepoSessionWorktree = z.infer<typeof RepoSessionWorktreeSchema>;

/** Bumped only for a change a migration must handle. */
export const REPO_SESSION_VERSION = 1;

export const RepoSessionSchema = z
  .object({
    version: z.number().int().default(REPO_SESSION_VERSION),
    /** The repo root this record describes — a guard against a stale copy. */
    repoPath: z.string().default(""),
    /** Id of the worktree tab that was focused, or null. */
    activeTabId: z.string().nullable().default(null),
    /** ISO-8601 timestamp of the last write, used to order the recent list. */
    updatedAt: z.string().nullable().default(null),
    worktrees: z.array(RepoSessionWorktreeSchema).default([]),
  })
  .passthrough();
export type RepoSession = z.infer<typeof RepoSessionSchema>;

/**
 * A recent-repository entry for the start screen. Assembled in the main process
 * from the global recent list plus each repo's session file; the renderer only
 * reads it.
 */
export interface RecentRepoSummary {
  /** Absolute path of the repo root. */
  path: string;
  /** Last path segment, for display. */
  name: string;
  /** Draft worktrees the repo has recorded (its root tab is not counted). */
  worktreeCount: number;
  /** ISO-8601 timestamp, or null when the repo has no session file yet. */
  lastOpenedAt: string | null;
}

/** A fresh, empty session for a repository that has none on disk. */
export function defaultRepoSession(repoPath: string): RepoSession {
  return RepoSessionSchema.parse({ repoPath });
}
