import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

// Workspace packages are aliased to their TypeScript source so electron-vite
// bundles them inline rather than leaving them as external node_modules that
// Node would try to require at runtime (causing ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING).
const WORKSPACE_EXCLUDES = ["@arlo-doc/shared", "@arlo-doc/core", "@arlo-doc/client"];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: WORKSPACE_EXCLUDES })],
    build: {
      lib: {
        entry: resolve("src/main/index.ts"),
      },
    },
    resolve: {
      alias: [
        { find: "@arlo-doc/core",   replacement: resolve("../../packages/core/src/index.ts") },
        { find: "@arlo-doc/shared", replacement: resolve("../../packages/shared/src/index.ts") },
        { find: "@arlo-doc/client", replacement: resolve("../../packages/client/src/types.ts") },
      ],
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: WORKSPACE_EXCLUDES })],
    build: {
      rollupOptions: {
        input: resolve("src/preload/index.ts"),
      },
    },
    resolve: {
      // More-specific sub-path aliases must come before the bare package alias
      // so Vite's prefix-match logic picks the right one.
      alias: [
        { find: "@arlo-doc/client/ipc",  replacement: resolve("../../packages/client/src/ipc.ts") },
        { find: "@arlo-doc/client",       replacement: resolve("../../packages/client/src/types.ts") },
        { find: "@arlo-doc/shared",       replacement: resolve("../../packages/shared/src/index.ts") },
      ],
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: [
        { find: "@arlo-doc/shared",  replacement: resolve("../../packages/shared/src/index.ts") },
        { find: "@arlo-doc/client",  replacement: resolve("../../packages/client/src/types.ts") },
        { find: "@arlo-doc/ui",      replacement: resolve("../../packages/ui/src/index.ts") },
      ],
    },
  },
});
