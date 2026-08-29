import type { ClientInterface, KbError, KbResult, PersistedClientState } from "./types.js";
import type {
  KbDocument,
  SearchQuery,
  SearchResult,
  GitStatus,
  GitCommit,
  ChatMessage,
  FileNode,
} from "@arlo-doc/shared";

// ── IpcRenderer interface ──────────────────────────────────────────────────
// Declared here so packages/client stays free of direct Electron imports.
// The actual ipcRenderer is injected by the preload via createIpcBinding().

export interface ElectronIpcRenderer {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
}

// ── invoke helper ──────────────────────────────────────────────────────────

function makeInvoke(ipcRenderer: ElectronIpcRenderer) {
  return async function invoke<T>(channel: string, ...args: unknown[]): Promise<KbResult<T>> {
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
  };
}

// ── Stream stub ────────────────────────────────────────────────────────────
// Full streaming implementation is in Phase 3.

async function* ipcStreamIterable(
  _channel: string,
  ..._args: unknown[]
): AsyncIterable<KbResult<string>> {
  throw new Error("not yet implemented");
}

// ── createIpcBinding factory ───────────────────────────────────────────────
// Called from the Electron preload script, passing in the real ipcRenderer.

export function createIpcBinding(ipcRenderer: ElectronIpcRenderer): ClientInterface {
  const invoke = makeInvoke(ipcRenderer);

  return {
    readDocument: (path: string) =>
      invoke<KbDocument>("arlo-doc:readDocument", path),

    writeDocument: (path: string, content: string) =>
      invoke<KbDocument>("arlo-doc:writeDocument", path, content),

    deleteDocument: (path: string) =>
      invoke<void>("arlo-doc:deleteDocument", path),

    searchDocuments: (query: SearchQuery) =>
      invoke<SearchResult[]>("arlo-doc:searchDocuments", query),

    gitClone: (url: string) =>
      invoke<void>("arlo-doc:gitClone", url),

    gitCommit: (message: string, paths: string[]) =>
      invoke<GitCommit>("arlo-doc:gitCommit", message, paths),

    gitPush: () =>
      invoke<void>("arlo-doc:gitPush"),

    gitPull: () =>
      invoke<void>("arlo-doc:gitPull"),

    gitStatus: () =>
      invoke<GitStatus>("arlo-doc:gitStatus"),

    gitDiff: (filePath: string) =>
      invoke<string>("arlo-doc:gitDiff", filePath),

    agentChat: (message: string) =>
      invoke<ChatMessage>("arlo-doc:agentChat", message),

    agentChatStream: (message: string) =>
      ipcStreamIterable("arlo-doc:agentChatStream", message),

    // Folder browser
    chooseFolder: () =>
      invoke<string | null>("arlo-doc:chooseFolder"),

    readFolder: (folderPath: string, showHidden?: boolean) =>
      invoke<FileNode>("arlo-doc:readFolder", folderPath, showHidden),

    getLastFolder: () =>
      invoke<string | null>("arlo-doc:getLastFolder"),

    getPersistedState: () =>
      invoke<PersistedClientState>("arlo-doc:getPersistedState"),

    saveState: (state: PersistedClientState) =>
      invoke<void>("arlo-doc:saveState", state),

    readFile: (filePath: string) =>
      invoke<string>("arlo-doc:readFile", filePath),

    writeFile: (filePath: string, content: string) =>
      invoke<void>("arlo-doc:writeFile", filePath, content),

    openExternal: (url: string) =>
      invoke<void>("arlo-doc:openExternal", url),

    // Worktree operations
    worktreeCreate: (repoDir: string) =>
      invoke<import("@arlo-doc/shared").WorktreeInfo>("arlo-doc:worktreeCreate", repoDir),

    worktreeDelete: (repoDir: string, worktreePath: string) =>
      invoke<void>("arlo-doc:worktreeDelete", repoDir, worktreePath),

    worktreeList: (repoDir: string) =>
      invoke<import("@arlo-doc/shared").WorktreeInfo[]>("arlo-doc:worktreeList", repoDir),

    worktreeDirty: (worktreePath: string) =>
      invoke<boolean>("arlo-doc:worktreeDirty", worktreePath),
  };
}

// ── Legacy export (kept for backwards compat, remove once preload is updated) ─
// @deprecated use createIpcBinding(ipcRenderer) instead
export const ipcBinding = null;
