export interface WorktreeInfo {
  /** Absolute path of the worktree directory on disk. */
  path: string;
  /** Git branch name checked out in this worktree. */
  branch: string;
  /** SHA of HEAD commit. */
  head: string;
}
