import { contextBridge } from "electron";
import { ipcBinding } from "@kb/client/ipc";
import type { ClientInterface } from "@kb/client";

// Expose the IPC binding on window.kb in the renderer process.
// The `satisfies` check ensures ipcBinding implements every method of ClientInterface.
// If types.ts gains a new method, TypeScript will error here until ipc.ts is updated.
const kb = ipcBinding satisfies ClientInterface;

// Single exposeInMainWorld call — "kb" matches the Window.kb declaration in @kb/client
contextBridge.exposeInMainWorld("kb", kb);
