import type {
  KbDocument,
  SearchQuery,
  SearchResult,
  ChatMessage,
  GitStatus,
  GitCommit,
  FileNode,
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
  /** Reads a folder recursively and returns the FileNode tree. */
  readFolder(folderPath: string): Promise<KbResult<FileNode>>;
  /** Returns the last successfully opened folder path, or null if none stored. */
  getLastFolder(): Promise<KbResult<string | null>>;
  /** Returns the UTF-8 text content of the file at filePath. */
  readFile(filePath: string): Promise<KbResult<string>>;
  /** Writes UTF-8 text content to the file at filePath (creates or overwrites). */
  writeFile(filePath: string, content: string): Promise<KbResult<void>>;
  /** Returns the unified diff string for filePath relative to HEAD. */
  gitDiff(filePath: string): Promise<KbResult<string>>;
  /** Opens a URL in the system default browser. */
  openExternal(url: string): Promise<KbResult<void>>;
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
