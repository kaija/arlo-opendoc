# Requirements Document

## Introduction

This spec covers the initial scaffold of the `kb/` monorepo — a git-backed knowledge
base with AI agent features, delivered as an Electron desktop app (macOS + Windows) and
a hosted Next.js/Fastify web companion. One TypeScript core engine runs embedded in the
Electron main process and server-side behind Fastify; all UI code depends only on a
typed client interface that abstracts the transport layer.

The scaffold establishes every file and package that must exist before feature
development begins: the workspace configuration, directory skeleton, package boundaries,
shared toolchain presets, three CI/CD pipelines, and the five architectural seams that
keep the two hosts independently deployable.

---

## Glossary

- **Monorepo**: The single `kb/` repository containing all apps and packages managed
  with pnpm workspaces and Turborepo.
- **Core Engine**: The host-agnostic TypeScript package at `packages/core` that
  implements the KB document model, GitBackend, agent loop, ForgeAdapter, and
  StoreAdapter.
- **Desktop App**: The Electron application at `apps/desktop`, targeting macOS and
  Windows, that embeds the Core Engine in its main process.
- **Web App**: The Next.js application at `apps/web` that provides the browser UI for
  the web companion.
- **Server**: The long-lived Fastify service at `apps/server` that hosts one Core Engine
  instance per authenticated user.
- **ClientInterface**: The typed contract defined in `packages/client/src/types.ts`
  through which all UI code accesses KB functionality.
- **IPC Binding**: The Electron-IPC implementation of the ClientInterface, defined in
  `packages/client/src/ipc.ts`.
- **HTTP Binding**: The fetch+SSE implementation of the ClientInterface, defined in
  `packages/client/src/http.ts`.
- **StoreAdapter**: The interface in `packages/core/src/store` that abstracts
  SQLite (desktop) and Postgres (server) metadata storage.
- **ForgeAdapter**: The interface in `packages/core/src/forge` that abstracts GitHub
  operations; today implemented for GitHub only.
- **GitBackend**: The wrapper in `packages/core/src/git` that drives the `git` binary
  for clone, commit, push, and pull.
- **AgentKeyProvider**: The interface injected into the Core Engine that supplies the
  Claude API key; implemented differently per host (user-supplied on desktop,
  service-held on server).
- **Turborepo**: The task-runner at the root that defines and caches the `build`, `dev`,
  `lint`, `test`, and `typecheck` task graph across all packages.
- **pnpm Workspaces**: The package manager configuration that links all `apps/*` and
  `packages/*` as a single dependency graph.
- **Workspace_Toolchain**: The shared ESLint, Prettier, and TypeScript compiler presets
  published from `packages/config`.
- **Path_Containment_Check**: The single function in `packages/core/src/agent` that
  canonicalizes a target path and asserts it falls within the KB root before any agent
  file write proceeds.
- **KB_Root**: The root directory of the user's knowledge-base git repository as known
  to a running Core Engine instance.

---

## Requirements

### Requirement 1: Workspace Root Configuration

**User Story:** As a developer, I want a correctly configured monorepo root so that
pnpm, Turborepo, TypeScript, and Docker Compose all resolve workspaces and tasks from a
single configuration.

#### Acceptance Criteria

1. THE Monorepo SHALL contain a `pnpm-workspace.yaml` file at the repository root that
   declares `apps/*` and `packages/*` as workspace members.
2. THE Monorepo SHALL contain a `turbo.json` file at the repository root that declares
   the `build`, `dev`, `lint`, `test`, and `typecheck` tasks, each with a `dependsOn`
   array that encodes inter-package dependency edges so downstream packages always build
   after their upstream dependencies.
3. THE Monorepo SHALL contain a `tsconfig.base.json` file at the repository root with
   TypeScript strict mode enabled and a `paths` entry for every `@kb/*` package that
   maps the alias to its source entry point.
4. THE Monorepo SHALL contain a `docker-compose.yml` file at the repository root that
   defines a `postgres` service, a `server` service, and a `web` service for local
   development.
5. WHEN a developer runs `pnpm install` from the repository root, each internal
   `@kb/*` package SHALL be importable by its workspace name without a separate publish
   step.

---

### Requirement 2: Package Directory Skeleton

**User Story:** As a developer, I want all required packages scaffolded with the correct
directory layout so that imports and build tasks resolve correctly from day one.

#### Acceptance Criteria

1. THE Monorepo SHALL contain a `packages/shared` directory with a `package.json`
   declaring the name `@kb/shared`, exporting Zod schemas, domain types, and constants,
   and containing no `@kb/*` imports in its source files.
2. THE Monorepo SHALL contain a `packages/config` directory with a `package.json`
   declaring the name `@kb/config`, exporting ESLint, Prettier, and TypeScript compiler
   presets so that each other package and app can reference them in its own config files
   without defining rules inline.
3. THE Monorepo SHALL contain a `packages/core` directory with a `package.json`
   declaring the name `@kb/core`, with source subdirectories `kb/`, `git/`, `agent/`,
   `forge/`, and `store/`; source files in `packages/core` SHALL NOT import from any
   `@kb/*` package other than `@kb/shared`.
4. THE Monorepo SHALL contain a `packages/client` directory with a `package.json`
   declaring the name `@kb/client`, with source files `types.ts`, `ipc.ts`, and
   `http.ts` under `src/`.
5. THE Monorepo SHALL contain a `packages/ui` directory with a `package.json` declaring
   the name `@kb/ui`, exporting shared React components and design tokens; source files
   in `packages/ui` SHALL NOT import from `@kb/core` and SHALL only import from
   `@kb/client` via `@kb/client/src/types.ts`.
6. THE Monorepo SHALL contain an `apps/desktop` directory with a `package.json`
   declaring the name `@kb/desktop` and subdirectories `src/main/`, `src/preload/`, and
   `src/renderer/`.
7. THE Monorepo SHALL contain an `apps/web` directory with a `package.json` declaring
   the name `@kb/web`, structured as a Next.js App Router project under `src/`.
8. THE Monorepo SHALL contain an `apps/server` directory with a `package.json`
   declaring the name `@kb/server` and subdirectories `src/api/`, `src/repos/`, and
   `src/db/`.
9. THE Workspace_Toolchain SHALL configure ESLint import rules, sourced from
   `packages/config`, that produce an error when any source file violates the package
   boundaries specified in criteria 3 and 5 above, ensuring boundaries are
   mechanically testable on every lint run.

---

### Requirement 3: Package Boundary Enforcement

**User Story:** As a developer, I want import boundaries enforced by ESLint so that
architectural rules cannot be violated silently as the codebase grows.

#### Acceptance Criteria

1. THE Workspace_Toolchain SHALL configure ESLint import rules at `error` severity that
   produce an ESLint error when any file inside `packages/*` imports from any path
   inside `apps/*`.
2. THE Workspace_Toolchain SHALL configure ESLint import rules at `error` severity that
   produce an ESLint error when any file inside `packages/core` imports from any
   `@kb/*` package other than `@kb/shared`.
3. THE Workspace_Toolchain SHALL configure ESLint import rules at `error` severity that
   produce an ESLint error when any file inside `packages/ui` imports from `@kb/core`,
   `@kb/client/ipc`, or `@kb/client/http`.
4. THE Workspace_Toolchain SHALL configure ESLint import rules at `error` severity that
   produce an ESLint error when any file inside `apps/desktop/src/renderer` imports
   from the `electron` package or any Node.js built-in module (including `fs`, `path`,
   `os`, `child_process`, `crypto`, `http`, `https`, `net`, `stream`, `buffer`,
   `events`, `util`, and `url`).
5. THE Workspace_Toolchain SHALL configure ESLint import rules at `error` severity that
   produce an ESLint error when any file outside `apps/desktop` (including the
   workspace root, all `packages/*`, and all other `apps/*` directories) imports from
   the `electron` package.
6. THE Workspace_Toolchain SHALL configure ESLint import rules at `error` severity that
   produce an ESLint error when any file outside `apps/web` (including the workspace
   root, all `packages/*`, and all other `apps/*` directories) imports from the `next`
   package.
7. WHEN the `lint` task is executed via Turborepo, THE Workspace_Toolchain SHALL exit
   with a non-zero code if any boundary violation is detected.

---

### Requirement 4: ClientInterface Contract

**User Story:** As a UI developer, I want a single typed interface for all KB
operations so that renderer code is transport-agnostic and the web companion can be
promoted to parity without architectural changes.

#### Acceptance Criteria

1. THE ClientInterface SHALL define TypeScript types for every KB operation exposed to
   UI code, including: document read, document write, document delete, search,
   git clone, git commit, git push, git pull, git status, and agent chat (both
   single-turn and streaming).
2. THE IPC_Binding SHALL implement every method of the ClientInterface using Electron
   IPC calls; `packages/client/src/ipc.ts` SHALL NOT contain any import from `@kb/core`
   or any package that re-exports from `@kb/core`.
3. THE HTTP_Binding SHALL implement request/reply ClientInterface methods using `fetch`
   and SHALL implement streaming agent-chat methods using the browser `EventSource` API;
   `packages/client/src/http.ts` SHALL NOT contain any import from `@kb/core`.
4. WHEN `packages/client/src/types.ts` is changed, THE Monorepo build SHALL produce a
   TypeScript error in `ipc.ts`, `http.ts`, or any app file whose implementation no
   longer satisfies the updated interface.
5. THE Desktop_App preload script SHALL expose only the IPC_Binding to the renderer via
   `contextBridge`; no Node.js built-in, `electron` API, or `@kb/core` method SHALL be
   exposed on `window` by any other means.
6. THE ClientInterface SHALL define a typed error shape returned by all methods on
   failure, so that UI code can handle errors without inspecting raw exception messages.

---

### Requirement 5: Core Engine Seams

**User Story:** As an architect, I want each host-specific concern injected through a
well-defined adapter interface so that the Core Engine binary is identical across hosts
and swappable implementations never require changes to engine logic.

#### Acceptance Criteria

1. THE Core_Engine constructor SHALL accept a `StoreAdapter` instance as a required
   parameter.
2. THE `packages/core` package.json and source files SHALL NOT declare or import
   `better-sqlite3`, `pg`, or any other SQL driver as a direct dependency.
3. THE Core_Engine constructor SHALL accept an `AgentKeyProvider` instance as a
   required parameter.
4. THE Core_Engine source files SHALL NOT call `process.env`, `fs.readFile`, or any
   other environment or file-system API to retrieve the Claude API key.
5. THE Core_Engine constructor SHALL accept a `ForgeAdapter` instance as a required
   parameter.
6. THE `packages/core` package.json and source files SHALL NOT declare or import
   `@octokit/rest`, `@octokit/graphql`, or any other GitHub API client as a direct
   dependency.
7. THE GitBackend SHALL invoke the `git` binary by spawning an OS-level child process
   (e.g., `child_process.spawn`) and SHALL NOT import any Node.js package that requires
   native compilation for git operations.
8. THE StoreAdapter interface SHALL declare `createChatRecord`, `readChatRecord`,
   `updateChatRecord`, `deleteChatRecord`, `readSettings`, and `writeSettings` methods
   whose signatures use only domain types from `@kb/shared`, with no SQL-dialect-
   specific types, column names, or query strings in the interface definition.
9. THE ForgeAdapter interface SHALL declare methods for OAuth token exchange, repository
   creation, and webhook registration whose signatures use only domain types from
   `@kb/shared`, with no GitHub API endpoint URLs, header names, or response-body
   shapes in the interface definition.
10. WHEN any adapter method (StoreAdapter, AgentKeyProvider, or ForgeAdapter) rejects
    or throws, THE Core_Engine SHALL propagate the error to the caller without retrying
    and without entering an undefined or partially-initialized state.

---

### Requirement 6: Path Containment Check

**User Story:** As a security engineer, I want all agent-initiated file writes to pass
through a single containment check so that the agent cannot write files outside the
user's KB repository regardless of the path it is given.

#### Acceptance Criteria

1. THE Path_Containment_Check function SHALL normalize KB_Root by stripping any
   trailing path separator before performing comparisons, so that results are identical
   whether KB_Root is supplied as `/repo` or `/repo/`.
2. THE Path_Containment_Check function SHALL canonicalize the target path using
   `path.resolve` before comparison.
3. IF the canonicalized target path does not begin with the normalized KB_Root path
   followed by exactly one path separator character, THEN THE Path_Containment_Check
   SHALL throw a containment error and the write SHALL NOT proceed.
4. WHEN the canonicalized target path begins with the normalized KB_Root path followed
   by exactly one path separator character, THE Path_Containment_Check SHALL return the
   canonicalized path to the caller.
5. THE Path_Containment_Check SHALL be the only function in `packages/core/src/agent`
   that performs containment validation against KB_Root; no other agent code SHALL
   perform an equivalent containment validation against KB_Root.
6. THE Path_Containment_Check function SHALL not produce an unhandled exception for any
   string input, and no string input SHALL result in a write being permitted outside
   KB_Root.

---

### Requirement 7: CI Pipeline — PR Checks

**User Story:** As a developer, I want a CI workflow that runs on every pull request so
that lint, type, and test regressions are caught before merge.

#### Acceptance Criteria

1. THE CI Pipeline SHALL be defined in `.github/workflows/ci.yml` and SHALL trigger on
   `pull_request` events targeting the default branch.
2. THE CI Pipeline SHALL run `lint`, `typecheck`, and `test` tasks via Turborepo in a
   single job, and WHEN any of those tasks exits with a non-zero code the job SHALL
   immediately fail and SHALL NOT continue to subsequent steps.
3. THE CI Pipeline SHALL use Turborepo remote caching so that tasks whose inputs have
   not changed since the last successful run are skipped on repeated runs; IF the remote
   cache is unavailable, THE CI Pipeline SHALL continue the run without caching rather
   than failing.
4. IF the Node.js version cannot be resolved from the repository's `.nvmrc` or
   `engines` field, THE CI Pipeline SHALL fail with an explicit error message before
   running any tasks.
5. THE CI Pipeline SHALL run on an Ubuntu runner and SHALL use the Node.js version
   specified in the repository `.nvmrc` or `engines` field.

---

### Requirement 8: CI Pipeline — Desktop Release

**User Story:** As a release engineer, I want a CI workflow that builds, signs, and
notarizes macOS and Windows installers on a version tag push so that distributable
artifacts are published automatically.

#### Acceptance Criteria

1. THE Desktop_Release Pipeline SHALL be defined in
   `.github/workflows/desktop-release.yml`.
2. THE Desktop_Release Pipeline SHALL trigger on `push` events matching tags of the
   pattern `v*`.
3. THE Desktop_Release Pipeline SHALL run on a matrix of `macos-latest` and
   `windows-latest` GitHub Actions runners.
4. THE Desktop_Release Pipeline SHALL build the Desktop_App using `electron-builder`
   via the `apps/desktop` build script.
5. WHEN running on `macos-latest`, THE Desktop_Release Pipeline SHALL sign and notarize
   the produced `.dmg` artifact using the macOS code-signing certificate stored in the
   `APPLE_CERT_BASE64` GitHub Actions secret and the notarization credentials stored in
   `APPLE_ID`, `APPLE_ID_PASSWORD`, and `APPLE_TEAM_ID` secrets.
6. WHEN running on `windows-latest`, THE Desktop_Release Pipeline SHALL sign the
   produced `.exe` installer using the code-signing certificate stored in the
   `WINDOWS_CERT_BASE64` GitHub Actions secret.
7. THE Desktop_Release Pipeline SHALL upload all produced installer artifacts (`.dmg`
   and `.exe`) to the GitHub Release created for the triggering tag.
8. THE Desktop_Release Pipeline SHALL configure the auto-update feed URL in the
   `electron-builder` configuration to point to the GitHub Releases page for the
   repository.
9. WHEN any build, signing, or upload step fails, THE Desktop_Release Pipeline SHALL
   fail and SHALL NOT upload partial artifacts to the GitHub Release.

---

### Requirement 9: CI Pipeline — Server and Web Deploy

**User Story:** As a DevOps engineer, I want a CI workflow that builds and publishes
container images for the server and web apps on every push to main so that the hosted
companion is always deployed from the latest code.

#### Acceptance Criteria

1. THE Deploy_Pipeline SHALL be defined in `.github/workflows/deploy.yml` and SHALL
   trigger on `push` events to the `main` branch.
2. THE Deploy_Pipeline SHALL build a Docker image for `apps/server` and a Docker image
   for `apps/web` using `Dockerfile`s located in each respective app directory.
3. THE Deploy_Pipeline SHALL authenticate to the container registry using the
   `REGISTRY_URL`, `REGISTRY_USERNAME`, and `REGISTRY_PASSWORD` GitHub Actions secrets
   before pushing any image; IF authentication fails, THE Deploy_Pipeline SHALL fail
   immediately.
4. WHEN either Docker build step fails, THE Deploy_Pipeline SHALL fail and SHALL NOT
   push any images.
5. THE Deploy_Pipeline SHALL tag each image with both the full git SHA and the `latest`
   tag.
6. IF the push of either image fails after a successful build, THE Deploy_Pipeline SHALL
   fail and SHALL NOT mark the deployment as successful.

---

### Requirement 10: Build Order and Dependency Graph

**User Story:** As a developer, I want Turborepo to enforce the correct package build
order so that dependent packages are always built before their consumers.

#### Acceptance Criteria

1. THE Turborepo task graph SHALL enforce that `packages/shared` build completes before
   the build of any other package or app begins.
2. THE Turborepo task graph SHALL enforce that `packages/config` build completes before
   the build of any package or app that references its presets.
3. THE Turborepo task graph SHALL enforce that `packages/core` build completes after
   `packages/shared` and before `apps/desktop` and `apps/server`.
4. THE Turborepo task graph SHALL enforce that `packages/client` build completes after
   `packages/shared` and before `apps/desktop`, `apps/web`, and `packages/ui`.
5. THE Turborepo task graph SHALL enforce that `packages/ui` build completes after
   `packages/client` and `packages/shared` and before `apps/desktop` and `apps/web`.
6. WHEN a file in `packages/shared` is modified, THE Turborepo task graph SHALL
   schedule a rebuild of `packages/core`, `packages/client`, `packages/ui`,
   `apps/desktop`, `apps/web`, and `apps/server` for any task that declares `build` as
   a dependency.
7. WHEN the build of any package fails, THE Turborepo task graph SHALL not start the
   build of any package or app that depends on it.

---

### Requirement 11: Desktop App Preload Bridge

**User Story:** As a security engineer, I want the Electron preload script to expose
only the typed client interface so that the renderer process has no direct access to
Node.js APIs or the Core Engine.

#### Acceptance Criteria

1. THE Desktop_App preload script SHALL call `contextBridge.exposeInMainWorld` with
   exactly one key whose value is an object that implements every method of the
   ClientInterface and exposes no additional properties.
2. THE Desktop_App preload script SHALL NOT call `contextBridge.exposeInMainWorld` more
   than once.
3. THE Desktop_App preload script SHALL NOT import any module from `@kb/core` or any
   other package that imports from `@kb/core`.
4. WHEN the renderer calls any method on the exposed client object and the IPC call
   succeeds, THE IPC_Binding SHALL resolve the returned promise with the typed response
   value.
5. WHEN the renderer calls any method on the exposed client object and the IPC call
   fails, THE IPC_Binding SHALL reject the returned promise with the typed error shape
   defined by the ClientInterface.
6. WHEN the Desktop_App main process receives an IPC message for a handler that
   delegates to the Core_Engine and the Core_Engine throws, THE main process SHALL
   send a structured error reply so that the IPC_Binding can reject the promise rather
   than leaving it pending.
7. WHEN the Desktop_App main process receives an IPC call, it SHALL delegate to the
   single Core_Engine instance for that window.

---

### Requirement 12: Web Authentication

**User Story:** As a web user, I want to sign in with my GitHub account so that my
identity and repository access are established through a single OAuth connection.

#### Acceptance Criteria

1. THE Web_App SHALL integrate Auth.js with the GitHub OAuth provider.
2. WHEN a user initiates sign-in, THE Web_App SHALL redirect the user to GitHub's OAuth
   authorization endpoint.
3. WHEN GitHub redirects back with a valid authorization code, THE Web_App SHALL
   exchange the code for an access token and create or update the user's account record
   in Postgres; IF the token exchange fails, THE Web_App SHALL redirect the user to an
   error page with an appropriate message.
4. WHILE a user's session is not authenticated, THE Web_App SHALL redirect any request
   for a protected route (any route that requires a valid session) to the sign-in page.
5. THE Server SHALL accept a valid Auth.js session token on API requests and SHALL
   process the request normally.
6. THE Server SHALL reject API requests with an invalid or expired Auth.js session token
   with an HTTP 401 response.
7. WHEN a valid session exists, THE Server SHALL use the GitHub access token stored in
   the session to instantiate the ForgeAdapter for that user's Core_Engine instance;
   IF the token is missing or invalid, THE Server SHALL return an HTTP 401 response.
8. WHEN GitHub returns an error response during the OAuth callback, THE Web_App SHALL
   redirect the user to the sign-in page with a query parameter indicating the OAuth
   failure reason.

---

### Requirement 13: Server Per-User Engine Lifecycle

**User Story:** As a backend engineer, I want the Fastify server to manage one Core
Engine instance per authenticated user so that user data is isolated and server-side
clones are controlled.

#### Acceptance Criteria

1. THE Server SHALL maintain a registry of active Core_Engine instances keyed by each
   authenticated user's unique identifier.
2. WHEN an authenticated request arrives for a user with no active Core_Engine instance,
   THE Server SHALL construct a new Core_Engine instance with StoreAdapter,
   AgentKeyProvider, and ForgeAdapter implementations scoped to that user's account,
   and register it in the instance registry before handling the request.
3. WHEN a Core_Engine instance has been idle for a configurable duration (default: 30
   minutes; valid range: 1–1440 minutes), THE Server SHALL destroy the instance and
   release the associated working directory.
4. WHEN releasing a working directory fails, THE Server SHALL log the failure with the
   user identifier and mark the directory as pending-release for a subsequent cleanup
   attempt.
5. THE Server `src/repos/` module SHALL acquire a per-repository lock before starting
   any git operation and SHALL release the lock on both successful completion and
   failure of that operation.
6. WHEN a concurrent request arrives for a user whose Core_Engine instance holds a
   repository lock, THE Server SHALL queue the request; the queue per user SHALL hold a
   maximum of 50 pending requests and each queued request SHALL wait at most 30 seconds
   for the lock.
7. WHEN the per-user queue reaches its maximum depth or a queued request exceeds its
   wait timeout, THE Server SHALL reject the request with a contention error message and
   SHALL NOT construct a duplicate Core_Engine instance.
