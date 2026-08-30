import type { GitStatus, GitCommit, WorktreeInfo } from "@arlo-doc/shared";

export interface GitBackend {
  clone(url: string, targetDir: string): Promise<void>;
  status(repoDir: string): Promise<GitStatus>;
  commit(repoDir: string, message: string, paths: string[]): Promise<GitCommit>;
  push(repoDir: string, remote?: string, branch?: string): Promise<void>;
  pull(repoDir: string, remote?: string, branch?: string): Promise<void>;
  diff(repoDir: string, filePath: string): Promise<string>;

  /** `git worktree add <worktreePath> -b <branch>` — creates a new worktree + branch. */
  worktreeAdd(repoDir: string, worktreePath: string, branch: string): Promise<void>;

  /** `git worktree remove --force <worktreePath>` — removes the worktree directory. */
  worktreeRemove(repoDir: string, worktreePath: string): Promise<void>;

  /** `git worktree list --porcelain` — lists all worktrees. */
  worktreeList(repoDir: string): Promise<WorktreeInfo[]>;

  /** Returns true if the worktree at `worktreePath` has uncommitted changes. */
  worktreeDirty(worktreePath: string): Promise<boolean>;

  /** `git -C <cwd> rev-parse --show-toplevel` — returns the absolute path to the repo root. */
  getRepoRoot(cwd: string): Promise<string>;

  /**
   * `git config --get <key>` resolved from within `repoDir`, so repository-local
   * config wins over global exactly as git itself resolves it.
   * Returns null when the key is unset — an unset identity is a normal state,
   * not an error.
   */
  getConfig(repoDir: string, key: string): Promise<string | null>;
}
