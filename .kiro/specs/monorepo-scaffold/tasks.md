# Implementation Plan: monorepo-scaffold

## Overview

Bootstrap the `kb/` monorepo from an empty directory to a fully typed, lint-enforced,
CI-wired skeleton. Work follows the build order in the design: config presets first,
then shared schemas, then core engine and adapter interfaces, then client contract and
bindings, then UI shell, then the three app hosts, then Docker images and GitHub Actions
workflows. Property-based tests for the two security-critical subsystems are woven in
directly after the code they validate.

---

## Tasks

- [x] 1. Scaffold root workspace configuration
  - Create `pnpm-workspace.yaml` declaring `apps/*` and `packages/*` as workspace
    members (exact YAML from design § Data Models / Root configuration files).
  - Create `turbo.json` with `build`, `dev`, `lint`, `typecheck`, and `test` tasks;
    every task must include a `dependsOn: ["^build"]` or equivalent edge so downstream
    packages never build before their upstream dependencies.
  - Create `tsconfig.base.json` with `strict: true`, `exactOptionalPropertyTypes`,
    `noUncheckedIndexedAccess`, `noImplicitOverride`, `module: NodeNext`,
    `moduleResolution: NodeNext`, and `paths` entries for every `@kb/*` alias pointing
    to source entry points (not `dist/`).
  - Create `.nvmrc` pinning Node 22 (matches `node:22-alpine` in Dockerfiles).
  - Create root `package.json` with workspace-level `scripts` only (no `src`, no
    runtime dependencies).
  - Create `.gitignore` covering `node_modules`, `dist`, `.next`, `out`, `.turbo`,
    `*.tsbuildinfo`, and coverage directories.
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 10.1–10.7_

- [x] 2. Create `packages/config` — shared toolchain presets
  - [x] 2.1 Create `packages/config` package skeleton
    - Create `packages/config/package.json` exactly as specified in the design:
      name `@kb/config`, `type: "module"`, exports map with `./eslint`,
      `./prettier`, `./tsconfig`, peer dependencies on `eslint ^9`, `typescript ^5`,
      `prettier ^3`, dev dependencies for `@typescript-eslint/*`,
      `eslint-plugin-import-x`, and `eslint-plugin-boundaries`.
    - Create `packages/config/tsconfig.base.json` (re-exported TypeScript preset).
    - Create `packages/config/prettier.config.js` with sensible defaults
      (e.g., `semi: true`, `singleQuote: false`, `printWidth: 100`).
    - _Requirements: 2.2_

  - [x] 2.2 Implement the ESLint boundary rules
    - Create `packages/config/eslint.config.js` implementing all seven boundary rules
      exactly as specified in the design § `eslint.config.js — boundary rules`:
      - Rule 1: `packages/*` must not import from `apps/*`
      - Rule 2: `packages/core` may only import `@kb/shared` from `@kb/*`
      - Rule 3: `packages/ui` must not import `@kb/core` or IPC/HTTP bindings
      - Rule 4: `apps/desktop/src/renderer` must not import `electron` or Node
        built-ins (all 14 listed in Requirement 3.4)
      - Rule 5: only `apps/desktop` may import `electron`
      - Rule 6: only `apps/web` may import `next`
      - Rule 7: non-zero ESLint exit propagated by Turborepo
    - Use ESLint v9 flat config with `no-restricted-imports` (not
      `eslint-plugin-boundaries`) — see design rationale note.
    - _Requirements: 3.1–3.7, 2.9_

- [x] 3. Create `packages/shared` — Zod schemas and domain types
  - [x] 3.1 Create `packages/shared` package skeleton
    - Create `packages/shared/package.json` exactly as in the design: name
      `@kb/shared`, `type: "module"`, `main: "./src/index.ts"`, scripts for
      `build`, `typecheck`, `test`, `lint`; dependencies: `zod ^3.23`; dev
      dependencies: `typescript ^5`, `vitest ^2`, `@kb/config: workspace:*`.
    - Create `packages/shared/tsconfig.json` extending `../../tsconfig.base.json`
      with `outDir: "dist"`, `rootDir: "src"`.
    - _Requirements: 2.1_

  - [x] 3.2 Implement all five Zod schema files
    - Create `packages/shared/src/schemas/document.ts` — `DocumentIdSchema`,
      `KbDocumentSchema` (id, path, title, content, frontmatter, sha, timestamps),
      `SearchQuerySchema` (q, limit, offset), `SearchResultSchema`.
    - Create `packages/shared/src/schemas/chat.ts` — `ChatRecordIdSchema`,
      `MessageRoleSchema`, `ChatMessageSchema`, `ChatRecordSchema`; export
      `ChatRecord` and `ChatMessage` types.
    - Create `packages/shared/src/schemas/settings.ts` — `UserSettingsSchema`
      (anthropicApiKey, kbRootPath, theme, defaultBranch); export `UserSettings` type.
    - Create `packages/shared/src/schemas/git.ts` — `GitStatusFileSchema`,
      `GitStatusSchema`, `GitCommitSchema`; export `GitStatus` and `GitCommit` types.
    - Create `packages/shared/src/schemas/forge.ts` — `ForgeRepoSchema`,
      `OAuthTokenSchema`; export `ForgeRepo` and `OAuthToken` types.
    - All schemas use the exact field names, validators, and defaults from the design
      (e.g., sha validated with `/^[0-9a-f]{40}$/`).
    - Create `packages/shared/src/constants/index.ts` as a stub exporting an empty
      object (populated in Phase 2).
    - Create `packages/shared/src/index.ts` barrel re-exporting all schemas, types,
      and constants.
    - Confirm: no `@kb/*` imports anywhere in `packages/shared/src/`.
    - _Requirements: 2.1_

- [x] 4. Create `packages/core` — CoreEngine, adapter interfaces, GitBackend,
    PathContainmentCheck
  - [x] 4.1 Create `packages/core` package skeleton
    - Create `packages/core/package.json` exactly as in the design: name `@kb/core`,
      `type: "module"`, scripts for `build`, `typecheck`, `test`, `lint`; runtime
      dependencies `@anthropic-ai/sdk ^0.27`, `@kb/shared: workspace:*`; dev
      dependencies `typescript ^5`, `vitest ^2`, `fast-check ^3.21`,
      `@kb/config: workspace:*`.
    - Confirm package.json contains NO `better-sqlite3`, `pg`, `@octokit/*`, or
      `electron`.
    - Create `packages/core/tsconfig.json` extending `../../tsconfig.base.json`.
    - Create all required source directories: `src/kb/`, `src/git/`, `src/agent/`,
      `src/forge/`, `src/store/`.
    - _Requirements: 2.3, 5.2, 5.6_

  - [x] 4.2 Implement the four adapter interfaces
    - Create `packages/core/src/store/StoreAdapter.ts` — interface with
      `createChatRecord`, `readChatRecord`, `updateChatRecord`, `deleteChatRecord`,
      `readSettings`, `writeSettings`; all parameter/return types must be domain types
      from `@kb/shared` only (no SQL-dialect types).
    - Create `packages/core/src/store/types.ts` (stub, for future shared store types).
    - Create `packages/core/src/forge/ForgeAdapter.ts` — interface with
      `exchangeOAuthCode`, `createRepository`, `registerWebhook`; `WebhookConfig` and
      `WebhookRecord` helper types; all types from `@kb/shared` only, no GitHub API
      endpoint URLs.
    - Create `packages/core/src/forge/types.ts` (stub).
    - Create `packages/core/src/agent/types.ts` — `AgentKeyProvider` interface with
      `getApiKey(): Promise<string>`.
    - Create `packages/core/src/git/GitBackend.ts` — interface with `clone`, `status`,
      `commit`, `push`, `pull`; parameter/return types from `@kb/shared`.
    - Create `packages/core/src/git/types.ts` (stub).
    - _Requirements: 5.1, 5.3, 5.5, 5.7, 5.8, 5.9_

  - [x] 4.3 Implement `SpawnGitBackend`
    - Create `packages/core/src/git/SpawnGitBackend.ts` implementing `GitBackend`
      using `child_process.spawn("git", ...)` exclusively — no native-compilation npm
      packages.
    - Implement `clone`, `status`, `commit`, `push`, and `pull` using the `runGit`
      helper shown in the design (resolves on exit code 0, rejects with stderr on
      non-zero).
    - _Requirements: 5.7_

  - [x] 4.4 Implement `PathContainmentCheck`
    - Create `packages/core/src/agent/PathContainmentCheck.ts` implementing the
      `checkContainment(kbRoot, targetPath)` function and `ContainmentError` class
      exactly as specified in the design:
      - Rule 1: strip trailing separators from `kbRoot`
      - Rule 2: canonicalize target with `path.resolve`
      - Rule 3: require `canonTarget.startsWith(normRoot + sep)` — kbRoot itself is
        rejected
      - Rule 4: return canonicalized path on success
      - Rule 5/6: outer try/catch wraps every exception; only `ContainmentError` escapes
    - Export both `checkContainment` and `ContainmentError`.
    - _Requirements: 6.1–6.6_

  - [x] 4.5 Implement `CoreEngine` stub
    - Create `packages/core/src/CoreEngine.ts` with `CoreEngineConfig` interface
      (kbRoot, store, forge, agentKeyProvider, git) and `CoreEngine` class.
    - Constructor validates that `kbRoot` is an absolute path; throws if not.
    - Constructor accepts all four adapters as required parameters — no optional fields.
    - All methods (`readDocument`, `writeDocument`, `deleteDocument`,
      `searchDocuments`, `gitClone`, `gitCommit`, `gitPush`, `gitPull`, `gitStatus`,
      `agentChat`, `agentChatStream`) are stubs that `throw new Error("not implemented")`.
    - Create `packages/core/src/kb/index.ts`, `packages/core/src/agent/tools.ts`,
      `packages/core/src/agent/AgentLoop.ts` as stubs.
    - Create `packages/core/src/index.ts` barrel exporting `CoreEngine`,
      `CoreEngineConfig`, and all adapter interface types.
    - Confirm: no `process.env` or `fs.readFile` calls in any `packages/core` source
      for key retrieval.
    - _Requirements: 5.1–5.10_

  - [x] 4.6 Write property-based tests for `PathContainmentCheck`
    - Create `packages/core/src/agent/PathContainmentCheck.test.ts` using Vitest +
      fast-check.
    - **Property 1: Trailing-separator independence** — for any root + contained
      target, result is the same with and without trailing `/` on root.
      Tag: `Feature: monorepo-scaffold, Property 1`
      **Validates: Requirement 6.1**
    - **Property 2: Path traversal always rejected** — for any root and any target
      whose `resolve()` does not begin with `normRoot + sep`, must throw
      `ContainmentError` (test sibling dirs, the root itself, `/etc/passwd`,
      empty strings, arbitrary strings).
      Tag: `Feature: monorepo-scaffold, Property 2`
      **Validates: Requirements 6.2, 6.3**
    - **Property 3: Valid paths returned canonicalized** — for any root `R` and path
      strictly inside it, must return `path.resolve(target)`.
      Tag: `Feature: monorepo-scaffold, Property 3`
      **Validates: Requirement 6.4**
    - **Property 4: No unhandled exceptions** — for arbitrary string pair
      `(kbRoot, targetPath)`, must either return a string or throw `ContainmentError`,
      never any other exception type.
      Tag: `Feature: monorepo-scaffold, Property 4`
      **Validates: Requirement 6.6**
    - Minimum 100 iterations per property (`{ numRuns: 100 }`).
    - Use the exact test structure from the design § Testing Strategy.

- [x] 5. Checkpoint — core compiles and property tests pass
  - Run `pnpm --filter @kb/config build`, `pnpm --filter @kb/shared build`,
    `pnpm --filter @kb/core typecheck`.
  - Run `pnpm --filter @kb/core test` and confirm all four `PathContainmentCheck`
    properties pass.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Create `packages/client` — ClientInterface, IPC binding, HTTP binding
  - [x] 6.1 Create `packages/client` package skeleton
    - Create `packages/client/package.json` exactly as in the design: name
      `@kb/client`, `type: "module"`, exports map `"."→./src/types.ts`,
      `"./ipc"→./src/ipc.ts`, `"./http"→./src/http.ts`; runtime dep
      `@kb/shared: workspace:*`; dev deps `typescript ^5`, `@kb/config: workspace:*`.
    - Confirm: no `@kb/core` dependency anywhere in `packages/client/package.json`.
    - Create `packages/client/tsconfig.json` extending `../../tsconfig.base.json`.
    - _Requirements: 2.4_

  - [x] 6.2 Implement `ClientInterface` and typed error shapes in `types.ts`
    - Create `packages/client/src/types.ts` with:
      - `KbErrorCode` union type (7 codes: `NOT_FOUND`, `PERMISSION_DENIED`,
        `CONFLICT`, `GIT_ERROR`, `AGENT_ERROR`, `CONTAINMENT_ERROR`, `AUTH_ERROR`,
        `UNKNOWN`).
      - `KbError` interface (`code`, `message`, `details?`).
      - `KbResult<T>` discriminated union (`{ ok: true; data: T }` |
        `{ ok: false; error: KbError }`).
      - `ClientInterface` with all 11 methods: `readDocument`, `writeDocument`,
        `deleteDocument`, `searchDocuments`, `gitClone`, `gitCommit`, `gitPush`,
        `gitPull`, `gitStatus`, `agentChat`, `agentChatStream` (AsyncIterable).
      - Global `Window` augmentation: `window.kb: ClientInterface`.
    - All method signatures use types from `@kb/shared` only.
    - _Requirements: 4.1, 4.4, 4.6_

  - [x] 6.3 Implement the IPC binding in `ipc.ts`
    - Create `packages/client/src/ipc.ts` with:
      - Zero imports from `@kb/core` or any package re-exporting `@kb/core`.
      - `declare const ipcRenderer` (ambient declaration — not an import from
        `electron`).
      - `invoke<T>()` helper that calls `ipcRenderer.invoke()` and wraps success in
        `{ ok: true }` and errors in `{ ok: false, error: KbError }`.
      - `ipcBinding` object implementing every `ClientInterface` method via `invoke`.
      - `agentChatStream` stub using `ipcStreamIterable` (throws "not yet implemented"
        as in the design — full streaming in Phase 3).
    - _Requirements: 4.2, 4.4_

  - [x] 6.4 Implement the HTTP binding in `http.ts`
    - Create `packages/client/src/http.ts` with:
      - Zero imports from `@kb/core`.
      - `apiFetch<T>()` helper using browser `fetch`; wraps errors in `KbError`.
      - `createHttpBinding(baseUrl)` factory returning a `ClientInterface` where every
        request/reply method uses `apiFetch` with the URL paths from the design.
      - `agentChatStream` implemented via `sseIterable()` using browser `EventSource`.
      - `sseIterable` async generator as shown in the design.
    - _Requirements: 4.3_

- [x] 7. Create `packages/ui` — shared React components and design tokens
  - [x] 7.1 Create `packages/ui` package skeleton
    - Create `packages/ui/package.json` exactly as in the design: name `@kb/ui`,
      `type: "module"`, exports `"."→./src/index.ts`; runtime deps
      `@kb/client: workspace:*`, `@kb/shared: workspace:*`, `react ^18.3`,
      `react-dom ^18.3`; dev deps `typescript ^5`, `@kb/config: workspace:*`,
      `@types/react ^18.3`, `@types/react-dom ^18.3`.
    - Confirm: no `@kb/core` in package.json and no `@kb/client/ipc` or
      `@kb/client/http` imports anywhere in `packages/ui/src/`.
    - Create `packages/ui/tsconfig.json` extending `../../tsconfig.base.json` with
      `jsx: "react-jsx"`.
    - _Requirements: 2.5_

  - [x] 7.2 Implement design tokens and component stubs
    - Create `packages/ui/src/tokens/index.ts` exporting color, spacing, and
      typography token constants.
    - Create `packages/ui/src/components/Button.tsx` — stub React component
      (renders a `<button>` with a `children` prop; no logic yet).
    - Create `packages/ui/src/components/Input.tsx` — stub React component
      (renders an `<input>`; no logic yet).
    - Create `packages/ui/src/components/index.ts` re-exporting `Button` and `Input`.
    - Create `packages/ui/src/index.ts` barrel exporting tokens and all components.
    - _Requirements: 2.5_

- [x] 8. Create `apps/desktop` — Electron host with preload bridge and IPC handlers
  - [x] 8.1 Create `apps/desktop` package skeleton and Electron configuration
    - Create `apps/desktop/package.json` exactly as in the design: name `@kb/desktop`,
      scripts for `dev`, `build`, `typecheck`, `lint`, `test`; runtime deps
      `@kb/core`, `@kb/client`, `@kb/ui`, `@kb/shared`, `electron-updater ^6.3`;
      dev deps `electron ^31`, `electron-vite ^2.3`, `electron-builder ^24.13`,
      `typescript ^5`, `@kb/config: workspace:*`, `vitest ^2`.
    - Create `apps/desktop/tsconfig.json` extending `../../tsconfig.base.json`.
    - Create `apps/desktop/electron.vite.config.ts` with the alias maps for `main`,
      `preload`, and `renderer` sections exactly as in the design; include
      `externalizeDepsPlugin()` in main and preload sections.
    - Create `apps/desktop/electron-builder.yml` with `appId: com.kb.desktop`,
      macOS DMG + NSIS targets for x64/arm64, `publish.provider: github` for
      auto-update, and signing/notarization placeholders.
    - _Requirements: 2.6, 8.4, 8.8_

  - [x] 8.2 Implement the preload bridge
    - Create `apps/desktop/src/preload/index.ts`:
      - Import `contextBridge` from `electron` and `ipcBinding` from
        `@kb/client/ipc`.
      - Call `contextBridge.exposeInMainWorld("kb", ipcBinding)` exactly once.
      - Use `satisfies ClientInterface` operator to get compile-time completeness check.
      - NO imports from `@kb/core` or any package re-exporting `@kb/core`.
    - _Requirements: 11.1, 11.2, 11.3, 4.5_

  - [x] 8.3 Implement the Electron main process stub
    - Create `apps/desktop/src/main/index.ts`:
      - Window lifecycle: create `BrowserWindow` on `app.whenReady()`, handle
        `window-all-closed`.
      - `engines: Map<number, CoreEngine>` keyed by `webContents.id` (one engine per
        window, Requirement 11.7).
      - `getEngine(windowId)` helper that throws if window has no registered engine.
      - Register at minimum the `kb:readDocument` IPC handler using `ipcMain.handle`;
        handler calls `getEngine(event.sender.id).readDocument(path)`, catches errors,
        and rethrows with `kbError` property attached (Requirement 11.6).
      - Remaining KB IPC handlers (`kb:writeDocument`, `kb:deleteDocument`,
        `kb:searchDocuments`, `kb:gitClone`, `kb:gitCommit`, `kb:gitPush`,
        `kb:gitPull`, `kb:gitStatus`, `kb:agentChat`) following the same error-wrapping
        pattern.
    - _Requirements: 11.4–11.7_

  - [x] 8.4 Create renderer stub
    - Create `apps/desktop/src/renderer/index.html` — minimal HTML shell loading the
      React entry.
    - Create `apps/desktop/src/renderer/src/main.tsx` — stub React root calling
      `ReactDOM.createRoot(document.getElementById("root")!).render(<App />)` with
      a placeholder `<App />` component.
    - _Requirements: 2.6_

- [x] 9. Create `apps/web` — Next.js App Router with Auth.js
  - [x] 9.1 Create `apps/web` package skeleton and Next.js configuration
    - Create `apps/web/package.json` exactly as in the design: name `@kb/web`,
      scripts for `dev`, `build`, `start`, `typecheck`, `lint`, `test`; runtime deps
      `@kb/client`, `@kb/ui`, `@kb/shared`, `next ^15`, `next-auth ^5`,
      `react ^18.3`, `react-dom ^18.3`; dev deps `typescript ^5`,
      `@kb/config: workspace:*`, `@types/node ^22`, `@types/react ^18.3`,
      `vitest ^2`.
    - Confirm: no `@kb/core` dependency in package.json.
    - Create `apps/web/tsconfig.json` extending `../../tsconfig.base.json` with Next.js
      required settings (`jsx: "preserve"`, `plugins: [{ name: "next" }]`).
    - Create `apps/web/next.config.ts` — minimal Next.js 15 App Router config with
      `transpilePackages: ["@kb/ui", "@kb/shared", "@kb/client"]`.
    - _Requirements: 2.7_

  - [x] 9.2 Implement Auth.js GitHub OAuth integration
    - Create `apps/web/src/auth.ts` with `NextAuth({ providers: [GitHub({...})] })`
      including `jwt` callback that persists `account.access_token` to `token.accessToken`
      and `session` callback that copies it to the session object.
    - Create `apps/web/src/app/api/auth/[...nextauth]/route.ts` exporting
      `{ GET, POST } = handlers` from `../../../auth`.
    - Create `apps/web/src/middleware.ts` exporting `auth as middleware` with a
      `config.matcher` that protects all routes except `api/auth`, static files, and
      `favicon.ico`.
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.7_

  - [x] 9.3 Create web app page stubs
    - Create `apps/web/src/app/layout.tsx` — root layout stub with
      `SessionProvider` wrapping `{children}`.
    - Create `apps/web/src/app/page.tsx` — stub home page (renders a placeholder
      heading).
    - Create `apps/web/src/app/(auth)/sign-in/page.tsx` — stub sign-in page with a
      "Sign in with GitHub" button calling `signIn("github")`.
    - _Requirements: 2.7, 12.4_

- [x] 10. Create `apps/server` — Fastify API with EngineRegistry and RepoLockManager
  - [x] 10.1 Create `apps/server` package skeleton
    - Create `apps/server/package.json` exactly as in the design: name `@kb/server`,
      `type: "module"`, scripts for `dev`, `build`, `start`, `typecheck`, `lint`,
      `test`; runtime deps `@kb/core`, `@kb/client`, `@kb/shared`, `fastify ^5`,
      `@fastify/cors ^10`, `@fastify/sensible ^6`, `pg ^8.12`,
      `async-mutex ^0.5`; dev deps `typescript ^5`, `@kb/config: workspace:*`,
      `@types/node ^22`, `@types/pg ^8.11`, `vitest ^2`, `fast-check ^3.21`.
    - Create `apps/server/tsconfig.json` extending `../../tsconfig.base.json`.
    - _Requirements: 2.8_

  - [x] 10.2 Implement `RepoLockManager`
    - Create `apps/server/src/repos/RepoLockManager.ts` implementing the class as
      specified in the design:
      - `ContentionError` class (exported, extends `Error`).
      - `MAX_QUEUE_DEPTH = 50`, `LOCK_WAIT_TIMEOUT_MS = 30_000`.
      - `locks: Map<string, Mutex>` and `queueDepths: Map<string, number>`.
      - `runWithLock<T>(userId, fn)`: checks depth ≥ 50 → throw `ContentionError`;
        increments depth; wraps mutex with `withTimeout(lock, 30_000)`; decrements
        depth in `finally`; translates `E_TIMEOUT` → `ContentionError`.
    - _Requirements: 13.5, 13.6, 13.7_

  - [x] 10.3 Implement `EngineRegistry`
    - Create `apps/server/src/repos/EngineRegistry.ts` implementing the class as
      specified in the design:
      - `EngineRegistryConfig` interface (`idleTimeoutMs`).
      - Constructor validates `idleTimeoutMs` is between 60_000 and 86_400_000;
        throws `RangeError` if out of range (maps to 1–1440 minutes, Requirement 13.3).
      - `getOrCreate(userId, factory)`: returns existing engine with reset idle timer,
        or constructs a new `CoreEngine` via `factory()`.
      - `scheduleEviction` / `resetIdleTimer` using `setTimeout`.
      - `evict(userId)`: removes entry, calls `releaseWorkdir`, logs failure and
        marks for retry on error (Requirement 13.4).
      - `releaseWorkdir` as a stub (populated in Phase 4).
      - `getLockManager()` returns the internal `RepoLockManager`.
    - _Requirements: 13.1–13.4_

  - [x] 10.4 Write property-based tests for `RepoLockManager`
    - Create `apps/server/src/repos/RepoLockManager.test.ts` using Vitest + fast-check.
    - **Property 6: Queue enforces max depth** — for any sequence of N > 50 concurrent
      requests for the same user where the mutex is held throughout, at least N−50
      requests must be rejected with `ContentionError` and no duplicate engine
      constructed.
      Tag: `Feature: monorepo-scaffold, Property 6`
      **Validates: Requirements 13.6, 13.7**
    - **Property 7: Timeout rejects waiting requests** — for any user whose lock is
      held beyond `LOCK_WAIT_TIMEOUT_MS`, queued requests past the timeout must be
      rejected with `ContentionError` and must not be processed after lock release.
      Tag: `Feature: monorepo-scaffold, Property 7`
      **Validates: Requirement 13.6**
    - Use `{ numRuns: 20 }` for async/concurrent properties (design rationale: each
      test is heavy).

  - [x] 10.5 Implement Fastify server entry point and API plugin stubs
    - Create `apps/server/src/index.ts` as specified in the design: instantiate
      `Fastify({ logger: true })`, register `@fastify/cors` and `@fastify/sensible`,
      decorate app with `EngineRegistry`, register `apiPlugin` with prefix `/api`,
      listen on port 3001.
    - Create `apps/server/src/api/index.ts` — stub Fastify plugin that will register
      sub-plugins.
    - Create `apps/server/src/api/kb.ts` — stub Fastify plugin with placeholder
      route registrations for KB CRUD.
    - Create `apps/server/src/api/git.ts` — stub plugin for git operation routes.
    - Create `apps/server/src/api/agent.ts` — stub plugin for agent chat + SSE routes.
    - Create `apps/server/src/db/schema.sql` — stub Postgres schema DDL (empty for
      now, populated in Phase 4).
    - Create `apps/server/src/db/client.ts` — stub postgres client factory.
    - _Requirements: 2.8, 13.1_

- [x] 11. Checkpoint — full workspace typechecks and server tests pass
  - Run `pnpm turbo run typecheck` across all packages.
  - Run `pnpm --filter @kb/server test` and confirm Property 6 and 7 tests pass.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Create Dockerfiles for server and web
  - [x] 12.1 Create `apps/server/Dockerfile`
    - Implement the three-stage Dockerfile from the design exactly:
      - Stage `deps`: `node:22-alpine`, copies workspace manifests + package.json files
        for `packages/shared`, `packages/config`, `packages/core`, `packages/client`,
        `apps/server`; runs `corepack enable pnpm && pnpm install --frozen-lockfile`.
      - Stage `builder`: copies `packages/` and `apps/server/` source; runs
        `pnpm --filter @kb/shared build`, `@kb/core build`, `@kb/client build`,
        `@kb/server build` in order.
      - Stage `runner`: `node:22-alpine`, copies only `dist` directories and
        `package.json`; runs `apk add --no-cache git` (required for
        `child_process.spawn("git", ...)`); exposes port 3001; CMD runs
        `node apps/server/dist/index.js`.
    - _Requirements: 9.2_

  - [x] 12.2 Create `apps/web/Dockerfile`
    - Implement the three-stage Dockerfile from the design exactly:
      - Stage `deps`: `node:22-alpine`, copies workspace manifests + package.json files
        for `packages/shared`, `packages/config`, `packages/client`, `packages/ui`,
        `apps/web`; runs `corepack enable pnpm && pnpm install --frozen-lockfile`.
      - Stage `builder`: sets `NEXT_TELEMETRY_DISABLED=1`; builds
        `@kb/shared`, `@kb/client`, `@kb/ui`, then `@kb/web` in order.
      - Stage `runner`: `node:22-alpine`, creates `nodejs`/`nextjs` system user;
        copies `public`, `.next/standalone`, `.next/static` with correct ownership;
        exposes port 3000; CMD runs `node apps/web/server.js`.
    - _Requirements: 9.2_

  - [x] 12.3 Create `docker-compose.yml` at the repository root
    - Define `postgres` service (image `postgres:16-alpine`, env vars
      `POSTGRES_USER/PASSWORD/DB=kb`, port 5432, named volume `postgres_data`).
    - Define `server` service: build from `apps/server/Dockerfile`, env
      `DATABASE_URL`, `NODE_ENV=development`, port 3001, depends on `postgres`,
      `develop.watch` rebuild triggers for `apps/server/`, `packages/core/`,
      `packages/shared/`.
    - Define `web` service: build from `apps/web/Dockerfile`, env `AUTH_URL`,
      `API_URL`, `NODE_ENV=development`, port 3000, depends on `server`,
      `develop.watch` rebuild triggers for `apps/web/`, `packages/ui/`,
      `packages/client/`.
    - _Requirements: 1.4_

- [x] 13. Create GitHub Actions workflows
  - [x] 13.1 Create `.github/workflows/ci.yml` — PR checks
    - Trigger: `pull_request` targeting `main`.
    - Single job with steps: checkout (fetch-depth 2), read Node version from `.nvmrc`
      (fail with explicit error if absent, Requirement 7.4), `setup-node@v4`,
      `pnpm/action-setup@v4`, restore pnpm cache, `pnpm install --frozen-lockfile`,
      run `pnpm turbo run lint typecheck test --cache-dir=.turbo`.
    - Set `TURBO_TOKEN` and `TURBO_TEAM` env vars from secrets (fall back gracefully
      if absent, Requirement 7.3).
    - Do NOT use `continue-on-error` — any turbo failure must fail the job immediately
      (Requirement 7.2).
    - _Requirements: 7.1–7.5_

  - [x] 13.2 Create `.github/workflows/desktop-release.yml` — Desktop release
    - Trigger: `push` events matching tags `v*` (Requirement 8.2).
    - Matrix: `[macos-latest, windows-latest]` with `fail-fast: true` (Requirement 8.9).
    - Steps: checkout, read Node version, setup Node + pnpm, install deps, build
      workspace packages for `@kb/desktop^...` via turbo.
    - macOS conditional steps: import `APPLE_CERT_BASE64` into keychain, run
      `pnpm build` in `apps/desktop` with `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`,
      `APPLE_TEAM_ID`, `GH_TOKEN` env vars (Requirement 8.5).
    - Windows conditional steps: decode `WINDOWS_CERT_BASE64` to file, run
      `pnpm build` with `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`, `GH_TOKEN`
      (Requirement 8.6).
    - electron-builder's `publish: github` + `GH_TOKEN` handles artifact upload to the
      GitHub Release for the triggering tag (Requirements 8.7, 8.8).
    - _Requirements: 8.1–8.9_

  - [x] 13.3 Create `.github/workflows/deploy.yml` — Server and web deploy
    - Trigger: `push` to `main` (Requirement 9.1).
    - Single job with sequential steps (no parallelism — server must succeed before web,
      Requirement 9.4): checkout, `docker/login-action@v3` with registry secrets (fail
      immediately on auth error, Requirement 9.3), `docker/setup-buildx-action@v3`,
      extract git SHA tag, `docker/build-push-action@v6` for `apps/server/Dockerfile`
      tagging `{SHA}` and `latest`, then same for `apps/web/Dockerfile`.
    - Do NOT use `continue-on-error` — push failure must fail the job (Requirement 9.6).
    - _Requirements: 9.1–9.6_

- [x] 14. Final checkpoint — full workspace integration
  - Run `pnpm install` from the repository root; confirm all `@kb/*` packages resolve
    without a publish step (Requirement 1.5).
  - Run `pnpm turbo run typecheck` — must exit 0 across all packages and apps.
  - Run `pnpm turbo run lint` — must exit 0; confirms all seven ESLint boundary rules
    are syntactically valid and no existing source file violates them.
  - Run `pnpm turbo run test` — all property-based tests and unit tests must pass.
  - Validate `docker-compose.yml` syntax with `docker compose config --quiet`.
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster skeleton; the
  property tests are highly recommended given these are security-critical subsystems.
- Each task references specific requirements and design section for full traceability.
- The build order (config → shared → core → client → ui → apps → CI) matches the
  package dependency graph in the design exactly; do not reorder.
- `packages/config` contains no compiled TypeScript output — only JavaScript config
  files consumed directly by other tooling; its "build" step is a no-op / typecheck only.
- Stubs that throw `new Error("not implemented")` are intentional and will be replaced
  in subsequent feature specs; the goal here is a compilable, lint-passing, test-passing
  scaffold, not a working application.
- Property-based tests use `fast-check` which is already declared in `@kb/core` and
  `@kb/server` `devDependencies` — no extra install needed.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.1"] },
    { "id": 1, "tasks": ["2.2", "3.2"] },
    { "id": 2, "tasks": ["4.1"] },
    { "id": 3, "tasks": ["4.2"] },
    { "id": 4, "tasks": ["4.3", "4.4"] },
    { "id": 5, "tasks": ["4.5", "4.6"] },
    { "id": 6, "tasks": ["6.1"] },
    { "id": 7, "tasks": ["6.2"] },
    { "id": 8, "tasks": ["6.3", "6.4", "7.1"] },
    { "id": 9, "tasks": ["7.2"] },
    { "id": 10, "tasks": ["8.1", "9.1", "10.1"] },
    { "id": 11, "tasks": ["8.2", "9.2", "10.2"] },
    { "id": 12, "tasks": ["8.3", "9.3", "10.3", "10.4"] },
    { "id": 13, "tasks": ["8.4", "10.5"] },
    { "id": 14, "tasks": ["12.1", "12.2"] },
    { "id": 15, "tasks": ["12.3"] },
    { "id": 16, "tasks": ["13.1", "13.2", "13.3"] }
  ]
}
```
