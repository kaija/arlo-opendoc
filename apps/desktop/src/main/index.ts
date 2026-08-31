import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { promises as fs } from "node:fs";
import { release } from "node:os";
import { join } from "node:path";
import { CoreEngine, SpawnGitBackend } from "@arlo-doc/core";
import type { WorktreeInfo, SearchOptions } from "@arlo-doc/shared";
import { readFolder } from "./folderReader.js";
import * as ripgrepRunner from "./ripgrepRunner.js";
import {
  getLastFolder,
  getPersistedState,
  noteRepoOpened,
  saveState,
} from "./persistenceStore.js";
import type { PersistedState } from "./persistenceStore.js";
import {
  readRepoSession,
  writeRepoSession,
  summariseRecentRepos,
} from "./repoSessionStore.js";
import * as settingsStore from "./settingsStore.js";
import * as secretStore from "./secretStore.js";
import { ensureArloIgnored, worktreesRoot } from "./worktreeLayout.js";
import type { AppSettings, KbSettings, RepoSession } from "@arlo-doc/shared";
import type { SettingsPatch, AppInfo, KeyCheckResult } from "@arlo-doc/client";

// ── Git backend singleton ──────────────────────────────────────────────────
// Shared across all worktree IPC handlers. Worktree operations are stateless
// with respect to window identity — they receive repoDir/worktreePath as args.
const gitBackend = new SpawnGitBackend();

// ── Engine registry ────────────────────────────────────────────────────────
// One CoreEngine per renderer window, keyed by webContents.id (Requirement 11.7).
const engines = new Map<number, CoreEngine>();

function getEngine(windowId: number): CoreEngine {
  const engine = engines.get(windowId);
  if (engine === undefined) {
    throw new Error(`No CoreEngine registered for window ${windowId}`);
  }
  return engine;
}

/**
 * Returns the engine for the given window, or null when none has been
 * registered yet (i.e. the renderer hasn't opened a folder yet).
 * Used by git handlers that are called speculatively on startup — they
 * should return a graceful "no data" response rather than an IPC error.
 */
function tryGetEngine(windowId: number): CoreEngine | null {
  return engines.get(windowId) ?? null;
}

// ── Node.js errno → KbErrorCode mapping ───────────────────────────────────
// Used by readFolder and readFile handlers to produce structured KbError codes
// instead of raw errno strings.
function nodeErrCode(err: unknown): string {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === "ENOENT") return "NOT_FOUND";
  if (code === "EACCES" || code === "EPERM") return "PERMISSION_DENIED";
  return "UNKNOWN";
}

// ── Error wrapper ──────────────────────────────────────────────────────────
// Attaches a kbError property to the thrown Error so the IPC binding in the
// renderer can reconstruct a typed KbError rather than a raw exception
// (Requirement 11.6).
function wrapError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string }).code ?? "UNKNOWN";
  const wrapped = new Error(message) as Error & { kbError: { code: string; message: string } };
  wrapped.kbError = { code, message };
  throw wrapped;
}

// ── IPC handlers ──────────────────────────────────────────────────────────
// All handlers follow the same pattern: delegate to the per-window CoreEngine,
// and on failure rethrow through wrapError so the IPC binding receives a
// structured KbError rather than a plain string (Requirements 11.4–11.6).

ipcMain.handle("arlo-doc:readDocument", async (event, path: string) => {
  try {
    return await getEngine(event.sender.id).readDocument(path);
  } catch (err) {
    wrapError(err);
  }
});

ipcMain.handle("arlo-doc:writeDocument", async (event, path: string, content: string) => {
  try {
    return await getEngine(event.sender.id).writeDocument(path, content);
  } catch (err) {
    wrapError(err);
  }
});

ipcMain.handle("arlo-doc:deleteDocument", async (event, path: string) => {
  try {
    return await getEngine(event.sender.id).deleteDocument(path);
  } catch (err) {
    wrapError(err);
  }
});

ipcMain.handle("arlo-doc:searchDocuments", async (event, query: unknown) => {
  try {
    return await getEngine(event.sender.id).searchDocuments(String(query));
  } catch (err) {
    wrapError(err);
  }
});

ipcMain.handle("arlo-doc:gitClone", async (event, url: string) => {
  try {
    return await getEngine(event.sender.id).gitClone(url);
  } catch (err) {
    wrapError(err);
  }
});

ipcMain.handle("arlo-doc:gitCommit", async (event, message: string, paths: string[]) => {
  try {
    return await getEngine(event.sender.id).gitCommit(message, paths);
  } catch (err) {
    wrapError(err);
  }
});

ipcMain.handle("arlo-doc:gitPush", async (event) => {
  try {
    return await getEngine(event.sender.id).gitPush();
  } catch (err) {
    wrapError(err);
  }
});

ipcMain.handle("arlo-doc:gitPull", async (event) => {
  try {
    return await getEngine(event.sender.id).gitPull();
  } catch (err) {
    wrapError(err);
  }
});

ipcMain.handle("arlo-doc:gitStatus", async (event) => {
  try {
    // No engine yet means no folder is open — return an empty status rather
    // than throwing, since the renderer calls this speculatively on startup.
    const engine = tryGetEngine(event.sender.id);
    if (!engine) return { branch: "", ahead: 0, behind: 0, files: [] };
    return await engine.gitStatus();
  } catch (err) {
    wrapError(err);
  }
});

ipcMain.handle("arlo-doc:gitDiff", async (event, filePath: string) => {
  try {
    // No engine yet — return empty diff string rather than throwing.
    const engine = tryGetEngine(event.sender.id);
    if (!engine) return "";
    return await engine.gitDiff(filePath);
  } catch (err) {
    wrapError(err);
  }
});

ipcMain.handle("arlo-doc:openExternal", async (_event, url: string) => {
  // Only open http/https URLs to prevent arbitrary protocol abuse
  if (!url.startsWith("http://") && !url.startsWith("https://")) return;
  await shell.openExternal(url);
});

ipcMain.handle("arlo-doc:agentChat", async (event, message: string) => {
  try {
    return await getEngine(event.sender.id).agentChat(message);
  } catch (err) {
    wrapError(err);
  }
});

// ── Folder-browser IPC handlers ────────────────────────────────────────────
// Tasks 5.1–5.4: native folder picker, recursive folder read, persistence,
// and file content read. Follow the same KbResult error contract as the
// existing handlers above (Requirements REQ-002.6, REQ-002.8).

// Task 5.1 — native OS folder picker (REQ-001.1, REQ-002.6, REQ-002.8)
// Returns null (not throws) when the user cancels — a cancelled dialog is a
// legitimate success value, not an error.
ipcMain.handle("arlo-doc:chooseFolder", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win ?? BrowserWindow.getFocusedWindow()!, {
    properties: ["openDirectory"],
    title: "Choose a folder for your knowledge base",
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// Task 5.2 — recursive folder read + best-effort persistence (REQ-002.6,
// REQ-002.8, REQ-003.7, REQ-003.8, REQ-007.1)
ipcMain.handle("arlo-doc:readFolder", async (event, folderPath: string, showHidden?: boolean) => {
  try {
    const tree = await readFolder(folderPath, { showHidden: showHidden ?? false });
    // The recent-repositories list is maintained separately via
    // `arlo-doc:noteRepoOpened`, which the renderer calls only for a real repo
    // root — readFolder also runs for worktree subdirectories, which must not
    // count as "opened a repository".

    // Register (or re-register) a CoreEngine for this window now that we know kbRoot.
    // Resolve kbRoot to the actual git repo root so that git operations always
    // run in the right directory — even when folderPath is a worktree
    // subdirectory rather than the repo root itself. Falls back to folderPath
    // when the chosen folder isn't inside a git repo at all.
    // StoreAdapter, ForgeAdapter, and AgentKeyProvider are stubs until Phase 2.
    const kbRoot = await repoRootOf(folderPath);
    engines.set(event.sender.id, new CoreEngine({
      kbRoot,
      store: {} as never,
      forge: {} as never,
      agentKeyProvider: {} as never,
      git: gitBackend,
    }));

    return tree;
  } catch (err) {
    const code = nodeErrCode(err);
    const wrapped = new Error((err as Error).message) as Error & { kbError: unknown };
    wrapped.kbError = { code, message: (err as Error).message };
    throw wrapped;
  }
});

// Task 5.3 — read persisted last folder path (REQ-002.6, REQ-007.2)
ipcMain.handle("arlo-doc:getLastFolder", async () => {
  try {
    return await getLastFolder();
  } catch (err) {
    wrapError(err);
  }
});

// Task 9.3 — read full persisted state (tabs + active tab + last folder).
// Verifies each worktree path still exists on disk; drops missing ones silently.
ipcMain.handle("arlo-doc:getPersistedState", async () => {
  try {
    return await getPersistedState();
  } catch (err) {
    wrapError(err);
  }
});

// Task 9.2 — persist full worktree list + active tab + last folder.
// Called fire-and-forget from the renderer on every tab open/close.
ipcMain.handle("arlo-doc:saveState", async (_event, persistedState: PersistedState) => {
  // Validation: accept only if it looks like a PersistedState object
  if (typeof persistedState !== "object" || persistedState === null) return;
  try {
    await saveState(persistedState);
  } catch (err) {
    // Non-fatal — log and continue (REQ-007.1)
    console.error("[main] saveState failed:", err);
  }
});

// ── Per-repository session record (`<repo>/.arlo/session.json`) ─────────────
// The renderer asks which repo to open on every launch; each repo keeps its
// own worktree tabs here so nothing is lost by not auto-resuming.

/** Resolve the git root so the session file sits with `.arlo/worktrees/`. */
async function repoRootOf(repoDir: string): Promise<string> {
  try {
    return await gitBackend.getRepoRoot(repoDir);
  } catch {
    return repoDir; // not a git repo yet — use the folder as given
  }
}

// Record that a repository was opened (front of the recent list + last folder).
ipcMain.handle("arlo-doc:noteRepoOpened", async (_event, repoPath: string) => {
  try {
    await noteRepoOpened(repoPath);
  } catch (err) {
    console.error("[main] noteRepoOpened failed:", err);
  }
});

// Start-screen summaries for the recent repositories.
ipcMain.handle("arlo-doc:getRecentRepos", async () => {
  try {
    const { recentRepos } = await getPersistedState();
    return await summariseRecentRepos(recentRepos);
  } catch (err) {
    wrapError(err);
  }
});

// Read one repository's session record.
ipcMain.handle("arlo-doc:readRepoSession", async (_event, repoPath: string) => {
  try {
    return await readRepoSession(await repoRootOf(repoPath));
  } catch (err) {
    wrapError(err);
  }
});

// Persist one repository's session record. Fire-and-forget from the renderer.
ipcMain.handle(
  "arlo-doc:saveRepoSession",
  async (_event, repoPath: string, session: RepoSession) => {
    if (typeof session !== "object" || session === null) return;
    try {
      await writeRepoSession(await repoRootOf(repoPath), session);
    } catch (err) {
      console.error("[main] saveRepoSession failed:", err);
    }
  },
);

// Task 5.4 — read UTF-8 file content (REQ-002.6, REQ-002.8, REQ-006.1)
ipcMain.handle("arlo-doc:readFile", async (_event, filePath: string) => {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (err) {
    const code = nodeErrCode(err);
    const wrapped = new Error((err as Error).message) as Error & { kbError: unknown };
    wrapped.kbError = { code, message: (err as Error).message };
    throw wrapped;
  }
});

// Write UTF-8 file content (atomic: write to .tmp then rename)
ipcMain.handle("arlo-doc:writeFile", async (_event, filePath: string, content: string) => {
  const tmpPath = filePath + ".tmp";
  try {
    await fs.writeFile(tmpPath, content, "utf-8");
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    // Clean up tmp on failure
    await fs.unlink(tmpPath).catch(() => undefined);
    const code = nodeErrCode(err);
    const wrapped = new Error((err as Error).message) as Error & { kbError: unknown };
    wrapped.kbError = { code, message: (err as Error).message };
    throw wrapped;
  }
});

// ── Search IPC handlers ────────────────────────────────────────────────────
// Tasks 5.1–5.2: file-name search stub and full-text content search via ripgrep.
// Both follow the same KbResult error contract: return raw data on success;
// throw an Error with a `kbError` property on failure (REQ-006.4).

// Task 5.1 — file-name search stub (REQ-006.4, REQ-006.6, REQ-006.7)
// The renderer performs actual fuzzy matching against its in-memory fileTree;
// this handler exists to satisfy the ClientInterface contract.
ipcMain.handle("arlo-doc:searchFiles", async (_event, repoDir: string, query: string, _options: SearchOptions) => {
  try {
    // REQ-006.7: empty query → [] immediately, no filesystem work
    if (!query) return [];
    // REQ-006.6: validate repoDir exists
    try {
      await fs.access(repoDir);
    } catch {
      const wrapped = new Error(`repo directory not found: ${repoDir}`) as Error & { kbError: unknown };
      wrapped.kbError = { code: "NOT_FOUND", message: `repo directory not found: ${repoDir}` };
      throw wrapped;
    }
    // Renderer handles file-name matching; this is a valid no-op stub.
    return [];
  } catch (err) {
    // Re-throw errors that already carry kbError (our NOT_FOUND above)
    if ((err as { kbError?: unknown }).kbError) throw err;
    wrapError(err);
  }
});

// Task 5.2 — full-text content search via ripgrep (REQ-006.4, REQ-006.6, REQ-006.7)
ipcMain.handle("arlo-doc:findInFiles", async (_event, repoDir: string, query: string, options: SearchOptions) => {
  try {
    // REQ-006.7: empty query → [] immediately
    if (!query) return [];
    // REQ-006.6: validate repoDir exists
    try {
      await fs.access(repoDir);
    } catch {
      const wrapped = new Error(`repo directory not found: ${repoDir}`) as Error & { kbError: unknown };
      wrapped.kbError = { code: "NOT_FOUND", message: `repo directory not found: ${repoDir}` };
      throw wrapped;
    }
    // Delegate to RipgrepRunner; it returns a KbResult — unwrap it here so
    // the invoke() wrapper in packages/client receives raw data (not a nested KbResult).
    const result = await ripgrepRunner.findInFiles(repoDir, query, options);
    if (!result.ok) {
      const wrapped = new Error(result.error.message) as Error & { kbError: unknown };
      wrapped.kbError = { code: result.error.code, message: result.error.message };
      throw wrapped;
    }
    return result.data;
  } catch (err) {
    // Re-throw errors that already carry kbError (our NOT_FOUND / ripgrep errors above)
    if ((err as { kbError?: unknown }).kbError) throw err;
    wrapError(err);
  }
});

// ── Worktree IPC handlers ──────────────────────────────────────────────────
// Tasks 3.3–3.6: create, delete, list, and dirty-check git worktrees.
// All handlers follow the same KbResult error contract as handlers above:
// return the raw data value on success; throw an error with a `kbError` property
// on failure so the invoke() wrapper in packages/client wraps it correctly.

// Task 3.3 — create a new worktree + branch
ipcMain.handle("arlo-doc:worktreeCreate", async (_event, repoDir: string) => {
  try {
    const repoRoot = await gitBackend.getRepoRoot(repoDir);

    // Worktrees live in .arlo/worktrees/ rather than .arlo/ itself, so that
    // .arlo/ stays available for files the team shares. See worktreeLayout.ts
    // for why the legacy location must stay ignored as well.
    const worktreesDir = worktreesRoot(repoRoot);
    await fs.mkdir(worktreesDir, { recursive: true });

    const branch = `wt-${Date.now()}`;
    const worktreePath = join(worktreesDir, branch);

    await ensureArloIgnored(repoRoot);

    await gitBackend.worktreeAdd(repoRoot, worktreePath, branch);

    // Retrieve the actual HEAD after creation so the caller has a real SHA.
    // Fallback to empty string if listing fails (non-fatal).
    let head = "";
    try {
      const list = await gitBackend.worktreeList(repoRoot);
      head = list.find((wt) => wt.path === worktreePath)?.head ?? "";
    } catch {
      // non-fatal: head stays as empty string
    }

    const info: WorktreeInfo = { path: worktreePath, branch, head };
    return info;
  } catch (err) {
    wrapError(err);
  }
});

// Task 3.4 — remove a worktree
ipcMain.handle("arlo-doc:worktreeDelete", async (_event, repoDir: string, worktreePath: string) => {
  try {
    await gitBackend.worktreeRemove(repoDir, worktreePath);
  } catch (err) {
    wrapError(err);
  }
});

// Task 3.5 — list all worktrees in a repo
ipcMain.handle("arlo-doc:worktreeList", async (_event, repoDir: string) => {
  try {
    return await gitBackend.worktreeList(repoDir);
  } catch (err) {
    wrapError(err);
  }
});

// Task 3.6 — check whether a worktree has uncommitted changes
ipcMain.handle("arlo-doc:worktreeDirty", async (_event, worktreePath: string) => {
  try {
    return await gitBackend.worktreeDirty(worktreePath);
  } catch (err) {
    wrapError(err);
  }
});

// ── Settings IPC ──────────────────────────────────────────────────────────

ipcMain.handle("arlo-doc:readAppSettings", async () => {
  try {
    return await settingsStore.readApp();
  } catch (err) {
    wrapError(err);
  }
});

ipcMain.handle(
  "arlo-doc:writeAppSettings",
  async (_event, patch: SettingsPatch<AppSettings>) => {
    try {
      return await settingsStore.writeApp(patch);
    } catch (err) {
      wrapError(err);
    }
  },
);

ipcMain.handle("arlo-doc:readKbSettings", async (_event, repoPath: string) => {
  try {
    return await settingsStore.readKb(repoPath);
  } catch (err) {
    wrapError(err);
  }
});

ipcMain.handle(
  "arlo-doc:writeKbSettings",
  async (_event, repoPath: string, patch: SettingsPatch<KbSettings>) => {
    try {
      return await settingsStore.writeKb(repoPath, patch);
    } catch (err) {
      wrapError(err);
    }
  },
);

ipcMain.handle("arlo-doc:resetPreferences", async () => {
  try {
    await settingsStore.resetPreferences();
  } catch (err) {
    wrapError(err);
  }
});

// ── Secret IPC ────────────────────────────────────────────────────────────
// Every channel here returns SecretStatus — never a key. secretStore's
// plaintext accessors are main-process only and are deliberately not bridged.

ipcMain.handle("arlo-doc:getSecretStatus", async () => {
  try {
    return await secretStore.status();
  } catch (err) {
    wrapError(err);
  }
});

ipcMain.handle("arlo-doc:setAnthropicKey", async (_event, key: string) => {
  try {
    return await secretStore.setAnthropicKey(key);
  } catch (err) {
    wrapError(err);
  }
});

ipcMain.handle("arlo-doc:clearAnthropicKey", async () => {
  try {
    return await secretStore.clearAnthropicKey();
  } catch (err) {
    wrapError(err);
  }
});

/**
 * Verifies the STORED key by calling the Anthropic API. The renderer never
 * sends or receives the key — it asks for a check and gets a verdict.
 */
ipcMain.handle("arlo-doc:testAnthropicKey", async () => {
  const checkedAt = new Date().toISOString();
  try {
    const key = await secretStore.getAnthropicKey();
    if (key === null) {
      return { valid: false, message: "No API key is stored.", checkedAt } satisfies KeyCheckResult;
    }
    const res = await fetch("https://api.anthropic.com/v1/models?limit=1", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    });
    if (res.ok) {
      await secretStore.markAnthropicVerified(checkedAt);
      return { valid: true, message: null, checkedAt } satisfies KeyCheckResult;
    }
    const message =
      res.status === 401
        ? "That key was rejected. Check it was copied in full."
        : `Anthropic returned ${res.status}.`;
    return { valid: false, message, checkedAt } satisfies KeyCheckResult;
  } catch (err) {
    // A network failure is not an invalid key, and must not be reported as one.
    return {
      valid: false,
      message: `Could not reach api.anthropic.com — ${(err as Error).message}`,
      checkedAt,
    } satisfies KeyCheckResult;
  }
});

ipcMain.handle("arlo-doc:clearGithubToken", async () => {
  try {
    return await secretStore.clearGithubToken();
  } catch (err) {
    wrapError(err);
  }
});

ipcMain.handle("arlo-doc:forgetCredentials", async () => {
  try {
    return await secretStore.forgetAll();
  } catch (err) {
    wrapError(err);
  }
});

// ── Agent instructions (ARLO.md) ──────────────────────────────────────────
// A committed file at the repository root, so a team shares one set of
// conventions. Deliberately NOT inside .arlo/, which is gitignored.

function instructionsPath(repoPath: string): string {
  return join(repoPath, "ARLO.md");
}

ipcMain.handle("arlo-doc:readInstructions", async (_event, repoPath: string) => {
  try {
    return await fs.readFile(instructionsPath(repoPath), "utf-8");
  } catch (err) {
    // Absent is the normal state for a repository that has never set any.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return "";
    wrapError(err);
  }
});

ipcMain.handle(
  "arlo-doc:writeInstructions",
  async (_event, repoPath: string, content: string) => {
    try {
      await fs.writeFile(instructionsPath(repoPath), content, "utf-8");
    } catch (err) {
      wrapError(err);
    }
  },
);

// ── About IPC ─────────────────────────────────────────────────────────────

ipcMain.handle("arlo-doc:getAppInfo", async () => {
  try {
    return {
      version: app.getVersion(),
      electronVersion: process.versions.electron ?? "unknown",
      platform: process.platform,
      osVersion: release(),
      userDataPath: app.getPath("userData"),
      encryptionAvailable: secretStore.isEncryptionAvailable(),
    } satisfies AppInfo;
  } catch (err) {
    wrapError(err);
  }
});

ipcMain.handle("arlo-doc:revealSettingsFile", async () => {
  try {
    shell.showItemInFolder(settingsStore.getSettingsPath());
  } catch (err) {
    wrapError(err);
  }
});

ipcMain.handle("arlo-doc:openLogsFolder", async () => {
  try {
    await shell.openPath(app.getPath("logs"));
  } catch (err) {
    wrapError(err);
  }
});

/**
 * Resolves the identity git would actually use in this repository — local
 * config first, then global. Returns null when git has no identity set, which
 * the Repository pane surfaces rather than inventing a value.
 */
ipcMain.handle("arlo-doc:getGitIdentity", async (_event, repoPath: string) => {
  try {
    const name = await gitBackend.getConfig(repoPath, "user.name");
    const email = await gitBackend.getConfig(repoPath, "user.email");
    if (name === null || email === null) return null;
    return { name, email };
  } catch {
    // No identity configured is a normal state, not an error.
    return null;
  }
});

// ── Window control IPC ────────────────────────────────────────────────────

ipcMain.handle("arlo-doc:toggleMaximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

// ── Window lifecycle ───────────────────────────────────────────────────────

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset', // native traffic lights inset into custom title bar
    webPreferences: {
      // electron-vite outputs preload to out/preload/index.js (CJS) for packages
      // without "type": "module". Update to .mjs here if the package is ever
      // converted to ESM.
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,  // renderer has no direct Node.js access
      sandbox: false,          // required: electron-vite bundles preload deps
      nodeIntegration: false,  // enforced: renderer must use the preload bridge
    },
  });

  // Register a CoreEngine for this window once the renderer has finished loading.
  // The engine is intentionally a stub here — adapters are wired in Phase 2.
  win.webContents.on("did-finish-load", () => {
    // Engine registration placeholder: real construction with adapters happens
    // in a subsequent phase. For now we store nothing so getEngine will throw,
    // which is the correct behaviour for stub IPC handlers that already throw
    // "not implemented".
  });

  // Capture the webContents id before the window is destroyed.
  // The "closed" event fires after destruction, so win.webContents is gone by then.
  const contentsId = win.webContents.id;

  win.on("closed", () => {
    engines.delete(contentsId);
  });

  if (process.env["NODE_ENV"] === "development") {
    void win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  // On macOS, re-create the window when the dock icon is clicked and no windows
  // are open (standard macOS behaviour).
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS where the app remains
// active until the user quits explicitly with Cmd+Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

export { engines, getEngine };
