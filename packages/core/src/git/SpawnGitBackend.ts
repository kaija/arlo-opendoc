import { spawn } from "node:child_process";
import { dirname } from "node:path";
import type { GitBackend } from "./GitBackend.js";
import type { GitStatus, GitCommit, WorktreeInfo } from "@arlo-doc/shared";

// Derive GitStatusFile from the GitStatus type to avoid adding an export to @kb/shared
type GitStatusFile = GitStatus["files"][number];

/**
 * Runs a git command and resolves with stdout on exit code 0,
 * rejects with stderr on non-zero exit.
 */
function runGit(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `git ${args[0]} exited with code ${code}`));
      }
    });

    proc.on("error", reject);
  });
}

/**
 * Parses the output of `git worktree list --porcelain` into `WorktreeInfo[]`.
 *
 * Porcelain format (one block per worktree, blank line between blocks):
 *   worktree /absolute/path
 *   HEAD <sha>
 *   branch refs/heads/<name>   (or "detached" for detached HEAD)
 */
function parseWorktreeList(output: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];
  const blocks = output.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    let path = "";
    let head = "";
    let branch = "";

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        path = line.slice("worktree ".length).trim();
      } else if (line.startsWith("HEAD ")) {
        head = line.slice("HEAD ".length).trim();
      } else if (line.startsWith("branch ")) {
        const ref = line.slice("branch ".length).trim();
        branch = ref.replace(/^refs\/heads\//, "");
      } else if (line === "detached") {
        branch = "(detached)";
      }
    }

    if (path) {
      worktrees.push({ path, branch, head });
    }
  }

  return worktrees;
}

export class SpawnGitBackend implements GitBackend {
  async clone(url: string, targetDir: string): Promise<void> {
    await runGit(["clone", url, targetDir]);
  }

  async status(repoDir: string): Promise<GitStatus> {
    const branchOutput = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], repoDir);
    const branch = branchOutput.trim();

    // Get ahead/behind counts relative to upstream
    let ahead = 0;
    let behind = 0;
    try {
      const countOutput = await runGit(
        ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
        repoDir,
      );
      const parts = countOutput.trim().split(/\s+/);
      ahead = parseInt(parts[0] ?? "0", 10) || 0;
      behind = parseInt(parts[1] ?? "0", 10) || 0;
    } catch {
      // No upstream configured; leave counts at 0
    }

    // Get file status via porcelain v1
    const statusOutput = await runGit(["status", "--porcelain"], repoDir);
    const files: GitStatusFile[] = [];

    for (const line of statusOutput.split("\n")) {
      if (!line.trim()) continue;

      const xy = line.substring(0, 2);
      const rest = line.substring(3).trim();

      let fileStatus: GitStatusFile["status"];
      let filePath: string;
      let oldPath: string | undefined;

      if (xy[0] === "R" || xy[1] === "R") {
        fileStatus = "renamed";
        // porcelain v1 rename format: "old -> new"
        const arrowIdx = rest.indexOf(" -> ");
        if (arrowIdx !== -1) {
          oldPath = rest.substring(0, arrowIdx);
          filePath = rest.substring(arrowIdx + 4);
        } else {
          filePath = rest;
        }
      } else if (xy === "??") {
        fileStatus = "untracked";
        filePath = rest;
      } else if (xy[0] === "A" || xy[1] === "A") {
        fileStatus = "added";
        filePath = rest;
      } else if (xy[0] === "D" || xy[1] === "D") {
        fileStatus = "deleted";
        filePath = rest;
      } else {
        fileStatus = "modified";
        filePath = rest;
      }

      const entry: GitStatusFile = { path: filePath, status: fileStatus };
      if (oldPath !== undefined) {
        entry.oldPath = oldPath;
      }
      files.push(entry);
    }

    return { branch, ahead, behind, files };
  }

  async commit(repoDir: string, message: string, paths: string[]): Promise<GitCommit> {
    if (paths.length > 0) {
      await runGit(["add", "--", ...paths], repoDir);
    }
    await runGit(["commit", "-m", message], repoDir);

    // Read back the commit details
    const logOutput = await runGit(["log", "-1", "--format=%H%n%s%n%an%n%aI"], repoDir);
    const [sha = "", commitMessage = "", author = "", timestamp = ""] = logOutput
      .trim()
      .split("\n");

    return {
      sha: sha.trim(),
      message: commitMessage.trim(),
      author: author.trim(),
      timestamp: timestamp.trim(),
    };
  }

  async push(repoDir: string, remote = "origin", branch?: string): Promise<void> {
    const args = branch ? ["push", remote, branch] : ["push", remote];
    await runGit(args, repoDir);
  }

  async pull(repoDir: string, remote = "origin", branch?: string): Promise<void> {
    const args = branch ? ["pull", remote, branch] : ["pull", remote];
    await runGit(args, repoDir);
  }

  async diff(repoDir: string, filePath: string): Promise<string> {
    return runGit(["diff", "HEAD", "--", filePath], repoDir);
  }

  // ── Worktree methods (implemented in tasks 2.2–2.5) ──────────────────────

  async worktreeAdd(repoDir: string, worktreePath: string, branch: string): Promise<void> {
    await runGit(["-C", repoDir, "worktree", "add", worktreePath, "-b", branch]);
  }

  async worktreeRemove(repoDir: string, worktreePath: string): Promise<void> {
    await runGit(["-C", repoDir, "worktree", "remove", "--force", worktreePath]);
  }

  async worktreeList(repoDir: string): Promise<WorktreeInfo[]> {
    const output = await runGit(["-C", repoDir, "worktree", "list", "--porcelain"]);
    return parseWorktreeList(output);
  }

  async worktreeDirty(worktreePath: string): Promise<boolean> {
    const output = await runGit(["-C", worktreePath, "status", "--porcelain"]);
    return output.trim().length > 0;
  }

  async getConfig(repoDir: string, key: string): Promise<string | null> {
    try {
      const value = (await runGit(["config", "--get", key], repoDir)).trim();
      return value === "" ? null : value;
    } catch {
      // `git config --get` exits 1 when the key is simply not set.
      return null;
    }
  }

  async getRepoRoot(cwd: string): Promise<string> {
    const output = await runGit(["-C", cwd, "rev-parse", "--show-toplevel"]);
    return output.trim();
  }

  async getMainRepoRoot(cwd: string): Promise<string> {
    // --git-common-dir returns the shared .git directory — the same value for
    // every worktree in the repo.  Its parent is always the main checkout root.
    // --show-toplevel returns the *worktree* directory, which is wrong for
    // linked worktrees when we need the main repo as the diff anchor.
    const commonDir = await runGit(
      ["-C", cwd, "rev-parse", "--path-format=absolute", "--git-common-dir"],
    );
    return dirname(commonDir.trim());
  }
}
