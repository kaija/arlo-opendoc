import type {
  KbDocument,
  SearchQuery,
  SearchResult,
  ChatMessage,
  GitStatus,
  GitCommit,
  FileNode,
  WorktreeInfo,
} from "@arlo-doc/shared";

// ── Error types ────────────────────────────────────────────────────────────

export type KbErrorCode =
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "CONFLICT"
  | "GIT_ERROR"
  | "AGENT_ERROR"
  | "CONTAINMENT_ERROR"
  | "AUTH_ERROR"
  | "UNKNOWN";

export interface KbError {
  code: KbErrorCode;
  message: string;
  details?: unknown;
}

export type KbResult<T> = { ok: true; data: T } | { ok: false; error: KbError };

// ── Persistence types ──────────────────────────────────────────────────────
// Mirror of PersistedState in apps/desktop/src/main/persistenceStore.ts.
// Kept in the client package so the renderer can type-check IPC calls without
// importing from the main-process module.

export interface PersistedWorktreeEntry {
  id: string;
  title: string;
  worktreePath: string;
  branch: string;
  isMainTab?: boolean;
}

export interface PersistedClientState {
  lastFolderPath: string | null;
  openWorktrees: PersistedWorktreeEntry[];
  activeTabId: string | null;
}

// ── ClientInterface ────────────────────────────────────────────────────────

export interface ClientInterface {
  // KB document operations
  readDocument(path: string): Promise<KbResult<KbDocument>>;
  writeDocument(path: string, content: string): Promise<KbResult<KbDocument>>;
  deleteDocument(path: string): Promise<KbResult<void>>;
  searchDocuments(query: SearchQuery): Promise<KbResult<SearchResult[]>>;

  // Git operations
  gitClone(url: string): Promise<KbResult<void>>;
  gitCommit(message: string, paths: string[]): Promise<KbResult<GitCommit>>;
  gitPush(): Promise<KbResult<void>>;
  gitPull(): Promise<KbResult<void>>;
  gitStatus(): Promise<KbResult<GitStatus>>;

  // Agent — single turn
  agentChat(message: string): Promise<KbResult<ChatMessage>>;

  // Agent — streaming
  agentChatStream(message: string): AsyncIterable<KbResult<string>>;

  // Folder browser
  /** Opens the OS native folder picker. Returns null when the user cancels. */
  chooseFolder(): Promise<KbResult<string | null>>;
  /** Reads a folder recursively and returns the FileNode tree. Pass showHidden=true to include dot-prefixed entries. */
  readFolder(folderPath: string, showHidden?: boolean): Promise<KbResult<FileNode>>;
  /** Returns the last successfully opened folder path, or null if none stored. */
  getLastFolder(): Promise<KbResult<string | null>>;
  /** Returns full persisted state: last folder, open worktrees, and active tab id. Worktree paths are verified on disk — missing ones are dropped. */
  getPersistedState(): Promise<KbResult<PersistedClientState>>;
  /** Persists the full app state (tabs + active tab + last folder). Fire-and-forget safe. */
  saveState(state: PersistedClientState): Promise<KbResult<void>>;
  /** Returns the UTF-8 text content of the file at filePath. */
  readFile(filePath: string): Promise<KbResult<string>>;
  /** Writes UTF-8 text content to the file at filePath (creates or overwrites). */
  writeFile(filePath: string, content: string): Promise<KbResult<void>>;
  /** Returns the unified diff string for filePath relative to HEAD. */
  gitDiff(filePath: string): Promise<KbResult<string>>;
  /** Opens a URL in the system default browser. */
  openExternal(url: string): Promise<KbResult<void>>;

  // Worktree operations
  /** Creates a new git worktree + branch under repoDir. Returns path and branch info. */
  worktreeCreate(repoDir: string): Promise<KbResult<WorktreeInfo>>;
  /** Removes the worktree at worktreePath from repoDir. */
  worktreeDelete(repoDir: string, worktreePath: string): Promise<KbResult<void>>;
  /** Lists all worktrees in repoDir. */
  worktreeList(repoDir: string): Promise<KbResult<WorktreeInfo[]>>;
  /** Returns true if the worktree at worktreePath has uncommitted changes. */
  worktreeDirty(worktreePath: string): Promise<KbResult<boolean>>;
}

// ── Window augmentation ────────────────────────────────────────────────────
// Exposes the preload-injected ClientInterface on window.arlodoc in renderer code.

declare global {
  interface Window {
    arlodoc: ClientInterface;
    windowControls?: {
      /** Toggle the Electron window between maximized and normal state. */
      toggleMaximize: () => Promise<void>;
    };
  }
}
