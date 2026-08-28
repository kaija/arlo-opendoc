import type {
  KbDocument,
  SearchQuery,
  SearchResult,
  ChatMessage,
  GitStatus,
  GitCommit,
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
}

// ── Window augmentation ────────────────────────────────────────────────────
// Exposes the preload-injected ClientInterface on window.arlodoc in renderer code.

declare global {
  interface Window {
    arlodoc: ClientInterface;
  }
}
