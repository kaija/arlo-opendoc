import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import type { CoreEngine } from "@arlo-doc/core";

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
    return await getEngine(event.sender.id).gitStatus();
  } catch (err) {
    wrapError(err);
  }
});

ipcMain.handle("arlo-doc:agentChat", async (event, message: string) => {
  try {
    return await getEngine(event.sender.id).agentChat(message);
  } catch (err) {
    wrapError(err);
  }
});

// ── Window lifecycle ───────────────────────────────────────────────────────

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
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
