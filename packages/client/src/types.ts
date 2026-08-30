import type {
  KbDocument,
  SearchQuery,
  SearchResult,
  ChatMessage,
  GitStatus,
  GitCommit,
  FileNode,
  WorktreeInfo,
  SearchOptions,
  FileNameMatch,
  ContentMatch,
  AppSettings,
  KbSettings,
  SecretStatus,
  RepoSession,
  RecentRepoSummary,
} from "@arlo-doc/shared";

export type { RepoSession, RecentRepoSummary } from "@arlo-doc/shared";

// ── Error types ────────────────────────────────────────────────────────────

export type KbErrorCode =
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "CONFLICT"
  | "GIT_ERROR"
  | "AGENT_ERROR"
  | "CONTAINMENT_ERROR"
  | "AUTH_ERROR"
  | "TIMEOUT"
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
  /** @deprecated per-repo `<repo>/.arlo/session.json` now owns this. */
  openWorktrees: PersistedWorktreeEntry[];
  /** @deprecated see `openWorktrees`. */
  activeTabId: string | null;
  /** Absolute repo-root paths, most-recently-opened first. */
  recentRepos: string[];
}

// ── Settings types ─────────────────────────────────────────────────────────

/** One level deep per section — how the settings UI actually writes. */
export type SettingsPatch<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

/** Populates the About pane. Read-only, gathered in the main process. */
export interface AppInfo {
  version: string;
  electronVersion: string;
  platform: string;
  osVersion: string;
  /** Directory holding settings.json, secrets.json and logs. */
  userDataPath: string;
  /** False when the OS offers no encrypted storage; the UI must say so. */
  encryptionAvailable: boolean;
}

/** Result of verifying the stored Anthropic key against the API. */
export interface KeyCheckResult {
  valid: boolean;
  /** Human-readable reason when invalid. */
  message: string | null;
  /** ISO-8601 timestamp of the check. */
  checkedAt: string;
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
  /** Returns full persisted state: last folder, recent repos, and (deprecated) global worktrees. Paths are verified on disk — missing ones are dropped. */
  getPersistedState(): Promise<KbResult<PersistedClientState>>;
  /** @deprecated Global worktree persistence — use saveRepoSession. Still writes `lastFolderPath`. */
  saveState(state: PersistedClientState): Promise<KbResult<void>>;
  /** Records that a repository was opened: front of the recent list + last folder. Fire-and-forget safe. */
  noteRepoOpened(repoPath: string): Promise<KbResult<void>>;
  /** Start-screen summaries for the recently opened repositories, newest first. */
  getRecentRepos(): Promise<KbResult<RecentRepoSummary[]>>;
  /** Reads one repository's session record (`<repo>/.arlo/session.json`). Missing worktree paths are pruned. */
  readRepoSession(repoPath: string): Promise<KbResult<RepoSession>>;
  /** Persists one repository's session record. Fire-and-forget safe. */
  saveRepoSession(repoPath: string, session: RepoSession): Promise<KbResult<void>>;
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

  // Search operations
  /** Fuzzy file-name search against the active tab's in-memory FileNode tree. */
  searchFiles(
    repoDir: string,
    query: string,
    options: SearchOptions,
  ): Promise<KbResult<FileNameMatch[]>>;
  /** Full-text content search via ripgrep. */
  findInFiles(
    repoDir: string,
    query: string,
    options: SearchOptions,
  ): Promise<KbResult<ContentMatch[]>>;

  // ── Settings ─────────────────────────────────────────────────────────────
  /** Application-scope settings — theme, language, editor, agent, startup. */
  readAppSettings(): Promise<KbResult<AppSettings>>;
  /** Merges a patch into application settings and returns the stored result. */
  writeAppSettings(patch: SettingsPatch<AppSettings>): Promise<KbResult<AppSettings>>;
  /** Settings for one knowledge base, defaulted if never configured. */
  readKbSettings(repoPath: string): Promise<KbResult<KbSettings>>;
  /** Merges a patch into one knowledge base's settings. */
  writeKbSettings(
    repoPath: string,
    patch: SettingsPatch<KbSettings>,
  ): Promise<KbResult<KbSettings>>;
  /** Restores default preferences. Leaves credentials and documents alone. */
  resetPreferences(): Promise<KbResult<void>>;

  // ── Secrets ──────────────────────────────────────────────────────────────
  // There is deliberately no getter for a secret VALUE. The renderer learns
  // only whether one is set and a masked form of it; decryption happens in the
  // main process alone.
  /** Whether each credential is set, plus non-sensitive metadata. */
  getSecretStatus(): Promise<KbResult<SecretStatus>>;
  /** Stores the Anthropic API key, encrypted by the OS. */
  setAnthropicKey(key: string): Promise<KbResult<SecretStatus>>;
  /** Removes the stored Anthropic API key. */
  clearAnthropicKey(): Promise<KbResult<SecretStatus>>;
  /** Verifies the STORED key against the API; the key never crosses the wire. */
  testAnthropicKey(): Promise<KbResult<KeyCheckResult>>;
  /** Disconnects the GitHub account, dropping its token and metadata. */
  clearGithubToken(): Promise<KbResult<SecretStatus>>;
  /** Removes every stored credential. Deletes nothing on disk. */
  forgetCredentials(): Promise<KbResult<SecretStatus>>;

  // ── Agent instructions (committed ARLO.md at the repository root) ─────────
  /** Reads ARLO.md. Returns an empty string when the file does not exist. */
  readInstructions(repoPath: string): Promise<KbResult<string>>;
  /** Writes ARLO.md, creating it if needed. The change is committable. */
  writeInstructions(repoPath: string, content: string): Promise<KbResult<void>>;

  // ── About ────────────────────────────────────────────────────────────────
  /** Version, platform and paths for the About pane. */
  getAppInfo(): Promise<KbResult<AppInfo>>;
  /** Reveals settings.json in the OS file manager. */
  revealSettingsFile(): Promise<KbResult<void>>;
  /** Opens the log directory in the OS file manager. */
  openLogsFolder(): Promise<KbResult<void>>;
  /** Resolved git identity for a repo, as `git config` would report it. */
  getGitIdentity(repoPath: string): Promise<KbResult<{ name: string; email: string } | null>>;
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
