import { spawn } from "node:child_process";
import type { GitBackend } from "./GitBackend.js";
import type { GitStatus, GitCommit } from "@arlo-doc/shared";

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
}
