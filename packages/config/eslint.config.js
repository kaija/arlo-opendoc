// @ts-check
import importPlugin from "eslint-plugin-import-x";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Resolve to the monorepo root from packages/config
const root = resolve(__dirname, "../..");

const NODE_BUILTINS = [
  "fs", "path", "os", "child_process", "crypto",
  "http", "https", "net", "stream", "buffer",
  "events", "util", "url",
  "node:fs", "node:path", "node:os", "node:child_process", "node:crypto",
  "node:http", "node:https", "node:net", "node:stream", "node:buffer",
  "node:events", "node:util", "node:url",
];

export default [
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "import-x": importPlugin,
    },
    rules: {
      // Shared TypeScript rules
      ...tsPlugin.configs.recommended.rules,
      // Allow underscore-prefixed parameters and variables (common stub pattern)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // ── Rule 1: packages/* must not import from apps/* ───────────────────────
  {
    files: [`${root}/packages/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { regex: `${root}/apps/`, message: "Packages must not import from apps." },
            { group: ["apps/*", "*/apps/*"], message: "Packages must not import from apps." },
          ],
        },
      ],
    },
  },

  // ── Rule 2: packages/core may only import @arlo-doc/shared from @arlo-doc/* ──
  {
    files: [`${root}/packages/core/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@arlo-doc/client", "@arlo-doc/client/*", "@arlo-doc/ui", "@arlo-doc/ui/*"],
              message: "packages/core may only import from @arlo-doc/shared.",
            },
          ],
        },
      ],
    },
  },

  // ── Rule 3: packages/ui must not import @arlo-doc/core or IPC/HTTP bindings ──
  {
    files: [`${root}/packages/ui/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@arlo-doc/core", message: "packages/ui must not import @arlo-doc/core." },
          ],
          patterns: [
            { group: ["@arlo-doc/client/ipc", "@arlo-doc/client/http"], message: "packages/ui must only use @arlo-doc/client types, not bindings." },
            { group: ["@arlo-doc/core", "@arlo-doc/core/*"], message: "packages/ui must not import @arlo-doc/core." },
          ],
        },
      ],
    },
  },

  // ── Rule 4: apps/desktop/src/renderer must not import electron or Node builtins ──
  {
    files: [`${root}/apps/desktop/src/renderer/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "electron", message: "Renderer must not import electron directly — use the preload bridge." },
            ...NODE_BUILTINS.map((m) => ({
              name: m,
              message: `Renderer must not import Node built-in '${m}' — use the preload bridge.`,
            })),
          ],
        },
      ],
    },
  },

  // ── Rule 5: only apps/desktop may import electron ────────────────────────
  {
    files: [
      `${root}/packages/**/*.{ts,tsx}`,
      `${root}/apps/web/**/*.{ts,tsx}`,
      `${root}/apps/server/**/*.{ts,tsx}`,
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "electron", message: "Only apps/desktop may import electron." },
          ],
        },
      ],
    },
  },

  // ── Rule 6: only apps/web may import next ────────────────────────────────
  {
    files: [
      `${root}/packages/**/*.{ts,tsx}`,
      `${root}/apps/desktop/**/*.{ts,tsx}`,
      `${root}/apps/server/**/*.{ts,tsx}`,
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["next", "next/*"], message: "Only apps/web may import next." },
          ],
        },
      ],
    },
  },

  // ── Rule 7 is enforced by the exit code from Rules 1–6 above ─────────────
  // When any rule fires, ESLint exits non-zero. Turborepo propagates the exit
  // code through the task graph and fails the CI run.
];
