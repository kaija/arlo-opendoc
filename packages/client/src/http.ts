// NO imports from @arlo-doc/core (Requirement 4.3)
import type { ClientInterface, KbError, KbResult } from "./types.js";
import type {
  KbDocument,
  SearchQuery,
  SearchResult,
  GitStatus,
  GitCommit,
  ChatMessage,
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
  };
}
