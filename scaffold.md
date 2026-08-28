# Scaffold Design — One Core Engine, Two Hosts, One Repository

A git-backed knowledge base with agent features, shipped as an Electron desktop app
(macOS + Windows) and a hosted web companion. One TypeScript core runs embedded in the
desktop app and server-side behind an API — so the repository is a **monorepo by
construction, not by preference**.

Decided: 2026-08-27 · Package scope placeholder: `@kb/*` (rename with the product)

---

## 1. Decision record

Eleven decisions, in dependency order — each one constrains the ones after it. The
repo-topology answer falls out at №9 rather than being chosen up front.

| #  | Topic          | Decision |
|----|----------------|----------|
| 01 | Architecture   | One **shared core engine**, two hosts — embedded in Electron for local-first use, deployed server-side for the web. |
| 02 | Core language  | **TypeScript/Node** — the only runtime that runs natively in both hosts with zero FFI. Git via the `git` binary. |
| 03 | UI strategy    | **Two apps, shared component library** — Next.js web + Electron renderer, both on `packages/ui` and one client interface. |
| 04 | Agent runtime  | **Claude Agent SDK in the core** — one loop with KB tools; user-supplied API key on desktop, service-held keys on web. |
| 05 | Data model     | **Git is the source of truth** — content is markdown in a repo, edits are commits; SQLite/Postgres hold only non-reconstructible metadata (chat history, settings). |
| 06 | Git remote     | **User-owned GitHub repo** behind a forge adapter — the service is always a git client, never a git host. |
| 07 | Web V1 scope   | **Companion, parity-shaped** — browse, search, agent chat, light edits; promoting to parity later is UI work, not rearchitecting. |
| 08 | Web backend    | **Long-lived Fastify service + Next.js UI** — streaming agent sessions and git subprocesses never fight a serverless model. |
| 09 | Repo topology  | **Single monorepo** — four shared packages consumed by three apps makes separate repos a publish-bump-update treadmill. |
| 10 | Toolchain      | **pnpm workspaces + Turborepo**; desktop built with **electron-vite + electron-builder**, auto-update via GitHub Releases. |
| 11 | Web auth       | **GitHub OAuth only** (Auth.js) — identity and repo access from one connection; accounts in Postgres. |

Assumed defaults (not separately decided): Vitest for unit tests, Playwright for e2e,
GitHub Actions CI, Docker Compose for local server+Postgres dev, ESLint + Prettier,
TypeScript strict mode.

---

## 2. Repository layout

Everything under `packages/` is host-agnostic; everything host-specific lives in exactly
one app.

```
kb/
├─ pnpm-workspace.yaml           # apps/*, packages/*
├─ turbo.json                    # task graph: build · dev · lint · test · typecheck
├─ tsconfig.base.json            # strict mode; shared compiler options
├─ docker-compose.yml            # local dev: Postgres (+ server + web images)
├─ .github/workflows/
│  ├─ ci.yml                     # PRs: lint, typecheck, unit tests — turbo-cached
│  ├─ desktop-release.yml        # tag v*: mac+win matrix, sign, notarize, GitHub Release
│  └─ deploy.yml                 # main: build & push server/web container images
├─ apps/
│  ├─ desktop/                   # Electron host — electron-vite + electron-builder
│  │  └─ src/
│  │     ├─ main/                # window lifecycle; constructs the core engine; IPC handlers
│  │     ├─ preload/             # contextBridge — exposes only the typed client, nothing else
│  │     └─ renderer/            # React SPA · @kb/ui + @kb/client (IPC binding)
│  ├─ web/                       # Next.js companion — Auth.js GitHub OAuth
│  │  └─ src/                    # App Router · @kb/ui + @kb/client (HTTP binding)
│  └─ server/                    # Fastify API service — Dockerized, long-lived
│     └─ src/
│        ├─ api/                 # REST + SSE routes; one engine instance per authenticated user
│        ├─ repos/               # server-side clone lifecycle: workdir pool, locks, sync
│        └─ db/                  # Postgres: accounts, sessions, web chat history
└─ packages/
   ├─ core/                      # THE shared engine — host-agnostic, zero Electron/Next imports
   │  └─ src/
   │     ├─ kb/                  # document model, markdown parsing, links, search
   │     ├─ git/                 # GitBackend: clone/commit/push/pull via the git binary
   │     ├─ agent/               # Claude Agent SDK loop + KB tools; writes path-checked in one place
   │     ├─ forge/               # ForgeAdapter — GitHub impl: OAuth device flow, repo create
   │     └─ store/               # StoreAdapter — SQLite (desktop) / Postgres (server)
   ├─ client/                    # the transport seam: one interface, two bindings
   │  └─ src/
   │     ├─ types.ts             # THE contract — every UI data access goes through this
   │     ├─ ipc.ts               # desktop binding (Electron IPC)
   │     └─ http.ts              # web binding (fetch + SSE)
   ├─ ui/                        # shared React components + design tokens
   ├─ shared/                    # zod schemas, domain types, constants
   └─ config/                    # eslint / prettier / tsconfig presets
```

---

## 3. Package boundaries — who may import whom

Imports only ever point downward. Enforce with ESLint import rules from day one —
boundaries that aren't enforced erode within weeks.

```
apps:        desktop            web               server
             (embeds core,      (HTTP binding,    (embeds core
              IPC binding)       no core)          per user)
                  │                │                  │
                  ▼   imports flow downward only      ▼
interface:   client (contract + bindings)    ui (components, client types only)
                  │                                   │
                  ▼                                   ▼
foundation:  core (the engine, imports shared only)   shared (imports nothing)
```

Rules:

- **Packages never import apps.** The dependency graph has one direction.
- **`core` imports only `shared`.** Anything host-specific (store, agent key, workdir
  paths) enters through constructor-injected adapters — that's what lets one engine run
  in Electron main and in Fastify unchanged.
- **UIs code against `client/types.ts`.** Only the two app entry points ever choose a
  binding (IPC or HTTP). No React component knows which transport it's on.
- **Only `apps/desktop` imports `electron`; only `apps/web` imports `next`.** The
  renderer never touches Node APIs — everything crosses the preload bridge as the typed
  client.
- **Agent file writes are path-checked in one function** inside `core/agent` —
  canonicalize the target, then require containment in the KB root. Highest test budget
  in the codebase.

---

## 4. Key seams

Each seam exists because a decision above named a future it must not foreclose.

| Seam            | Lives in          | Bindings today        | What it protects |
|-----------------|-------------------|-----------------------|------------------|
| ClientInterface | `client/types.ts` | Electron IPC · HTTP+SSE | **Web parity later** — promoting the companion is UI work, never a rewrite. |
| StoreAdapter    | `core/store`      | SQLite · Postgres     | Metadata only — **content stays in git**, so the store can never grow into a second source of truth. |
| ForgeAdapter    | `core/forge`      | GitHub                | **Other forges or a hosted remote** in V2 without touching callers. |
| AgentKeyProvider| `core/agent`      | user key · service key | One agent loop; **credentials differ by host**, nothing else does. |
| GitBackend      | `core/git`        | `git` binary          | SSH agent, credential helpers, `~/.ssh/config` — **inherited for free**, swappable if a library ever earns it. |

---

## 5. Runtime topology — two hosts, one meeting point

**Desktop (local-first)**

```
renderer → preload bridge → core engine (Electron main)
                              → local clone  ⇄  GitHub remote
                              · SQLite for chat history & settings
```

**Web (companion)**

```
browser → Next.js → Fastify → per-user core engine
                              → server clone  ⇄  GitHub remote
                              · Postgres for accounts & sessions
```

**Sync is git.** Both hosts push and pull the same user-owned remote — there is no
bespoke sync protocol to design, version, or debug. Backup and sync are the same
mechanism.

---

## 6. Build order

1. **Foundations** — workspace, `tsconfig`/lint presets, `shared` schemas, CI skeleton.
   Half a day; everything else hangs off it.
2. **Core engine** *(highest test budget)* — document model, GitBackend against a local
   repo, agent loop with path-contained write tools. Test the containment check and git
   operations hardest — everything above them assumes they hold.
3. **Client contract + desktop MVP** — freeze `client/types.ts` v0, wire the IPC
   binding, ship browse / edit / commit / push / agent chat in Electron.
4. **Server + web companion** — GitHub OAuth, per-user clone lifecycle in
   `server/repos`, HTTP+SSE binding, companion UI (browse, search, agent chat).
5. **Release pipeline** — signed + notarized installers on tag, auto-update feed from
   GitHub Releases, container deploys for server and web.

---

## 7. Why one repo

Four shared packages (`core`, `client`, `ui`, `shared`) consumed by three apps is the
textbook monorepo case. In separate repos, every core change becomes publish →
version-bump → update × 3 — pure ceremony while the contract is young and changing
daily. In one repo the same change is one atomic commit, one CI run, one review.

The boundary that actually matters — *what deploys where* — is drawn by CI jobs and
Dockerfiles, not by repository walls. Split later only if a genuinely independent team
or release cadence appears; splitting is easy, merging repos back is not.
