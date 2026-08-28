import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve("src/main/index.ts"),
      },
    },
    resolve: {
      alias: {
        "@kb/core": resolve("../../packages/core/src/index.ts"),
        "@kb/shared": resolve("../../packages/shared/src/index.ts"),
        "@kb/client": resolve("../../packages/client/src/types.ts"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve("src/preload/index.ts"),
      },
    },
    resolve: {
      alias: {
        "@kb/client": resolve("../../packages/client/src/types.ts"),
        "@kb/client/ipc": resolve("../../packages/client/src/ipc.ts"),
        "@kb/shared": resolve("../../packages/shared/src/index.ts"),
      },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        "@kb/shared": resolve("../../packages/shared/src/index.ts"),
        "@kb/client": resolve("../../packages/client/src/types.ts"),
        "@kb/ui": resolve("../../packages/ui/src/index.ts"),
      },
    },
  },
});
