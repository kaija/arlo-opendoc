# Worktree Tab Editor — Tasks

## Phase 1 — Shared types & constants

- [x] **1.1** Add `MAX_TABS = 25` export to `packages/shared/src/constants/index.ts`
- [x] **1.2** Create `packages/shared/src/types/worktree.ts` with `WorktreeInfo` interface (`path`, `branch`, `head`)
- [x] **1.3** Export `WorktreeInfo` from `packages/shared/src/index.ts`

## Phase 2 — Git backend: worktree commands

- [x] **2.1** Add `worktreeAdd`, `worktreeRemove`, `worktreeList`, `worktreeDirty` method signatures to `packages/core/src/git/GitBackend.ts`
- [x] **2.2** Implement `worktreeAdd(repoDir, worktreePath, branch)` in `SpawnGitBackend` — spawns `git -C <repoDir> worktree add <worktreePath> -b <branch>`
- [x] **2.3** Implement `worktreeRemove(repoDir, worktreePath)` in `SpawnGitBackend` — spawns `git -C <repoDir> worktree remove --force <worktreePath>`
- [x] **2.4** Implement `worktreeList(repoDir)` in `SpawnGitBackend` — spawns `git -C <repoDir> worktree list --porcelain` and parses output into `WorktreeInfo[]`
- [x] **2.5** Implement `worktreeDirty(worktreePath)` in `SpawnGitBackend` — spawns `git -C <worktreePath> status --porcelain` and returns `true` if output is non-empty
- [x] **2.6** Add a `getRepoRoot(cwd: string): Promise<string>` helper to `SpawnGitBackend` — spawns `git -C <cwd> rev-parse --show-toplevel`

## Phase 3 — IPC layer

- [x] **3.1** Add `worktreeCreate`, `worktreeDelete`, `worktreeList`, `worktreeDirty` method signatures to `ClientInterface` in `packages/client/src/types.ts`
- [x] **3.2** Register the four new IPC channels in the preload binding (`packages/client/src/ipc.ts` or the `createIpcBinding` factory) following the existing `KbResult` envelope pattern
- [x] **3.3** Implement `arlo-doc:worktreeCreate` handler in `apps/desktop/src/main/index.ts`
  - Resolves repo root via `getRepoRoot`
  - Generates branch name `wt-<Date.now()>`
  - Creates worktree at `<repoRoot>/.git/arlo-worktrees/<branch>/`
  - Returns `KbResult<WorktreeInfo>`
- [x] **3.4** Implement `arlo-doc:worktreeDelete` handler — calls `SpawnGitBackend.worktreeRemove`, returns `KbResult<void>`
- [x] **3.5** Implement `arlo-doc:worktreeList` handler — calls `SpawnGitBackend.worktreeList`, returns `KbResult<WorktreeInfo[]>`
- [x] **3.6** Implement `arlo-doc:worktreeDirty` handler — calls `SpawnGitBackend.worktreeDirty`, returns `KbResult<boolean>`

## Phase 4 — Renderer types & state restructure

- [x] **4.1** Add `WorktreeTab`, `WorktreeTabState`, and `EMPTY_TAB_STATE` to `apps/desktop/src/renderer/src/types.ts`
- [x] **4.2** Restructure `AppState` in `types.ts`: replace top-level `folderPath`, `fileTree`, `activeFilePath`, `fileContent`, `fileLoading`, `expandedPaths`, `gitStatus`, `fileDiff`, `fileSaving`, `fileSaveError` with `tabs: WorktreeTab[]`, `activeTabId: string | null`, and `tabStates: Record<string, WorktreeTabState>`
- [x] **4.3** Update `INITIAL_STATE` in `App.tsx` to `tabs: [], activeTabId: null, tabStates: {}` (no hardcoded demo tabs)
- [x] **4.4** Remove `onboarded` / `choosePending` / `chooseError` / `lastFolder` local state from `App.tsx` — the empty tab bar replaces the Onboarding screen
- [x] **4.5** Add `repoDir: string | null` to `AppState` — set when the first folder is opened, used as the main git repo root for all worktree operations

## Phase 5 — App.tsx handler rewrites

- [x] **5.1** Write `handleNewTab` — guards on `MAX_TABS`, calls `window.arlodoc.worktreeCreate`, reads folder tree, appends `WorktreeTab` + `WorktreeTabState` to state
- [x] **5.2** Write `handleCloseTab(tabId)` — calls `window.arlodoc.worktreeDirty`; if dirty, sets `modal: { kind: 'close-worktree', tabId, worktreePath }`; otherwise calls `doCloseTab` directly
- [x] **5.3** Write `doCloseTab(tabId)` — calls `window.arlodoc.worktreeDelete`, removes tab + tabState, shifts focus to left neighbour (or null if last tab)
- [x] **5.4** Write `handleTabClick(tabId)` — sets `activeTabId`, resets `viewMode` to `'preview'`
- [x] **5.5** Write `handleOpenFolder` — opens OS folder picker, reads folder tree, sets `repoDir`, appends first `WorktreeTab` using folder name as title and folder path as `worktreePath`
- [x] **5.6** Update all handlers that previously read `state.fileTree`, `state.activeFilePath`, etc. to instead read from `state.tabStates[state.activeTabId]` — includes `handleFileClick`, `handleDirectoryToggle`, `handleContentChange`, `handleSave`
- [x] **5.7** Update `handleSave` to write back git diff + status into `tabStates[activeTabId]` rather than top-level scalars
- [x] **5.8** Update `gitStatusMap` `useMemo` to derive from `activeTabState.gitStatus` and `activeTab.worktreePath`

## Phase 6 — TitleBar component

- [x] **6.1** Add `onTabClose: (tabId: string) => void` prop to `TitleBar`
- [x] **6.2** Add a `×` close button inside each tab button; `onClick` must call `e.stopPropagation()` before invoking `onTabClose`
- [x] **6.3** Implement shrink-to-fit tab width calculation using `ResizeObserver` on the tab bar container:
  - `tabWidth = clamp(MIN_TAB_WIDTH=40, availableWidth / tabCount, MAX_TAB_WIDTH=160)`
  - Active tab gets an extra 20px budget
  - When `tabWidth <= MIN_TAB_WIDTH` hide the title text, show only the `×` button
- [x] **6.4** Import and enforce `MAX_TABS` from `@arlo-doc/shared` — disable the `+` button and show a tooltip when `tabs.length >= MAX_TABS`
- [x] **6.5** Pass `onTabClose` through from `App.tsx` → `MainLayout` → `TitleBar`

## Phase 7 — FileBrowser component

- [x] **7.1** Add optional `branch?: string` prop to `FileBrowserProps`
- [x] **7.2** Render branch name as a monospace label beside the folder name in the header (e.g. `folderName  wt-1722000000` in muted grey)
- [x] **7.3** Pass `activeTab.branch` from `MainLayout` into `FileBrowser`

## Phase 8 — Empty state & Close dialog

- [x] **8.1** Create `apps/desktop/src/renderer/src/components/EmptyTabState.tsx`
  - Props: `onOpenFolder: () => void`
  - Renders a centred "Open Folder" button matching the dashed-border style from the design mockup
- [x] **8.2** Create `apps/desktop/src/renderer/src/components/CloseWorktreeDialog.tsx`
  - Props: `worktreePath: string`, `onConfirm: () => void`, `onCancel: () => void`
  - Shows path, warning text ("All unsaved edits in this worktree will be permanently deleted.")
  - "Delete worktree" button styled in `#cf222e` (destructive red)
- [x] **8.3** Update `ModalKind` in `types.ts` to include `{ kind: 'close-worktree'; tabId: string; worktreePath: string }` (or a union type alongside existing string literals)
- [x] **8.4** Render `CloseWorktreeDialog` in `MainLayout` when `state.modal` is a `close-worktree` object
- [x] **8.5** Update `MainLayout` to render `EmptyTabState` when `activeTabId === null` instead of the normal layout

## Phase 9 — Persistence

- [x] **9.1** Extend `PersistedState` type in `persistenceStore.ts` to include `openWorktrees: Array<{ id, title, worktreePath, branch }>` and `activeTabId: string | null`
- [x] **9.2** Update `saveLastFolder` (or add `saveState`) to persist the full worktree list on every tab open/close
- [x] **9.3** On startup, call `arlo-doc:getLastFolder` (or a new `arlo-doc:getPersistedState`) and restore tabs, verifying each `worktreePath` still exists on disk — drop missing paths silently
- [x] **9.4** Wire restored tabs into `INITIAL_STATE` before the first render (or dispatch into state immediately after mount)

## Phase 10 — Verification

- [x] **10.1** Build (`pnpm run build`) passes with no TypeScript errors
- [x] **10.2** Manual smoke test — open app, verify empty tab bar; click `+`, verify new tab + worktree created; switch tabs, verify file browser switches roots; close tab with no changes (no dialog); close dirty tab (dialog appears, shows path + warning); confirm delete, verify tab removed and worktree deleted from disk
- [x] **10.3** Test MAX_TABS guard — open 25 tabs, verify `+` button is disabled; close one tab, verify `+` re-enables
- [x] **10.4** Test persistence — open tabs, quit app, relaunch, verify tabs restore; verify a manually deleted worktree is silently dropped on restore
