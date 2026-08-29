import type { GitStatus, GitCommit } from "@arlo-doc/shared";

export interface GitBackend {
  clone(url: string, targetDir: string): Promise<void>;
  status(repoDir: string): Promise<GitStatus>;
  commit(repoDir: string, message: string, paths: string[]): Promise<GitCommit>;
  push(repoDir: string, remote?: string, branch?: string): Promise<void>;
  pull(repoDir: string, remote?: string, branch?: string): Promise<void>;
  diff(repoDir: string, filePath: string): Promise<string>;
}
