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
        "@arlo-doc/core": resolve("../../packages/core/src/index.ts"),
        "@arlo-doc/shared": resolve("../../packages/shared/src/index.ts"),
        "@arlo-doc/client": resolve("../../packages/client/src/types.ts"),
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
        "@arlo-doc/client": resolve("../../packages/client/src/types.ts"),
        "@arlo-doc/client/ipc": resolve("../../packages/client/src/ipc.ts"),
        "@arlo-doc/shared": resolve("../../packages/shared/src/index.ts"),
      },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        "@arlo-doc/shared": resolve("../../packages/shared/src/index.ts"),
        "@arlo-doc/client": resolve("../../packages/client/src/types.ts"),
        "@arlo-doc/ui": resolve("../../packages/ui/src/index.ts"),
      },
    },
  },
});
