# Design Document — `monorepo-scaffold`

## Overview

This document specifies every file, package, configuration value, and behavioural
contract that must exist at scaffold time for the `kb/` monorepo. The scaffold is not a
feature users see; it is the foundation that makes every future feature buildable. An
incorrect scaffold — wrong build order, missing boundary rule, leaky preload bridge —
compresses into a multi-week liability as the codebase grows. The goal is to get all of
those decisions made and machine-verifiable before any feature code exists.

The system ships as two independently-deployable hosts that share one TypeScript core
engine:

- **Desktop** — Electron (macOS + Windows), core engine runs in the main process,
  renderer talks to it over a typed IPC bridge.
- **Web** — Next.js UI + Fastify API service, core engine runs server-side with one
  instance per authenticated GitHub user.

All host-specific concerns (storage, credentials, forge access) enter the engine through
constructor-injected adapter interfaces so the engine binary is byte-for-byte identical
across hosts.

---

## Architecture

### Package dependency graph

Imports always flow downward. No upward or sideways edges are permitted.

```
┌─────────────────────────────────────────────────────────┐
│                     apps layer                          │
│                                                         │
│  apps/desktop          apps/web           apps/server   │
│  (electron host)       (next.js UI)       (fastify API) │
└────────┬──────────────────┬──────────────────┬──────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                   interface layer                       │
│                                                         │
│       packages/client (contract + bindings)             │
│       packages/ui     (components, tokens)              │
└────────┬──────────────────┬──────────────────┬──────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                  foundation layer                       │
│                                                         │
│  packages/core (engine, imports shared only)            │
│  packages/shared (Zod schemas, domain types, constants) │
│  packages/config (ESLint / Prettier / TSConfig presets) │
└─────────────────────────────────────────────────────────┘
```

### Build order

```
 ① packages/config   ②  packages/shared
        │                    │
        ▼                    ▼
        └──────►  ③ packages/core ◄───────────────┐
                      │                            │
                      ▼                            │
             ④ packages/client ◄── (also shared)   │
                      │                            │
                      ▼                            │
             ⑤ packages/ui ◄── (also shared)       │
                      │                            │
              ┌───────┴──────────┐                 │
              ▼                  ▼                 │
        apps/desktop          apps/web         apps/server ◄── ③④
```

Turborepo encodes this graph via `dependsOn` so tasks are always executed in this order
with maximum parallelism within each wave.

---

## Components and Interfaces

### Annotated repository layout

Every file listed below must exist at scaffold time. Files marked `[stub]` contain
the minimum valid stub that satisfies TypeScript compilation; they are not yet
implemented.

```
kb/
├─ .nvmrc                              # Node version pin (e.g. "22.4.0")
├─ .gitignore
├─ package.json                        # root package — scripts only, no src
├─ pnpm-workspace.yaml
├─ turbo.json
├─ tsconfig.base.json
├─ docker-compose.yml
│
├─ .github/
│  └─ workflows/
│     ├─ ci.yml
│     ├─ desktop-release.yml
│     └─ deploy.yml
│
├─ apps/
│  ├─ desktop/
│  │  ├─ package.json                  # @kb/desktop — main: "./out/main/index.js"
│  │  ├─ tsconfig.json                 # extends ../../tsconfig.base.json
│  │  ├─ electron-builder.yml          # buildResources: build, output: dist-electron
│  │  ├─ electron.vite.config.ts
│  │  ├─ build/                        # electron-builder resources (icons, entitlements)
│  │  │  ├─ icon.png                   # app icon (all platforms)
│  │  │  ├─ icon.icns                  # macOS icon
│  │  │  ├─ icon.ico                   # Windows icon
│  │  │  └─ entitlements.mac.plist     # macOS notarization entitlements
│  │  └─ src/
│  │     ├─ main/
│  │     │  └─ index.ts                # [stub] window lifecycle, IPC handlers
│  │     ├─ preload/
│  │     │  └─ index.ts                # [stub] contextBridge.exposeInMainWorld
│  │     └─ renderer/
│  │        ├─ index.html              # renderer entry — includes CSP meta tag
│  │        └─ src/
│  │           └─ main.tsx             # [stub] React root
│  │
│  ├─ web/
│  │  ├─ package.json                  # @kb/web
│  │  ├─ tsconfig.json
│  │  ├─ next.config.ts
│  │  ├─ Dockerfile
│  │  └─ src/
│  │     ├─ app/
│  │     │  ├─ layout.tsx              # [stub] root layout with SessionProvider
│  │     │  ├─ page.tsx                # [stub] home page
│  │     │  ├─ (auth)/
│  │     │  │  └─ sign-in/
│  │     │  │     └─ page.tsx          # [stub] sign-in page
│  │     │  └─ api/
│  │     │     └─ auth/
│  │     │        └─ [...nextauth]/
│  │     │           └─ route.ts       # [stub] Auth.js route handler
│  │     └─ auth.ts                    # Auth.js config (GitHub provider)
│  │
│  └─ server/
│     ├─ package.json                  # @kb/server
│     ├─ tsconfig.json
│     ├─ Dockerfile
│     └─ src/
│        ├─ index.ts                   # [stub] Fastify app entry point
│        ├─ api/
│        │  ├─ index.ts                # [stub] plugin registrations
│        │  ├─ kb.ts                   # [stub] KB CRUD routes
│        │  ├─ git.ts                  # [stub] git operation routes
│        │  └─ agent.ts               # [stub] agent chat + SSE routes
│        ├─ repos/
│        │  ├─ EngineRegistry.ts       # [stub] per-user engine lifecycle
│        │  └─ RepoLockManager.ts      # [stub] per-repo async lock
│        └─ db/
│           ├─ schema.sql              # [stub] Postgres schema DDL
│           └─ client.ts              # [stub] postgres client factory
│
└─ packages/
   ├─ config/
   │  ├─ package.json                  # @kb/config
   │  ├─ eslint.config.js              # flat config with all 7 boundary rules
   │  ├─ prettier.config.js
   │  └─ tsconfig.base.json            # re-exported preset
   │
   ├─ shared/
   │  ├─ package.json                  # @kb/shared
   │  ├─ tsconfig.json
   │  └─ src/
   │     ├─ index.ts                   # barrel export
   │     ├─ schemas/
   │     │  ├─ document.ts             # [stub] Zod schemas for KB documents
   │     │  ├─ chat.ts                 # [stub] Zod schemas for chat records
   │     │  ├─ settings.ts             # [stub] Zod schemas for user settings
   │     │  ├─ git.ts                  # [stub] Zod schemas for git operations
   │     │  └─ forge.ts                # [stub] Zod schemas for forge entities
   │     └─ constants/
   │        └─ index.ts                # [stub] shared constants
   │
   ├─ core/
   │  ├─ package.json                  # @kb/core — NO SQL drivers, NO electron, NO next
   │  ├─ tsconfig.json
   │  └─ src/
   │     ├─ index.ts                   # barrel: exports CoreEngine + adapter types
   │     ├─ CoreEngine.ts              # [stub] class CoreEngine
   │     ├─ kb/
   │     │  └─ index.ts                # [stub] document model, markdown, search
   │     ├─ git/
   │     │  ├─ GitBackend.ts           # [stub] child_process.spawn wrapper
   │     │  └─ types.ts
   │     ├─ agent/
   │     │  ├─ AgentLoop.ts            # [stub] Claude Agent SDK loop
   │     │  ├─ PathContainmentCheck.ts # path containment — highest test budget
   │     │  ├─ tools.ts                # [stub] KB tool definitions
   │     │  └─ types.ts                # AgentKeyProvider interface
   │     ├─ forge/
   │     │  ├─ ForgeAdapter.ts         # ForgeAdapter interface
   │     │  └─ types.ts
   │     └─ store/
   │        ├─ StoreAdapter.ts         # StoreAdapter interface
   │        └─ types.ts
   │
   ├─ client/
   │  ├─ package.json                  # @kb/client
   │  ├─ tsconfig.json
   │  └─ src/
   │     ├─ types.ts                   # ClientInterface + KbError
   │     ├─ ipc.ts                     # Electron IPC binding — NO @kb/core imports
   │     └─ http.ts                    # fetch + EventSource binding — NO @kb/core imports
   │
   └─ ui/
      ├─ package.json                  # @kb/ui
      ├─ tsconfig.json
      └─ src/
         ├─ index.ts                   # barrel export
         ├─ tokens/
         │  └─ index.ts                # design tokens (colors, spacing, typography)
         └─ components/
            ├─ Button.tsx              # [stub]
            ├─ Input.tsx               # [stub]
            └─ index.ts               # re-exports all components
```

---

## Data Models

### Root configuration files

#### `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

#### `turbo.json`

The `dependsOn` arrays encode the build order from the Architecture section. The
`^build` prefix means "wait for the same task in all upstream workspace packages".

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "out/**"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "persistent": true,
      "cache": false
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    }
  }
}
```

The `^build` dependency on `dev` and `test` ensures that workspace packages are built
before any app that consumes them runs in dev mode or executes tests.

#### `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "incremental": true,
    "skipLibCheck": true,
    "paths": {
      "@kb/shared": ["./packages/shared/src/index.ts"],
      "@kb/shared/*": ["./packages/shared/src/*"],
      "@kb/config": ["./packages/config/index.ts"],
      "@kb/config/*": ["./packages/config/*"],
      "@kb/core": ["./packages/core/src/index.ts"],
      "@kb/core/*": ["./packages/core/src/*"],
      "@kb/client": ["./packages/client/src/types.ts"],
      "@kb/client/ipc": ["./packages/client/src/ipc.ts"],
      "@kb/client/http": ["./packages/client/src/http.ts"],
      "@kb/client/*": ["./packages/client/src/*"],
      "@kb/ui": ["./packages/ui/src/index.ts"],
      "@kb/ui/*": ["./packages/ui/src/*"]
    }
  }
}
```

`moduleResolution: NodeNext` is required for `electron-vite` (which uses ESM) and
Fastify. Package-level `tsconfig.json` files extend this base and set `outDir`, `rootDir`,
and include/exclude appropriately.

#### `docker-compose.yml`

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: kb
      POSTGRES_PASSWORD: kb
      POSTGRES_DB: kb
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  server:
    build:
      context: .
      dockerfile: apps/server/Dockerfile
    environment:
      DATABASE_URL: postgres://kb:kb@postgres:5432/kb
      NODE_ENV: development
    ports:
      - "3001:3001"
    depends_on:
      - postgres
    develop:
      watch:
        - action: rebuild
          path: apps/server
        - action: rebuild
          path: packages/core
        - action: rebuild
          path: packages/shared

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    environment:
      AUTH_URL: http://localhost:3000
      API_URL: http://server:3001
      NODE_ENV: development
    ports:
      - "3000:3000"
    depends_on:
      - server
    develop:
      watch:
        - action: rebuild
          path: apps/web
        - action: rebuild
          path: packages/ui
        - action: rebuild
          path: packages/client

volumes:
  postgres_data:
```

### Package shapes

#### `packages/config/package.json`

```json
{
  "name": "@kb/config",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./eslint": "./eslint.config.js",
    "./prettier": "./prettier.config.js",
    "./tsconfig": "./tsconfig.base.json"
  },
  "peerDependencies": {
    "eslint": "^9.0.0",
    "typescript": "^5.0.0",
    "prettier": "^3.0.0"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint-plugin-import-x": "^4.0.0",
    "eslint-plugin-boundaries": "^5.0.0"
  }
}
```

#### `packages/shared/package.json`

```json
{
  "name": "@kb/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "typecheck": "tsc --project tsconfig.json --noEmit",
    "test": "vitest run",
    "lint": "eslint src"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^2.0.0",
    "@kb/config": "workspace:*"
  }
}
```

Note: `@kb/shared` has **no** `@kb/*` imports in its source files (Requirement 2.1).

#### `packages/core/package.json`

```json
{
  "name": "@kb/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "typecheck": "tsc --project tsconfig.json --noEmit",
    "test": "vitest run",
    "lint": "eslint src"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.27.0",
    "@kb/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^2.0.0",
    "fast-check": "^3.21.0",
    "@kb/config": "workspace:*"
  }
}
```

No `better-sqlite3`, `pg`, `@octokit/rest`, or `electron` in dependencies (Requirements
5.2, 5.6).

#### `packages/client/package.json`

```json
{
  "name": "@kb/client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/types.ts",
    "./ipc": "./src/ipc.ts",
    "./http": "./src/http.ts"
  },
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "typecheck": "tsc --project tsconfig.json --noEmit",
    "lint": "eslint src"
  },
  "dependencies": {
    "@kb/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@kb/config": "workspace:*"
  }
}
```

#### `packages/ui/package.json`

```json
{
  "name": "@kb/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "typecheck": "tsc --project tsconfig.json --noEmit",
    "lint": "eslint src"
  },
  "dependencies": {
    "@kb/client": "workspace:*",
    "@kb/shared": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@kb/config": "workspace:*",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

`@kb/ui` must import from `@kb/client` only via `@kb/client/src/types.ts` (Requirement
2.5). The exports map above exposes no core import path.

#### `apps/desktop/package.json`

```json
{
  "name": "@kb/desktop",
  "version": "0.0.0",
  "private": true,
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build && electron-builder",
    "typecheck": "electron-vite typecheck",
    "lint": "eslint src",
    "test": "vitest run"
  },
  "dependencies": {
    "@kb/core": "workspace:*",
    "@kb/client": "workspace:*",
    "@kb/ui": "workspace:*",
    "@kb/shared": "workspace:*",
    "electron-updater": "^6.3.0"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "electron-vite": "^2.3.0",
    "electron-builder": "^24.13.0",
    "typescript": "^5.0.0",
    "@kb/config": "workspace:*",
    "vitest": "^2.0.0"
  }
}
```

#### `apps/web/package.json`

```json
{
  "name": "@kb/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "test": "vitest run"
  },
  "dependencies": {
    "@kb/client": "workspace:*",
    "@kb/ui": "workspace:*",
    "@kb/shared": "workspace:*",
    "next": "^15.0.0",
    "next-auth": "^5.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@kb/config": "workspace:*",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "vitest": "^2.0.0"
  }
}
```

#### `apps/server/package.json`

```json
{
  "name": "@kb/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch dist/index.js",
    "build": "tsc --project tsconfig.json",
    "start": "node dist/index.js",
    "typecheck": "tsc --project tsconfig.json --noEmit",
    "lint": "eslint src",
    "test": "vitest run"
  },
  "dependencies": {
    "@kb/core": "workspace:*",
    "@kb/client": "workspace:*",
    "@kb/shared": "workspace:*",
    "fastify": "^5.0.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/sensible": "^6.0.0",
    "pg": "^8.12.0",
    "async-mutex": "^0.5.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@kb/config": "workspace:*",
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0",
    "vitest": "^2.0.0",
    "fast-check": "^3.21.0"
  }
}
```

### Zod schema shapes (`packages/shared/src/schemas/`)

#### `document.ts`

```typescript
import { z } from "zod";

export const DocumentIdSchema = z.string().uuid();

export const KbDocumentSchema = z.object({
  id: DocumentIdSchema,
  path: z.string().min(1),          // relative path within KB root
  title: z.string(),
  content: z.string(),
  frontmatter: z.record(z.unknown()).optional(),
  sha: z.string().regex(/^[0-9a-f]{40}$/), // git object SHA
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KbDocument = z.infer<typeof KbDocumentSchema>;

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const SearchResultSchema = z.object({
  document: KbDocumentSchema,
  score: z.number(),
  excerpt: z.string(),
});
```

#### `chat.ts`

```typescript
import { z } from "zod";

export const ChatRecordIdSchema = z.string().uuid();

export const MessageRoleSchema = z.enum(["user", "assistant", "tool"]);

export const ChatMessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
  toolCallId: z.string().optional(),
  toolName: z.string().optional(),
});

export const ChatRecordSchema = z.object({
  id: ChatRecordIdSchema,
  userId: z.string(),
  messages: z.array(ChatMessageSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ChatRecord = z.infer<typeof ChatRecordSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
```

#### `settings.ts`

```typescript
import { z } from "zod";

export const UserSettingsSchema = z.object({
  anthropicApiKey: z.string().optional(),  // desktop only; server uses its own key
  kbRootPath: z.string().optional(),       // desktop: local path, server: workdir
  theme: z.enum(["light", "dark", "system"]).default("system"),
  defaultBranch: z.string().default("main"),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;
```

#### `git.ts`

```typescript
import { z } from "zod";

export const GitStatusFileSchema = z.object({
  path: z.string(),
  status: z.enum(["added", "modified", "deleted", "untracked", "renamed"]),
  oldPath: z.string().optional(), // for renames
});

export const GitStatusSchema = z.object({
  branch: z.string(),
  ahead: z.number().int().min(0),
  behind: z.number().int().min(0),
  files: z.array(GitStatusFileSchema),
});

export const GitCommitSchema = z.object({
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  message: z.string(),
  author: z.string(),
  timestamp: z.string().datetime(),
});

export type GitStatus = z.infer<typeof GitStatusSchema>;
export type GitCommit = z.infer<typeof GitCommitSchema>;
```

#### `forge.ts`

```typescript
import { z } from "zod";

export const ForgeRepoSchema = z.object({
  owner: z.string(),
  name: z.string(),
  cloneUrl: z.string().url(),
  defaultBranch: z.string(),
  isPrivate: z.boolean(),
});

export const OAuthTokenSchema = z.object({
  accessToken: z.string(),
  tokenType: z.string(),
  scope: z.string(),
  expiresAt: z.string().datetime().optional(),
});

export type ForgeRepo = z.infer<typeof ForgeRepoSchema>;
export type OAuthToken = z.infer<typeof OAuthTokenSchema>;
```

### `packages/config/eslint.config.js` — boundary rules

All seven boundary rules from Requirement 3. Uses ESLint v9 flat config.

```javascript
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

  // ── Rule 2: packages/core may only import @kb/shared from @kb/* ──────────
  {
    files: [`${root}/packages/core/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@kb/client", "@kb/client/*", "@kb/ui", "@kb/ui/*"],
              message: "packages/core may only import from @kb/shared.",
            },
          ],
        },
      ],
    },
  },

  // ── Rule 3: packages/ui must not import @kb/core or IPC/HTTP bindings ────
  {
    files: [`${root}/packages/ui/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@kb/core", message: "packages/ui must not import @kb/core." },
          ],
          patterns: [
            { group: ["@kb/client/ipc", "@kb/client/http"], message: "packages/ui must only use @kb/client types, not bindings." },
            { group: ["@kb/core", "@kb/core/*"], message: "packages/ui must not import @kb/core." },
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
```

**Rationale for `no-restricted-imports` over `eslint-plugin-boundaries`**: The
`no-restricted-imports` rule ships with ESLint core (no additional plugin needed beyond
import-x for resolution), is fully supported in flat config, and is sufficient to
express all seven boundary rules with path-glob patterns. `eslint-plugin-boundaries`
provides a richer element-type model but adds plugin dependency and config complexity
that isn't justified here.

### `packages/core` — CoreEngine and adapter interfaces

#### `packages/core/src/CoreEngine.ts`

```typescript
import type { StoreAdapter } from "./store/StoreAdapter.js";
import type { ForgeAdapter } from "./forge/ForgeAdapter.js";
import type { AgentKeyProvider } from "./agent/types.js";
import type { GitBackend } from "./git/GitBackend.js";

export interface CoreEngineConfig {
  kbRoot: string;
  store: StoreAdapter;
  forge: ForgeAdapter;
  agentKeyProvider: AgentKeyProvider;
  git: GitBackend;
}

export class CoreEngine {
  constructor(private readonly config: CoreEngineConfig) {
    // Validate kbRoot is an absolute path
    if (!config.kbRoot.startsWith("/") && !config.kbRoot.match(/^[A-Z]:\\/)) {
      throw new Error("kbRoot must be an absolute path");
    }
  }

  // KB operations (stubs — implementation in Phase 2)
  async readDocument(path: string): Promise<unknown> { throw new Error("not implemented"); }
  async writeDocument(path: string, content: string): Promise<unknown> { throw new Error("not implemented"); }
  async deleteDocument(path: string): Promise<void> { throw new Error("not implemented"); }
  async searchDocuments(query: string): Promise<unknown[]> { throw new Error("not implemented"); }

  // Git operations
  async gitClone(url: string): Promise<void> { throw new Error("not implemented"); }
  async gitCommit(message: string, paths: string[]): Promise<unknown> { throw new Error("not implemented"); }
  async gitPush(): Promise<void> { throw new Error("not implemented"); }
  async gitPull(): Promise<void> { throw new Error("not implemented"); }
  async gitStatus(): Promise<unknown> { throw new Error("not implemented"); }

  // Agent
  async agentChat(message: string): Promise<unknown> { throw new Error("not implemented"); }
  agentChatStream(message: string): AsyncIterable<string> { throw new Error("not implemented"); }
}
```

All four adapter interfaces are required constructor parameters. The engine never
instantiates an adapter itself; injection is the caller's responsibility.

#### `packages/core/src/store/StoreAdapter.ts`

```typescript
import type {
  ChatRecord,
  ChatMessage,
  UserSettings,
} from "@kb/shared";

export interface StoreAdapter {
  // Chat operations
  createChatRecord(record: Omit<ChatRecord, "id" | "createdAt" | "updatedAt">): Promise<ChatRecord>;
  readChatRecord(id: string): Promise<ChatRecord | null>;
  updateChatRecord(id: string, messages: ChatMessage[]): Promise<ChatRecord>;
  deleteChatRecord(id: string): Promise<void>;

  // Settings
  readSettings(): Promise<UserSettings>;
  writeSettings(settings: Partial<UserSettings>): Promise<UserSettings>;
}
```

All method signatures use only domain types from `@kb/shared`. No SQL dialect types,
column names, or query strings appear in the interface (Requirement 5.8).

#### `packages/core/src/forge/ForgeAdapter.ts`

```typescript
import type { OAuthToken, ForgeRepo } from "@kb/shared";

export interface WebhookConfig {
  url: string;
  events: string[];
  secret: string;
}

export interface WebhookRecord {
  id: string;
  url: string;
  active: boolean;
}

export interface ForgeAdapter {
  /**
   * Exchange an OAuth authorization code for an access token.
   * No GitHub API endpoint URLs appear in this signature.
   */
  exchangeOAuthCode(code: string, state: string): Promise<OAuthToken>;

  /**
   * Create a new repository in the authenticated user's account.
   */
  createRepository(name: string, options: { private: boolean; description?: string }): Promise<ForgeRepo>;

  /**
   * Register a webhook on the specified repository.
   */
  registerWebhook(repo: ForgeRepo, config: WebhookConfig): Promise<WebhookRecord>;
}
```

No GitHub API endpoint URLs, header names, or response-body shapes appear in the
interface (Requirement 5.9).

#### `packages/core/src/agent/types.ts`

```typescript
export interface AgentKeyProvider {
  /**
   * Returns the API key to use for the Claude Agent SDK.
   * May be async — the key might be fetched from a keychain, env var (server),
   * or user-supplied settings (desktop).
   */
  getApiKey(): Promise<string>;
}
```

The engine never calls `process.env` or any file-system API for the key (Requirement
5.4). It always calls `agentKeyProvider.getApiKey()`.

#### `packages/core/src/git/GitBackend.ts`

```typescript
import type { GitStatus, GitCommit } from "@kb/shared";

export interface GitBackend {
  clone(url: string, targetDir: string): Promise<void>;
  status(repoDir: string): Promise<GitStatus>;
  commit(repoDir: string, message: string, paths: string[]): Promise<GitCommit>;
  push(repoDir: string, remote?: string, branch?: string): Promise<void>;
  pull(repoDir: string, remote?: string, branch?: string): Promise<void>;
}
```

The concrete implementation uses `child_process.spawn` to invoke the `git` binary
(Requirement 5.7). No Node.js package requiring native compilation is used.

```typescript
// packages/core/src/git/SpawnGitBackend.ts — implementation sketch
import { spawn } from "child_process";
import type { GitBackend } from "./GitBackend.js";
import type { GitStatus, GitCommit } from "@kb/shared";

async function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    proc.stdout.on("data", (d: Buffer) => chunks.push(d));
    proc.stderr.on("data", (d: Buffer) => errChunks.push(d));
    proc.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks).toString("utf8"));
      else reject(new Error(`git ${args[0]} failed (exit ${code}): ${Buffer.concat(errChunks).toString("utf8")}`));
    });
  });
}

export class SpawnGitBackend implements GitBackend {
  async clone(url: string, targetDir: string): Promise<void> {
    await runGit(["clone", "--", url, targetDir], process.cwd());
  }
  // ... status, commit, push, pull implemented similarly
}
```

### `packages/core/src/agent/PathContainmentCheck.ts`

This is the single containment-validation function for all agent file writes. It has the
highest test budget in the codebase — see Correctness Properties.

```typescript
import { resolve, normalize, sep } from "node:path";

export class ContainmentError extends Error {
  constructor(
    public readonly target: string,
    public readonly kbRoot: string,
  ) {
    super(
      `Path "${target}" is not contained within KB root "${kbRoot}". ` +
      `Write rejected.`
    );
    this.name = "ContainmentError";
  }
}

/**
 * Validates that `targetPath` resolves to a location strictly inside `kbRoot`.
 *
 * Rules enforced:
 *  1. kbRoot is normalised by stripping any trailing path separator.
 *  2. targetPath is canonicalised with path.resolve.
 *  3. The canonicalised path must begin with normalised kbRoot + sep.
 *     The target may NOT be kbRoot itself (only files inside it are valid).
 *  4. Returns the canonicalised path on success.
 *  5. Throws ContainmentError on any violation.
 *  6. Never throws any other exception for any string input.
 */
export function checkContainment(kbRoot: string, targetPath: string): string {
  try {
    // Rule 1: strip trailing separator(s)
    const normRoot = kbRoot.replace(/[/\\]+$/, "");

    // Rule 2: canonicalise target
    const canonTarget = resolve(targetPath);

    // Rule 3: require strict containment — kbRoot/... not kbRoot itself
    const prefix = normRoot + sep;
    if (!canonTarget.startsWith(prefix)) {
      throw new ContainmentError(canonTarget, normRoot);
    }

    // Rule 4: return canonicalised path
    return canonTarget;
  } catch (err) {
    // Rule 6: re-throw only ContainmentError; wrap anything unexpected
    if (err instanceof ContainmentError) throw err;
    throw new ContainmentError(String(targetPath), String(kbRoot));
  }
}
```

**Design decisions:**

- `path.resolve` without a `cwd` argument resolves against `process.cwd()`. Agent code
  always passes absolute paths so this is safe; but the containment check remains
  correct even if a relative path slips through because `resolve` will still produce an
  absolute canonical path that won't start with a different absolute root.
- The `ContainmentError` type is exported so callers can `instanceof`-check without
  inspecting message strings.
- The outer `try/catch` ensures no input string — including empty strings, null bytes,
  or strings that cause `path.resolve` to throw — can escape as an unhandled exception
  (Requirement 6.6).

### `packages/client/src/types.ts` — ClientInterface

```typescript
import type {
  KbDocument,
  SearchQuery,
  SearchResult,
  GitStatus,
  GitCommit,
  ChatRecord,
  ChatMessage,
} from "@kb/shared";

// ── Typed error shape (Requirement 4.6) ─────────────────────────────────────

export type KbErrorCode =
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "CONFLICT"
  | "GIT_ERROR"
  | "AGENT_ERROR"
  | "CONTAINMENT_ERROR"
  | "AUTH_ERROR"
  | "UNKNOWN";

export interface KbError {
  code: KbErrorCode;
  message: string;
  details?: unknown;
}

export type KbResult<T> = { ok: true; data: T } | { ok: false; error: KbError };

// ── Client interface (Requirement 4.1) ──────────────────────────────────────

export interface ClientInterface {
  // Document operations
  readDocument(path: string): Promise<KbResult<KbDocument>>;
  writeDocument(path: string, content: string): Promise<KbResult<KbDocument>>;
  deleteDocument(path: string): Promise<KbResult<void>>;
  searchDocuments(query: SearchQuery): Promise<KbResult<SearchResult[]>>;

  // Git operations
  gitClone(url: string): Promise<KbResult<void>>;
  gitCommit(message: string, paths: string[]): Promise<KbResult<GitCommit>>;
  gitPush(): Promise<KbResult<void>>;
  gitPull(): Promise<KbResult<void>>;
  gitStatus(): Promise<KbResult<GitStatus>>;

  // Agent — single turn
  agentChat(message: string): Promise<KbResult<ChatMessage>>;

  // Agent — streaming
  agentChatStream(message: string): AsyncIterable<KbResult<string>>;
}

// Augment the Window type so renderer code gets type-safe access
declare global {
  interface Window {
    kb: ClientInterface;
  }
}
```

Every method returns `KbResult<T>`, which carries either the typed success value or a
`KbError`. UI code never catches raw exceptions from KB operations.

### IPC Binding pattern (`packages/client/src/ipc.ts`)

```typescript
// NO imports from @kb/core or any re-export of @kb/core (Requirement 4.2)
import type { ClientInterface, KbResult, KbError } from "./types.js";
import type { KbDocument, SearchQuery, GitCommit, GitStatus, ChatMessage } from "@kb/shared";

// ipcRenderer is injected at runtime by Electron's preload context.
// We declare only what we need from the electron namespace rather than
// importing the module, so this file has zero electron imports.
declare const ipcRenderer: {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
};

async function invoke<T>(channel: string, ...args: unknown[]): Promise<KbResult<T>> {
  try {
    const result = await ipcRenderer.invoke(channel, ...args);
    return { ok: true, data: result as T };
  } catch (err: unknown) {
    const kbError: KbError = (err as { kbError?: KbError }).kbError ?? {
      code: "UNKNOWN",
      message: err instanceof Error ? err.message : String(err),
    };
    return { ok: false, error: kbError };
  }
}

export const ipcBinding: ClientInterface = {
  readDocument: (path) => invoke<KbDocument>("kb:readDocument", path),
  writeDocument: (path, content) => invoke<KbDocument>("kb:writeDocument", path, content),
  deleteDocument: (path) => invoke<void>("kb:deleteDocument", path),
  searchDocuments: (query: SearchQuery) => invoke("kb:searchDocuments", query),
  gitClone: (url) => invoke<void>("kb:gitClone", url),
  gitCommit: (message, paths) => invoke<GitCommit>("kb:gitCommit", message, paths),
  gitPush: () => invoke<void>("kb:gitPush"),
  gitPull: () => invoke<void>("kb:gitPull"),
  gitStatus: () => invoke<GitStatus>("kb:gitStatus"),
  agentChat: (message) => invoke<ChatMessage>("kb:agentChat", message),

  async *agentChatStream(message: string) {
    // Streaming via IPC: the main process sends incremental events over a
    // named channel; the preload registers a one-time listener.
    yield* ipcStreamIterable<string>("kb:agentChatStream", message);
  },
};

async function* ipcStreamIterable<T>(
  channel: string,
  ...args: unknown[]
): AsyncIterable<KbResult<T>> {
  // Implementation detail: each IPC streaming call uses a unique reply-channel
  // returned by the main process so multiple concurrent streams don't collide.
  // Full implementation in Phase 3.
  throw new Error(`${channel} streaming not yet implemented`);
}
```

The `declare const ipcRenderer` approach avoids importing the `electron` module while
still allowing TypeScript to type-check usage. The actual `ipcRenderer` value is
available in the preload context by Electron's runtime injection.

### HTTP Binding pattern (`packages/client/src/http.ts`)

```typescript
// NO imports from @kb/core (Requirement 4.3)
import type { ClientInterface, KbResult, KbError } from "./types.js";
import type { KbDocument, SearchQuery, GitCommit, GitStatus, ChatMessage } from "@kb/shared";

async function apiFetch<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<KbResult<T>> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { "Content-Type": "application/json", ...init?.headers },
      ...init,
    });
    if (!res.ok) {
      const error: KbError = await res.json().catch(() => ({
        code: "UNKNOWN" as const,
        message: `HTTP ${res.status}`,
      }));
      return { ok: false, error };
    }
    const data: T = await res.json();
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: { code: "UNKNOWN", message: err instanceof Error ? err.message : String(err) },
    };
  }
}

export function createHttpBinding(baseUrl: string): ClientInterface {
  return {
    readDocument: (path) =>
      apiFetch<KbDocument>(baseUrl, `/kb/document?path=${encodeURIComponent(path)}`),
    writeDocument: (path, content) =>
      apiFetch<KbDocument>(baseUrl, "/kb/document", {
        method: "PUT",
        body: JSON.stringify({ path, content }),
      }),
    deleteDocument: (path) =>
      apiFetch<void>(baseUrl, `/kb/document?path=${encodeURIComponent(path)}`, { method: "DELETE" }),
    searchDocuments: (query: SearchQuery) =>
      apiFetch(baseUrl, "/kb/search", { method: "POST", body: JSON.stringify(query) }),
    gitClone: (url) =>
      apiFetch<void>(baseUrl, "/git/clone", { method: "POST", body: JSON.stringify({ url }) }),
    gitCommit: (message, paths) =>
      apiFetch<GitCommit>(baseUrl, "/git/commit", { method: "POST", body: JSON.stringify({ message, paths }) }),
    gitPush: () => apiFetch<void>(baseUrl, "/git/push", { method: "POST" }),
    gitPull: () => apiFetch<void>(baseUrl, "/git/pull", { method: "POST" }),
    gitStatus: () => apiFetch<GitStatus>(baseUrl, "/git/status"),
    agentChat: (message) =>
      apiFetch<ChatMessage>(baseUrl, "/agent/chat", { method: "POST", body: JSON.stringify({ message }) }),

    async *agentChatStream(message: string) {
      // Uses browser EventSource for SSE streaming (Requirement 4.3)
      yield* sseIterable<string>(`${baseUrl}/agent/chat/stream?message=${encodeURIComponent(message)}`);
    },
  };
}

async function* sseIterable<T>(url: string): AsyncIterable<KbResult<T>> {
  const es = new EventSource(url);
  const queue: KbResult<T>[] = [];
  let resolve: (() => void) | null = null;
  let done = false;

  es.onmessage = (evt) => {
    queue.push({ ok: true, data: JSON.parse(evt.data) as T });
    resolve?.();
    resolve = null;
  };
  es.onerror = () => {
    done = true;
    es.close();
    resolve?.();
    resolve = null;
  };

  while (!done || queue.length > 0) {
    if (queue.length === 0) {
      await new Promise<void>((r) => { resolve = r; });
    }
    while (queue.length > 0) {
      yield queue.shift()!;
    }
  }
}
```

### `apps/desktop` — Electron configuration

#### `apps/desktop/electron.vite.config.ts`

```typescript
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@kb/shared": resolve("../../packages/shared/src/index.ts"),
        "@kb/core": resolve("../../packages/core/src/index.ts"),
        "@kb/client": resolve("../../packages/client/src/types.ts"),
      },
    },
    // electron-vite outputs main process to out/main/index.js by default
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        "@kb/client": resolve("../../packages/client/src/types.ts"),
      },
    },
    // electron-vite outputs preload to out/preload/index.mjs when the package
    // has "type": "module". The BrowserWindow constructor must reference
    // out/preload/index.mjs (not .js) — see main/index.ts below.
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        "@kb/client": resolve("../../packages/client/src/types.ts"),
        "@kb/ui": resolve("../../packages/ui/src/index.ts"),
        "@kb/shared": resolve("../../packages/shared/src/index.ts"),
      },
    },
    // electron-vite outputs renderer assets to out/renderer/
  },
});
```

**Output layout**: electron-vite builds to `out/` by default (`out/main/index.js`,
`out/preload/index.mjs`, `out/renderer/`). electron-builder then packages the contents
of `out/` (via `files: ["out/**"]`) into a distributable in `dist-electron/`. The
`build/` directory alongside `src/` supplies electron-builder's icon assets and the
macOS notarization entitlements plist referenced as `entitlementsInherit: build/entitlements.mac.plist`
in `electron-builder.yml`; without it, electron-builder will fail to locate those
resources at package time.

#### `apps/desktop/electron-builder.yml`

```yaml
appId: com.kb.desktop
productName: KB
copyright: "Copyright © 2024"

directories:
  buildResources: build   # icons and entitlements are in apps/desktop/build/
  output: dist-electron

files:
  - "out/**"
  - "!**/*.map"

publish:
  provider: github
  releaseType: release
  # Auto-update feed points to GitHub Releases (Requirement 8.8)

win:
  target:
    - target: nsis
      arch: [x64, arm64]
  sign: ${WINDOWS_CERT_BASE64}
  signingHashAlgorithms:
    - sha256
nsis:
  artifactName: "${productName}-${version}-setup.${ext}"
  shortcutName: "${productName}"
  uninstallDisplayName: "${productName}"
  createDesktopShortcut: always

mac:
  target:
    - target: dmg
      arch: [x64, arm64]
  entitlementsInherit: build/entitlements.mac.plist
  notarize:
    teamId: ${APPLE_TEAM_ID}
  # Certificate loaded from APPLE_CERT_BASE64 secret in CI
dmg:
  artifactName: "${productName}-${version}.${ext}"
```

The `publish.provider: github` instructs `electron-updater` to check GitHub Releases for
updates. The auto-update feed URL is derived from the repository metadata at build time
(Requirement 8.8).

#### `apps/desktop/src/renderer/index.html` — CSP stub

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    />
    <title>KB</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

The CSP restricts scripts and styles to same-origin, preventing injection of remote
scripts into the renderer (Electron security best practice).

#### `apps/desktop/src/preload/index.ts` — contextBridge bridge

```typescript
// Requirement 11: preload script exposes ONLY the IPC binding
// NO imports from @kb/core or any package re-exporting @kb/core
import { contextBridge, ipcRenderer as _ipcRenderer } from "electron";
import type { ClientInterface } from "@kb/client";

// Make ipcRenderer available to ipcBinding without an import in ipc.ts
// The binding file declares `ipcRenderer` as ambient and we inject it here.
import { ipcBinding } from "@kb/client/ipc";

// Single exposeInMainWorld call with a single key "kb" (Requirement 11.1, 11.2)
contextBridge.exposeInMainWorld("kb", ipcBinding satisfies ClientInterface);
```

The `satisfies ClientInterface` operator causes a compile-time error if `ipcBinding`
does not implement every method of `ClientInterface` (Requirement 4.4).

**Key constraints enforced:**
- `contextBridge.exposeInMainWorld` is called **exactly once** (Requirement 11.2).
- The exposed object is `ipcBinding` — nothing more (Requirement 11.1).
- No `@kb/core` import appears in preload (Requirement 11.3).
- The `"kb"` key matches the `Window.kb` declaration in `@kb/client/src/types.ts`.

**ESM preload note**: because `apps/desktop` sets `"type": "module"` in its
`package.json`, electron-vite outputs the preload bundle as `out/preload/index.mjs`
(not `.js`). The `BrowserWindow` constructor in `main/index.ts` must therefore
reference the preload as `index.mjs`; see the main process sketch below.

#### `apps/desktop/src/main/index.ts` — IPC handlers sketch

```typescript
import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import { CoreEngine } from "@kb/core";
import { SpawnGitBackend } from "@kb/core/git/SpawnGitBackend";
// StoreAdapter (SQLite) and AgentKeyProvider (desktop settings) are
// instantiated here — they are the only files in the monorepo that
// import better-sqlite3 and read process.env.

const engines = new Map<number, CoreEngine>(); // keyed by webContents.id

// Each window gets its own CoreEngine instance (Requirement 11.7)
function getEngine(windowId: number): CoreEngine {
  const engine = engines.get(windowId);
  if (!engine) throw new Error(`No engine for window ${windowId}`);
  return engine;
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      // ESM preload: electron-vite outputs out/preload/index.mjs when the
      // package has "type": "module". Use import.meta.url (not __dirname)
      // because this is an ES module context.
      preload: fileURLToPath(new URL("../preload/index.mjs", import.meta.url)),
      contextIsolation: true,   // enforced: renderer has no direct Node access
      sandbox: false,           // required: electron-vite bundles preload deps
      nodeIntegration: false,   // enforced: renderer must use the preload bridge
    },
  });

  // Register the CoreEngine instance for this window
  win.webContents.on("did-finish-load", () => {
    engines.set(win.webContents.id, new CoreEngine({ /* config */ } as any));
  });
  win.on("closed", () => {
    engines.delete(win.webContents.id);
  });

  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(fileURLToPath(new URL("../renderer/index.html", import.meta.url)));
  }
}

app.whenReady().then(createWindow);

// IPC handler pattern (Requirement 11.4-11.6)
ipcMain.handle("kb:readDocument", async (event, path: string) => {
  try {
    return await getEngine(event.sender.id).readDocument(path);
  } catch (err) {
    // Structured error reply so IPC binding can reject the promise (Requirement 11.6)
    throw Object.assign(new Error((err as Error).message), {
      kbError: {
        code: (err as { code?: string }).code ?? "UNKNOWN",
        message: (err as Error).message,
      },
    });
  }
});
// ... remaining handlers follow the same pattern
```

### `apps/web` — Next.js + Auth.js

#### `apps/web/src/auth.ts`

```typescript
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Persist the GitHub access token in the JWT (Requirement 13.7)
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      // Make the access token available to server components and API routes
      (session as typeof session & { accessToken?: string }).accessToken =
        token.accessToken as string | undefined;
      return session;
    },
  },
});
```

#### `apps/web/src/app/api/auth/[...nextauth]/route.ts`

```typescript
import { handlers } from "../../../auth";
export const { GET, POST } = handlers;
```

#### `apps/web/src/app/layout.tsx`

Protected routes: any route outside `/(auth)` is protected by Auth.js middleware.
The `middleware.ts` file at the `src/` root handles redirect logic (Requirement 12.4).

```typescript
// apps/web/src/middleware.ts
export { auth as middleware } from "./auth";

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

### `apps/server` — Fastify plugin structure

#### `apps/server/src/index.ts`

```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { apiPlugin } from "./api/index.js";
import { EngineRegistry } from "./repos/EngineRegistry.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" });
await app.register(sensible);

// Decorate with the engine registry so plugins can access it
const registry = new EngineRegistry({
  idleTimeoutMs: Number(process.env.ENGINE_IDLE_TIMEOUT_MS ?? 30 * 60 * 1000),
});
app.decorate("registry", registry);

await app.register(apiPlugin, { prefix: "/api" });

await app.listen({ port: 3001, host: "0.0.0.0" });
```

#### `apps/server/src/repos/EngineRegistry.ts`

```typescript
import { CoreEngine, type CoreEngineConfig } from "@kb/core";
import { RepoLockManager } from "./RepoLockManager.js";

interface EngineEntry {
  engine: CoreEngine;
  lastAccessedAt: number;
  idleTimer: ReturnType<typeof setTimeout>;
}

export interface EngineRegistryConfig {
  idleTimeoutMs: number; // default 30 min; valid range 1–1440 min (Requirement 13.3)
}

/**
 * Maintains a registry of active CoreEngine instances keyed by user ID.
 * Handles lazy construction, idle eviction, and working directory cleanup.
 * (Requirements 13.1–13.4)
 */
export class EngineRegistry {
  private readonly engines = new Map<string, EngineEntry>();
  private readonly locks = new RepoLockManager();

  constructor(private readonly config: EngineRegistryConfig) {
    const minMs = 60_000;       // 1 minute
    const maxMs = 86_400_000;   // 1440 minutes
    if (config.idleTimeoutMs < minMs || config.idleTimeoutMs > maxMs) {
      throw new RangeError(
        `idleTimeoutMs must be between ${minMs} and ${maxMs}; got ${config.idleTimeoutMs}`,
      );
    }
  }

  async getOrCreate(userId: string, factory: () => CoreEngineConfig): Promise<CoreEngine> {
    const existing = this.engines.get(userId);
    if (existing) {
      this.resetIdleTimer(userId, existing);
      return existing.engine;
    }

    // Construct new instance (Requirement 13.2)
    const engine = new CoreEngine(factory());
    const entry: EngineEntry = {
      engine,
      lastAccessedAt: Date.now(),
      idleTimer: this.scheduleEviction(userId),
    };
    this.engines.set(userId, entry);
    return engine;
  }

  private resetIdleTimer(userId: string, entry: EngineEntry): void {
    clearTimeout(entry.idleTimer);
    entry.lastAccessedAt = Date.now();
    entry.idleTimer = this.scheduleEviction(userId);
  }

  private scheduleEviction(userId: string): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      void this.evict(userId);
    }, this.config.idleTimeoutMs);
  }

  private async evict(userId: string): Promise<void> {
    const entry = this.engines.get(userId);
    if (!entry) return;
    this.engines.delete(userId);
    // Attempt to release working directory; log failure and mark for retry (Requirement 13.4)
    try {
      await this.releaseWorkdir(userId);
    } catch (err) {
      console.error(`[EngineRegistry] Failed to release workdir for user ${userId}:`, err);
      // TODO: add userId to pending-release queue for background cleanup
    }
  }

  private async releaseWorkdir(_userId: string): Promise<void> {
    // Implementation in Phase 4: remove the server-side git clone directory
  }

  getLockManager(): RepoLockManager {
    return this.locks;
  }
}
```

#### `apps/server/src/repos/RepoLockManager.ts`

```typescript
import { Mutex, withTimeout } from "async-mutex";

const MAX_QUEUE_DEPTH = 50;      // Requirement 13.6
const LOCK_WAIT_TIMEOUT_MS = 30_000; // 30 seconds

export class ContentionError extends Error {
  constructor(public readonly userId: string) {
    super(`Request queue for user "${userId}" is full or timed out.`);
    this.name = "ContentionError";
  }
}

/**
 * Per-user, per-repository advisory lock.
 * Enforces max queue depth of 50 and 30s wait timeout (Requirements 13.5–13.7).
 */
export class RepoLockManager {
  private readonly locks = new Map<string, Mutex>();
  private readonly queueDepths = new Map<string, number>();

  private getLock(userId: string): Mutex {
    if (!this.locks.has(userId)) {
      this.locks.set(userId, new Mutex());
      this.queueDepths.set(userId, 0);
    }
    return this.locks.get(userId)!;
  }

  async runWithLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const depth = this.queueDepths.get(userId) ?? 0;
    if (depth >= MAX_QUEUE_DEPTH) {
      throw new ContentionError(userId);
    }

    this.queueDepths.set(userId, depth + 1);
    const lock = withTimeout(this.getLock(userId), LOCK_WAIT_TIMEOUT_MS);

    try {
      return await lock.runExclusive(fn);
    } catch (err) {
      // Mutex timeout throws E_TIMEOUT; translate to ContentionError
      if ((err as { name?: string }).name === "E_TIMEOUT") {
        throw new ContentionError(userId);
      }
      throw err;
    } finally {
      const current = this.queueDepths.get(userId) ?? 1;
      this.queueDepths.set(userId, Math.max(0, current - 1));
    }
  }
}
```

### Dockerfiles

#### `apps/server/Dockerfile`

```dockerfile
# ── Stage 1: install dependencies ─────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Copy workspace manifests for pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
COPY packages/core/package.json   ./packages/core/
COPY packages/client/package.json ./packages/client/
COPY apps/server/package.json     ./apps/server/

RUN corepack enable pnpm && pnpm install --frozen-lockfile

# ── Stage 2: build ────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

COPY packages/ ./packages/
COPY apps/server/ ./apps/server/
COPY tsconfig.base.json ./

RUN pnpm --filter @kb/shared build && \
    pnpm --filter @kb/core build && \
    pnpm --filter @kb/client build && \
    pnpm --filter @kb/server build

# ── Stage 3: production image ─────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Only production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/core/dist   ./packages/core/dist
COPY --from=builder /app/packages/client/dist ./packages/client/dist
COPY --from=builder /app/apps/server/dist     ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/

# git must be installed for child_process.spawn("git", ...) to work
RUN apk add --no-cache git

EXPOSE 3001

CMD ["node", "apps/server/dist/index.js"]
```

#### `apps/web/Dockerfile`

```dockerfile
# ── Stage 1: install dependencies ─────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json  ./packages/shared/
COPY packages/config/package.json  ./packages/config/
COPY packages/client/package.json  ./packages/client/
COPY packages/ui/package.json      ./packages/ui/
COPY apps/web/package.json         ./apps/web/

RUN corepack enable pnpm && pnpm install --frozen-lockfile

# ── Stage 2: build ────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
COPY tsconfig.base.json ./

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @kb/shared build && \
    pnpm --filter @kb/client build && \
    pnpm --filter @kb/ui build && \
    pnpm --filter @kb/web build

# ── Stage 3: production image ─────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
```

### GitHub Actions workflows

#### `.github/workflows/ci.yml` — PR checks

```yaml
name: CI

on:
  pull_request:
    branches:
      - main

jobs:
  ci:
    name: Lint · Typecheck · Test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 2  # Turborepo needs HEAD^ for affected detection

      - name: Read Node version
        id: node-version
        # Requirement 7.4: fail with explicit error if version unresolvable
        run: |
          if [ -f .nvmrc ]; then
            echo "version=$(cat .nvmrc)" >> "$GITHUB_OUTPUT"
          elif node -e "require('./package.json').engines?.node" 2>/dev/null | grep -q .; then
            echo "version=$(node -e "console.log(require('./package.json').engines.node)")" >> "$GITHUB_OUTPUT"
          else
            echo "::error::Cannot resolve Node.js version from .nvmrc or package.json engines field"
            exit 1
          fi

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ steps.node-version.outputs.version }}

      - name: Set up pnpm
        uses: pnpm/action-setup@v4
        with:
          run_install: false

      - name: Get pnpm store path
        id: pnpm-cache
        run: echo "dir=$(pnpm store path --silent)" >> "$GITHUB_OUTPUT"

      - name: Cache pnpm store
        uses: actions/cache@v4
        with:
          path: ${{ steps.pnpm-cache.outputs.dir }}
          key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: ${{ runner.os }}-pnpm-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint, typecheck, and test (Turborepo cached)
        # Requirement 7.3: remote cache; continue if unavailable
        run: pnpm turbo run lint typecheck test --cache-dir=.turbo
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

**Notes:**
- The `continue-on-error` is NOT used here — any non-zero exit from `turbo run` fails
  the job immediately (Requirement 7.2).
- `TURBO_TOKEN` / `TURBO_TEAM` are optional; if the secrets are absent, Turborepo falls
  back to local caching (Requirement 7.3).
- The `.nvmrc` check runs before any other task and fails with a clear message if the
  file is absent (Requirement 7.4, 7.5).

#### `.github/workflows/desktop-release.yml` — Desktop release

```yaml
name: Desktop Release

on:
  push:
    tags:
      - "v*"   # Requirement 8.2

jobs:
  release:
    name: Build · Sign · Release (${{ matrix.os }})
    # Requirement 8.3: mac + windows matrix
    strategy:
      fail-fast: true   # Requirement 8.9: don't upload partial artifacts
      matrix:
        os: [macos-latest, windows-latest]

    runs-on: ${{ matrix.os }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Read Node version
        id: node-version
        shell: bash
        run: |
          if [ -f .nvmrc ]; then
            echo "version=$(cat .nvmrc)" >> "$GITHUB_OUTPUT"
          else
            echo "version=$(node -e "console.log(require('./package.json').engines.node)")" >> "$GITHUB_OUTPUT"
          fi

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ steps.node-version.outputs.version }}

      - name: Set up pnpm
        uses: pnpm/action-setup@v4
        with:
          run_install: false

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build workspace packages
        run: pnpm turbo run build --filter=@kb/desktop^...

      # ── macOS: import certificate and notarize ────────────────────────────
      - name: Import macOS certificate
        if: matrix.os == 'macos-latest'
        # Requirement 8.5
        run: |
          echo "${{ secrets.APPLE_CERT_BASE64 }}" | base64 --decode > certificate.p12
          security create-keychain -p "" build.keychain
          security import certificate.p12 -k ~/Library/Keychains/build.keychain -P "" -T /usr/bin/codesign
          security list-keychains -s ~/Library/Keychains/build.keychain
          security set-key-partition-list -S apple-tool:,apple: -s -k "" ~/Library/Keychains/build.keychain
          rm certificate.p12

      - name: Build and notarize Desktop App (macOS)
        if: matrix.os == 'macos-latest'
        working-directory: apps/desktop
        run: pnpm build
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # ── Windows: import certificate and sign ─────────────────────────────
      - name: Import Windows certificate
        if: matrix.os == 'windows-latest'
        # Requirement 8.6
        shell: pwsh
        run: |
          $cert = [System.Convert]::FromBase64String("${{ secrets.WINDOWS_CERT_BASE64 }}")
          [System.IO.File]::WriteAllBytes("certificate.p12", $cert)

      - name: Build and sign Desktop App (Windows)
        if: matrix.os == 'windows-latest'
        working-directory: apps/desktop
        run: pnpm build
        env:
          WIN_CSC_LINK: certificate.p12
          WIN_CSC_KEY_PASSWORD: ""
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # ── Upload artifacts to GitHub Release ───────────────────────────────
      # Requirement 8.7: upload .dmg and .exe to the GitHub Release for the tag
      # electron-builder's --publish=always handles this when GH_TOKEN is set.
      # The publish config in electron-builder.yml points to the GitHub Release.
```

**Design note:** `electron-builder` with `publish: { provider: 'github' }` and
`GH_TOKEN` set will automatically create or update the GitHub Release for the triggering
tag and upload the built artifacts. The `fail-fast: true` matrix strategy ensures that
if the macOS build fails, the Windows build is cancelled — no partial uploads reach the
release (Requirement 8.9).

#### `.github/workflows/deploy.yml` — Server and web deploy

```yaml
name: Deploy

on:
  push:
    branches:
      - main   # Requirement 9.1

jobs:
  build-and-push:
    name: Build and push container images
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Log in to container registry
        # Requirement 9.3: authenticate before any push
        uses: docker/login-action@v3
        with:
          registry: ${{ secrets.REGISTRY_URL }}
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Extract git SHA tag
        id: meta
        run: |
          SHA=$(git rev-parse HEAD)
          echo "sha=${SHA}" >> "$GITHUB_OUTPUT"
          echo "short_sha=${SHA:0:7}" >> "$GITHUB_OUTPUT"

      # ── Build and push apps/server ─────────────────────────────────────
      # Requirement 9.4: if server build fails, do NOT push web image
      - name: Build and push server image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/server/Dockerfile
          push: true
          # Requirement 9.5: tag with full git SHA and latest
          tags: |
            ${{ secrets.REGISTRY_URL }}/kb/server:${{ steps.meta.outputs.sha }}
            ${{ secrets.REGISTRY_URL }}/kb/server:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # ── Build and push apps/web ────────────────────────────────────────
      - name: Build and push web image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/web/Dockerfile
          push: true
          # Requirement 9.5: tag with full git SHA and latest
          tags: |
            ${{ secrets.REGISTRY_URL }}/kb/web:${{ steps.meta.outputs.sha }}
            ${{ secrets.REGISTRY_URL }}/kb/web:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**Notes:**
- Steps are sequential. If `docker/login-action` fails, the job fails immediately
  (Requirement 9.3). If the server build step fails, the web build step never runs
  (Requirement 9.4). If a push step fails, the GitHub Actions step exit code propagates
  and the job fails (Requirement 9.6).
- Both images are tagged with the full 40-character git SHA and `latest`
  (Requirement 9.5).

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The scaffold introduces two subsystems with meaningful universal properties: the
**Path Containment Check** (the security-critical write gate) and the **EngineRegistry**
queue behaviour. All other scaffold requirements are structural/configuration checks
appropriately covered by TypeScript compilation, lint, smoke tests, and integration
tests.

Testing library for property-based tests: [`fast-check`](https://fast-check.dev/) (already in
`@kb/core` and `@kb/server` `devDependencies`).

---

### Property 1: Path containment is trailing-separator-independent

*For any* absolute KB root path and any valid target path contained inside that root,
the result of `checkContainment(root, target)` must be identical whether `root` is
supplied with or without a trailing path separator.

**Validates: Requirement 6.1**

---

### Property 2: Path traversal is always rejected

*For any* KB root path and *any* target path whose `path.resolve` result does not begin
with `normalise(root) + sep`, `checkContainment` must throw a `ContainmentError` and
never return a value. This includes: sibling directories (`/root/../sibling`),
the root itself (`/root`), absolute paths outside the root (`/etc/passwd`), and
empty strings.

**Validates: Requirements 6.2, 6.3**

---

### Property 3: Valid contained paths are returned canonicalized

*For any* KB root path `R` and *any* path that resolves strictly inside `R` (i.e.
`resolved.startsWith(R + sep)` is true), `checkContainment(R, path)` must return
exactly `path.resolve(path)`.

**Validates: Requirement 6.4**

---

### Property 4: No string input causes an unhandled exception

*For any* pair of arbitrary strings `(kbRoot, targetPath)`, calling
`checkContainment(kbRoot, targetPath)` must either return a string or throw a
`ContainmentError`. It must never throw any other exception type.

**Validates: Requirement 6.6**

---

### Property 5: Adapter errors propagate unchanged

*For any* error value thrown by a mock `StoreAdapter`, `ForgeAdapter`, or
`AgentKeyProvider`, when a `CoreEngine` method delegates to that adapter and the adapter
throws, the `CoreEngine` method must reject with the exact same error object — no
wrapping, no transformation, no retry.

**Validates: Requirement 5.10**

---

### Property 6: Engine registry queue enforces max depth

*For any* sequence of concurrent requests for the same user where the total in-flight
count exceeds `MAX_QUEUE_DEPTH` (50), every request beyond the 50th must be rejected
with a `ContentionError` and no additional `CoreEngine` instance must be created.

**Validates: Requirements 13.6, 13.7**

---

### Property 7: Engine registry timeout rejects waiting requests

*For any* user whose `CoreEngine` instance holds a repository lock for longer than
`LOCK_WAIT_TIMEOUT_MS` (30 s), any request that has been queued for more than 30 s must
be rejected with a `ContentionError` and must not be processed after the lock becomes
available.

**Validates: Requirement 13.6**

---

### Property 8: Import boundaries hold for all source files in packages/*

*For any* source file under `packages/*/src/`, the set of its resolved import targets
must not include any path under `apps/`. Additionally, for any source file under
`packages/core/src/`, all `@kb/*` imports must resolve exclusively to `@kb/shared`.

**Validates: Requirements 3.1, 3.2**

This property is enforced at build time by the ESLint boundary rules in
`packages/config/eslint.config.js`. It can also be verified in CI via `pnpm turbo lint`.

---

## Error Handling

### Adapter error propagation

When any adapter method (`StoreAdapter`, `ForgeAdapter`, `AgentKeyProvider`) throws or
rejects, `CoreEngine` propagates the error to its caller unchanged (Requirement 5.10).
No retry logic is applied at the adapter boundary. Retry — if needed — belongs in the
adapter implementation or in higher-level application code.

### ClientInterface error shape

All `ClientInterface` methods return `KbResult<T>`, which is either `{ ok: true, data: T }`
or `{ ok: false, error: KbError }`. UI code never needs to `try/catch` around KB
operations; it always inspects the `ok` discriminant.

`KbError.code` is a typed enum (`KbErrorCode`) so switch exhaustiveness checks work in
TypeScript without runtime string comparison.

### ContainmentError

`checkContainment` throws `ContainmentError` (a proper `Error` subclass) rather than
returning `null` or a sentinel value. This prevents callers from accidentally proceeding
on a write that should be blocked — a thrown error can't be silently ignored the way a
nullable return can be.

### IPC error transport

The Electron main process wraps engine exceptions in a plain object with a `kbError`
property before rethrowing (so Electron's IPC serialisation preserves the structured
error). The preload `invoke` helper reconstructs a `KbError` from that object, ensuring
the renderer always receives a typed error regardless of what the engine threw.

### Fastify contention errors

`RepoLockManager` throws `ContentionError` when the queue is full or times out. Fastify
route handlers catch `ContentionError` and return HTTP 503 with a structured error body
matching the `KbError` schema.

### Docker build failures

Both Dockerfiles use multi-stage builds. If any `RUN` instruction fails, Docker exits
non-zero and the `docker/build-push-action` step fails. The deploy workflow treats any
step failure as a job failure (no `continue-on-error`), so partial images are never
pushed (Requirement 9.4).

---

## Testing Strategy

### Unit tests (Vitest)

- **`packages/core`** has the highest unit test budget. `PathContainmentCheck.ts` and
  the adapter interfaces are tested exhaustively.
- **`packages/shared`** tests that Zod schemas accept valid data and reject invalid data
  with the right error paths.
- **`packages/client`** tests the `KbResult` helpers and the error-shape parsing in the
  IPC and HTTP invoke wrappers using mock `ipcRenderer` and `fetch`.
- **`apps/server`** tests `EngineRegistry` and `RepoLockManager` with mock
  `CoreEngine` factories.
- Keep unit tests focused on specific examples and error conditions; avoid duplicating
  what property tests cover.

### Property-based tests (fast-check, minimum 100 iterations per property)

Each property below maps 1-to-1 to a Correctness Property in the section above.
Tag format: `Feature: monorepo-scaffold, Property {N}: {property title}`.

```typescript
// packages/core/src/agent/PathContainmentCheck.test.ts

import { describe, it } from "vitest";
import fc from "fast-check";
import { checkContainment, ContainmentError } from "./PathContainmentCheck.js";
import { sep } from "node:path";

describe("PathContainmentCheck", () => {
  // Feature: monorepo-scaffold, Property 1 - Path containment is trailing-separator-independent
  it("yields the same result with or without trailing separator", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("/repo", "/home/user/kb", "/data/myrepo"),
        fc.string({ minLength: 1 }),
        (root, suffix) => {
          const target = `${root}${sep}${suffix}`;
          let r1: string | null = null, e1: unknown = null;
          let r2: string | null = null, e2: unknown = null;
          try { r1 = checkContainment(root, target); } catch (e) { e1 = e; }
          try { r2 = checkContainment(`${root}/`, target); } catch (e) { e2 = e; }
          if (e1 || e2) {
            return (e1 instanceof ContainmentError) === (e2 instanceof ContainmentError);
          }
          return r1 === r2;
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: monorepo-scaffold, Property 2 - Path traversal is always rejected
  it("throws ContainmentError for any path not strictly inside kbRoot", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("/repo", "/home/user/kb"),
        fc.oneof(
          fc.constantFrom("/etc/passwd", "/", "/repo/../etc", ""),
          fc.string().map((s) => `/other/${s}`),
        ),
        (root, target) => {
          try {
            checkContainment(root, target);
            return false; // should have thrown
          } catch (e) {
            return e instanceof ContainmentError;
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: monorepo-scaffold, Property 3 - Valid contained paths are returned canonicalized
  it("returns resolve(target) for paths strictly inside kbRoot", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("/repo", "/home/user/kb"),
        fc.string({ minLength: 1 }).filter((s) => !s.includes("..") && !s.startsWith("/")),
        (root, relative) => {
          const target = `${root}${sep}${relative}`;
          const result = checkContainment(root, target);
          return result === require("node:path").resolve(target);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: monorepo-scaffold, Property 4 - No string input causes an unhandled exception
  it("never throws anything other than ContainmentError for arbitrary string inputs", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        (root, target) => {
          try {
            checkContainment(root, target);
            return true;
          } catch (e) {
            return e instanceof ContainmentError;
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
```

```typescript
// apps/server/src/repos/EngineRegistry.test.ts

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { RepoLockManager, ContentionError } from "./RepoLockManager.js";

describe("RepoLockManager", () => {
  // Feature: monorepo-scaffold, Property 6 - Queue enforces max depth
  it("rejects requests beyond MAX_QUEUE_DEPTH", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 51, max: 200 }),
        async (numRequests) => {
          const manager = new RepoLockManager();
          const hold = new Promise<void>((r) => setTimeout(r, 100));
          // Saturate the queue
          const settled = await Promise.allSettled(
            Array.from({ length: numRequests }, () =>
              manager.runWithLock("user-1", () => hold),
            ),
          );
          const rejected = settled.filter(
            (r) => r.status === "rejected" && r.reason instanceof ContentionError,
          );
          return rejected.length >= numRequests - 50;
        },
      ),
      { numRuns: 20 }, // fewer runs because each test is async/heavy
    );
  });
});
```

### Integration tests (Vitest + real processes)

- **Workspace linkage**: `pnpm install` + `pnpm turbo run typecheck` in CI validates
  that all `@kb/*` packages are resolvable.
- **Lint boundaries**: `pnpm turbo run lint` in CI validates all 7 ESLint boundary
  rules across the full workspace.
- **Auth.js flow**: mocked GitHub OAuth responses test the token-exchange callback path
  in `apps/web`.
- **IPC round-trip**: a test that boots Electron in headless mode and exercises the
  preload bridge for one `readDocument` call.

### Smoke tests

- Config file existence and structure (all files listed in the Annotated Repository
  Layout section).
- `docker compose config` validates the `docker-compose.yml` syntax without starting
  services.
- Workflow file YAML validity via `actionlint` in CI.
