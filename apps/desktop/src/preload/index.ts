import { contextBridge, ipcRenderer } from "electron";
import { createIpcBinding } from "@arlo-doc/client/ipc";
import type { ClientInterface } from "@arlo-doc/client";

// Expose the IPC binding on window.arlodoc in the renderer process.
// The `satisfies` check ensures createIpcBinding returns every method of
// ClientInterface. If types.ts gains a new method, TypeScript will error here
// until ipc.ts is updated.
const arlodoc = createIpcBinding(ipcRenderer) satisfies ClientInterface;

// Single exposeInMainWorld call — "arlodoc" matches the Window.arlodoc declaration in @arlo-doc/client
contextBridge.exposeInMainWorld("arlodoc", arlodoc);

// Window control bridge — separate from the business-logic ClientInterface so
// window management concerns stay isolated.
contextBridge.exposeInMainWorld("windowControls", {
  toggleMaximize: () => ipcRenderer.invoke("arlo-doc:toggleMaximize"),
});
