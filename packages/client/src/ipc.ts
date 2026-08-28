import type { ClientInterface, KbError, KbResult } from "./types.js";
import type {
  KbDocument,
  SearchQuery,
  SearchResult,
  GitStatus,
  GitCommit,
  ChatMessage,
} from "@kb/shared";

// ── Ambient IPC declaration ────────────────────────────────────────────────
// The actual ipcRenderer is injected by the Electron preload bridge.
// This ambient declaration lets TypeScript understand its shape without
// importing the `electron` package (which is not allowed in packages/client).

declare const ipcRenderer: {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
};

// ── invoke helper ──────────────────────────────────────────────────────────

async function invoke<T>(channel: string, ...args: unknown[]): Promise<KbResult<T>> {
  try {
    const result = await ipcRenderer.invoke(channel, ...args);
    return { ok: true, data: result as T };
  } catch (err) {
    const raw = err as { kbError?: KbError; message?: string };
    if (raw?.kbError != null) {
      return { ok: false, error: raw.kbError };
    }
    return {
      ok: false,
      error: {
        code: "UNKNOWN",
        message: raw?.message ?? String(err),
      },
    };
  }
}

// ── Stream stub ────────────────────────────────────────────────────────────
// Full streaming implementation is in Phase 3.

async function* ipcStreamIterable(
  _channel: string,
  ..._args: unknown[]
): AsyncIterable<KbResult<string>> {
  throw new Error("not yet implemented");
}

// ── IPC binding ────────────────────────────────────────────────────────────

export const ipcBinding: ClientInterface = {
  readDocument: (path: string) =>
    invoke<KbDocument>("kb:readDocument", path),

  writeDocument: (path: string, content: string) =>
    invoke<KbDocument>("kb:writeDocument", path, content),

  deleteDocument: (path: string) =>
    invoke<void>("kb:deleteDocument", path),

  searchDocuments: (query: SearchQuery) =>
    invoke<SearchResult[]>("kb:searchDocuments", query),

  gitClone: (url: string) =>
    invoke<void>("kb:gitClone", url),

  gitCommit: (message: string, paths: string[]) =>
    invoke<GitCommit>("kb:gitCommit", message, paths),

  gitPush: () =>
    invoke<void>("kb:gitPush"),

  gitPull: () =>
    invoke<void>("kb:gitPull"),

  gitStatus: () =>
    invoke<GitStatus>("kb:gitStatus"),

  agentChat: (message: string) =>
    invoke<ChatMessage>("kb:agentChat", message),

  agentChatStream: (message: string) =>
    ipcStreamIterable("kb:agentChatStream", message),
};
