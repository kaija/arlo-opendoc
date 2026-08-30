import type { StoreAdapter } from "./store/StoreAdapter.js";
import type { ForgeAdapter } from "./forge/ForgeAdapter.js";
import type { AgentKeyProvider } from "./agent/types.js";
import type { GitStatus } from "@arlo-doc/shared";
import type { GitBackend } from "./git/GitBackend.js";

export interface CoreEngineConfig {
  kbRoot: string;
  store: StoreAdapter;
  forge: ForgeAdapter;
  agentKeyProvider: AgentKeyProvider;
  git: GitBackend;
}

export class CoreEngine {
  constructor(private readonly config: CoreEngineConfig) {
    // Validate kbRoot is an absolute path
    if (!config.kbRoot.startsWith("/") && !config.kbRoot.match(/^[A-Z]:\\/)) {
      throw new Error("kbRoot must be an absolute path");
    }
  }

  // KB operations (stubs — implementation in Phase 2)
  async readDocument(_path: string): Promise<unknown> { throw new Error("not implemented"); }
  async writeDocument(_path: string, _content: string): Promise<unknown> { throw new Error("not implemented"); }
  async deleteDocument(_path: string): Promise<void> { throw new Error("not implemented"); }
  async searchDocuments(_query: string): Promise<unknown[]> { throw new Error("not implemented"); }

  // Git operations
  async gitClone(_url: string): Promise<void> { throw new Error("not implemented"); }
  async gitCommit(_message: string, _paths: string[]): Promise<unknown> { throw new Error("not implemented"); }
  async gitPush(): Promise<void> { throw new Error("not implemented"); }
  async gitPull(): Promise<void> { throw new Error("not implemented"); }
  async gitStatus(): Promise<GitStatus> {
    return this.config.git.status(this.config.kbRoot);
  }
  async gitDiff(filePath: string): Promise<string> {
    return this.config.git.diff(this.config.kbRoot, filePath);
  }

  // Agent
  async agentChat(_message: string): Promise<unknown> { throw new Error("not implemented"); }
  agentChatStream(_message: string): AsyncIterable<string> { throw new Error("not implemented"); }
}
