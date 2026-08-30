// NO imports from @arlo-doc/core (Requirement 4.3)
import type { ClientInterface, KbError, KbResult } from "./types.js";
import type {
  KbDocument,
  SearchQuery,
  SearchResult,
  GitStatus,
  GitCommit,
  ChatMessage,
  FileNode,
} from "@arlo-doc/shared";

// ── apiFetch helper ────────────────────────────────────────────────────────

async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<KbResult<T>> {
  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });

    if (!response.ok) {
      let error: KbError;
      try {
        const body = (await response.json()) as { error?: KbError };
        error = body.error ?? {
          code: "UNKNOWN",
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      } catch {
        error = {
          code: response.status === 401 ? "AUTH_ERROR" : "UNKNOWN",
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      return { ok: false, error };
    }

    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

// ── sseIterable ────────────────────────────────────────────────────────────
// Streams server-sent events as an async iterable using browser EventSource.

async function* sseIterable(url: string): AsyncIterable<KbResult<string>> {
  const source = new EventSource(url);
  const queue: KbResult<string>[] = [];
  let resolve: (() => void) | null = null;
  let done = false;
  // Use a string rather than Error so TypeScript control-flow narrowing
  // doesn't collapse the type to `never` after mutation in a callback.
  let streamErrorMessage = "";

  source.onmessage = (event: MessageEvent<string>) => {
    if (event.data === "[DONE]") {
      done = true;
      source.close();
    } else {
      queue.push({ ok: true, data: event.data });
    }
    resolve?.();
    resolve = null;
  };

  source.onerror = () => {
    streamErrorMessage = "SSE connection error";
    done = true;
    source.close();
    resolve?.();
    resolve = null;
  };

  try {
    while (!done || queue.length > 0) {
      if (queue.length === 0 && !done) {
        await new Promise<void>((r) => {
          resolve = r;
        });
      }
      while (queue.length > 0) {
        const item = queue.shift();
        if (item !== undefined) yield item;
      }
    }
    if (streamErrorMessage !== "") {
      yield {
        ok: false,
        error: { code: "AGENT_ERROR", message: streamErrorMessage },
      };
    }
  } finally {
    source.close();
  }
}

// ── unavailable helper ─────────────────────────────────────────────────────
// Several ClientInterface methods are desktop-only: they touch the local
// filesystem, the OS keychain, or a git working copy the browser cannot reach.
// Rather than repeat the same rejection shape for each, they share this helper.

function unavailable<T>(method: string): Promise<KbResult<T>> {
  return Promise.resolve<KbResult<T>>({
    ok: false,
    error: { code: "UNKNOWN", message: `${method} is not available in the web client` },
  });
}

// ── createHttpBinding factory ──────────────────────────────────────────────

export function createHttpBinding(baseUrl: string): ClientInterface {
  const base = baseUrl.replace(/\/$/, "");

  return {
    readDocument: (path: string) =>
      apiFetch<KbDocument>(`${base}/api/kb/document?path=${encodeURIComponent(path)}`),

    writeDocument: (path: string, content: string) =>
      apiFetch<KbDocument>(`${base}/api/kb/document`, {
        method: "PUT",
        body: JSON.stringify({ path, content }),
      }),

    deleteDocument: (path: string) =>
      apiFetch<void>(`${base}/api/kb/document?path=${encodeURIComponent(path)}`, {
        method: "DELETE",
      }),

    searchDocuments: (query: SearchQuery) =>
      apiFetch<SearchResult[]>(`${base}/api/kb/search`, {
        method: "POST",
        body: JSON.stringify(query),
      }),

    gitClone: (url: string) =>
      apiFetch<void>(`${base}/api/git/clone`, {
        method: "POST",
        body: JSON.stringify({ url }),
      }),

    gitCommit: (message: string, paths: string[]) =>
      apiFetch<GitCommit>(`${base}/api/git/commit`, {
        method: "POST",
        body: JSON.stringify({ message, paths }),
      }),

    gitPush: () => apiFetch<void>(`${base}/api/git/push`, { method: "POST" }),

    gitPull: () => apiFetch<void>(`${base}/api/git/pull`, { method: "POST" }),

    gitStatus: () => apiFetch<GitStatus>(`${base}/api/git/status`),

    agentChat: (message: string) =>
      apiFetch<ChatMessage>(`${base}/api/agent/chat`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),

    agentChatStream: (message: string) =>
      sseIterable(
        `${base}/api/agent/chat/stream?message=${encodeURIComponent(message)}`,
      ),

    // Folder browser — Electron-only; not available in the HTTP client
    chooseFolder: () =>
      Promise.resolve<KbResult<string | null>>({
        ok: false,
        error: { code: "UNKNOWN", message: "chooseFolder is not available in the web client" },
      }),

    readFolder: (_folderPath: string) =>
      Promise.resolve<KbResult<FileNode>>({
        ok: false,
        error: { code: "UNKNOWN", message: "readFolder is not available in the web client" },
      }),

    getLastFolder: () =>
      Promise.resolve<KbResult<string | null>>({
        ok: false,
        error: { code: "UNKNOWN", message: "getLastFolder is not available in the web client" },
      }),

    readFile: (_filePath: string) =>
      Promise.resolve<KbResult<string>>({
        ok: false,
        error: { code: "UNKNOWN", message: "readFile is not available in the web client" },
      }),

    gitDiff: (_filePath: string) =>
      Promise.resolve<KbResult<string>>({
        ok: false,
        error: { code: "UNKNOWN", message: "gitDiff is not available in the web client" },
      }),

    writeFile: (_filePath: string, _content: string) =>
      Promise.resolve<KbResult<void>>({
        ok: false,
        error: { code: "UNKNOWN", message: "writeFile is not available in the web client" },
      }),

    openExternal: (_url: string) =>
      Promise.resolve<KbResult<void>>({
        ok: false,
        error: { code: "UNKNOWN", message: "openExternal is not available in the web client" },
      }),

    // Worktree operations — Electron-only; not available in the HTTP client
    worktreeCreate: (_repoDir: string) =>
      Promise.resolve<KbResult<import("@arlo-doc/shared").WorktreeInfo>>({
        ok: false,
        error: { code: "UNKNOWN", message: "worktreeCreate is not available in the web client" },
      }),

    worktreeDelete: (_repoDir: string, _worktreePath: string) =>
      Promise.resolve<KbResult<void>>({
        ok: false,
        error: { code: "UNKNOWN", message: "worktreeDelete is not available in the web client" },
      }),

    worktreeList: (_repoDir: string) =>
      Promise.resolve<KbResult<import("@arlo-doc/shared").WorktreeInfo[]>>({
        ok: false,
        error: { code: "UNKNOWN", message: "worktreeList is not available in the web client" },
      }),

    worktreeDirty: (_worktreePath: string) =>
      Promise.resolve<KbResult<boolean>>({
        ok: false,
        error: { code: "UNKNOWN", message: "worktreeDirty is not available in the web client" },
      }),

    // Persistence — Electron-only; not available in the HTTP client
    getPersistedState: () =>
      Promise.resolve<KbResult<import("./types.js").PersistedClientState>>({
        ok: false,
        error: { code: "UNKNOWN", message: "getPersistedState is not available in the web client" },
      }),

    saveState: (_state: import("./types.js").PersistedClientState) =>
      Promise.resolve<KbResult<void>>({
        ok: false,
        error: { code: "UNKNOWN", message: "saveState is not available in the web client" },
      }),

    // Search — the desktop app shells out to a bundled ripgrep against a local
    // working copy. The web companion will need a server-side equivalent.
    searchFiles: (
      _repoDir: string,
      _query: string,
      _options: import("@arlo-doc/shared").SearchOptions,
    ) => unavailable<import("@arlo-doc/shared").FileNameMatch[]>("searchFiles"),

    findInFiles: (
      _repoDir: string,
      _query: string,
      _options: import("@arlo-doc/shared").SearchOptions,
    ) => unavailable<import("@arlo-doc/shared").ContentMatch[]>("findInFiles"),

    // Settings — stored per-machine on the desktop. The web companion will
    // read these from the account rather than a local file, so these are
    // "not yet", not "never".
    readAppSettings: () => unavailable<import("@arlo-doc/shared").AppSettings>("readAppSettings"),

    writeAppSettings: (
      _patch: import("./types.js").SettingsPatch<import("@arlo-doc/shared").AppSettings>,
    ) => unavailable<import("@arlo-doc/shared").AppSettings>("writeAppSettings"),

    readKbSettings: (_repoPath: string) =>
      unavailable<import("@arlo-doc/shared").KbSettings>("readKbSettings"),

    writeKbSettings: (
      _repoPath: string,
      _patch: import("./types.js").SettingsPatch<import("@arlo-doc/shared").KbSettings>,
    ) => unavailable<import("@arlo-doc/shared").KbSettings>("writeKbSettings"),

    resetPreferences: () => unavailable<void>("resetPreferences"),

    // Secrets — the desktop holds a user-supplied key in the OS keychain; the
    // web service holds its own credentials server-side and never exposes them.
    getSecretStatus: () =>
      unavailable<import("@arlo-doc/shared").SecretStatus>("getSecretStatus"),

    setAnthropicKey: (_key: string) =>
      unavailable<import("@arlo-doc/shared").SecretStatus>("setAnthropicKey"),

    clearAnthropicKey: () =>
      unavailable<import("@arlo-doc/shared").SecretStatus>("clearAnthropicKey"),

    testAnthropicKey: () => unavailable<import("./types.js").KeyCheckResult>("testAnthropicKey"),

    clearGithubToken: () =>
      unavailable<import("@arlo-doc/shared").SecretStatus>("clearGithubToken"),

    forgetCredentials: () =>
      unavailable<import("@arlo-doc/shared").SecretStatus>("forgetCredentials"),

    // Agent instructions — a file in a local working copy.
    readInstructions: (_repoPath: string) => unavailable<string>("readInstructions"),

    writeInstructions: (_repoPath: string, _content: string) =>
      unavailable<void>("writeInstructions"),

    // About — describes an installed desktop build.
    getAppInfo: () => unavailable<import("./types.js").AppInfo>("getAppInfo"),

    revealSettingsFile: () => unavailable<void>("revealSettingsFile"),

    openLogsFolder: () => unavailable<void>("openLogsFolder"),

    getGitIdentity: (_repoPath: string) =>
      unavailable<{ name: string; email: string } | null>("getGitIdentity"),
  };
}
