# Worktree Tab Editor — Design

## Tech Stack Context

- **Runtime:** Electron 44 + electron-vite, three-process architecture (main / preload / renderer)
- **UI:** React 18 + TypeScript, all styling via inline `CSSProperties` (no CSS framework)
- **State:** Plain `useState` in `App.tsx` — single `AppState` object, `update(patch)` helper
- **IPC:** `window.arlodoc.*` → `ipcRenderer.invoke` → `ipcMain.handle`, wrapped in `KbResult<T>` envelope
- **Git:** `SpawnGitBackend` (currently: clone, status, commit, push, pull, diff — no worktree commands)
- **Packages:** `@arlo-doc/shared` (types + constants), `@arlo-doc/core` (CoreEngine, SpawnGitBackend), `@arlo-doc/client` (IPC binding)

---

## Architecture Overview

```
App.tsx
 └─ AppState
     ├─ tabs: WorktreeTab[]         ← one entry per open worktree
     ├─ activeTabId: string | null  ← null = empty state (no tabs)
     └─ tabStates: Record<id, WorktreeTabState>  ← per-tab file/git state

MainLayout
 ├─ TitleBar         ← tab bar: renders all tabs + "+" button
 ├─ FileBrowser      ← root = tabStates[activeTabId].worktreePath
 └─ Editor area      ← content = tabStates[activeTabId].fileContent
```

The fundamental shift from the current design: `folderPath`, `fileTree`, `activeFilePath`, `fileContent`, `expandedPaths`, `gitStatus`, and `fileDiff` are **no longer top-level scalars** in `AppState`. They move into a per-tab `WorktreeTabState` record, keyed by `tab.id`.

---

## Data Model

### `packages/shared/src/constants/index.ts`

```typescript
export const MAX_TABS = 25;
```

### `packages/shared/src/types/worktree.ts` (new)

```typescript
export interface WorktreeInfo {
  /** Absolute path of the worktree directory on disk. */
  path: string;
  /** Git branch name checked out in this worktree. */
  branch: string;
  /** SHA of HEAD commit. */
  head: string;
}
```

### `apps/desktop/src/renderer/src/types.ts` — extended

```typescript
import type { MAX_TABS } from '@arlo-doc/shared';

export interface WorktreeTab {
  id: string;
  /** Display name. "Untitled" until set by AI chat or user. */
  title: string;
  /** Absolute path of the worktree root on disk. */
  worktreePath: string;
  /** Git branch name checked out in this worktree. */
  branch: string;
}

export interface WorktreeTabState {
  fileTree: FileNode | null;
  activeFilePath: string | null;
  fileContent: string | null;
  fileLoading: boolean;
  expandedPaths: string[];
  gitStatus: GitStatus | null;
  fileDiff: string | null;
  fileSaving: boolean;
  fileSaveError: string | null;
  /** Content at last save — used for unsaved-changes detection. */
  savedContent: string | null;
}

export interface AppState {
  // ── Tab system ─────────────────────────────────────────────────────────
  tabs: WorktreeTab[];
  activeTabId: string | null;           // null → empty state
  tabStates: Record<string, WorktreeTabState>;

  // ── UI ─────────────────────────────────────────────────────────────────
  viewMode: ViewMode;
  modal: ModalKind;
  showChat: boolean;
  draftStatus: DraftStatus;
  draftName: string;
  lastApprovalResult: 'approved' | 'declined' | null;
}

export const EMPTY_TAB_STATE: WorktreeTabState = {
  fileTree: null,
  activeFilePath: null,
  fileContent: null,
  fileLoading: false,
  expandedPaths: [],
  gitStatus: null,
  fileDiff: null,
  fileSaving: false,
  fileSaveError: null,
  savedContent: null,
};
```

---

## Layer-by-Layer Changes

### 1. `packages/shared/src/constants/index.ts`

Add `export const MAX_TABS = 25;` — single source of truth, imported everywhere the limit is needed.

---

### 2. `packages/core/src/git/GitBackend.ts` — new worktree methods

```typescript
export interface GitBackend {
  // ... existing methods unchanged ...

  /** `git worktree add <path> -b <branch>` — creates a new worktree + branch. */
  worktreeAdd(repoDir: string, worktreePath: string, branch: string): Promise<void>;

  /** `git worktree remove --force <path>` — removes the worktree directory. */
  worktreeRemove(repoDir: string, worktreePath: string): Promise<void>;

  /** `git worktree list --porcelain` — lists all worktrees. */
  worktreeList(repoDir: string): Promise<WorktreeInfo[]>;

  /** Returns true if the worktree at `worktreePath` has uncommitted changes. */
  worktreeDirty(worktreePath: string): Promise<boolean>;
}
```

`SpawnGitBackend` implements these by spawning `git` as a child process (same pattern as existing methods):
- `worktreeAdd`: `git -C repoDir worktree add <worktreePath> -b <branch>`
- `worktreeRemove`: `git -C repoDir worktree remove --force <worktreePath>`
- `worktreeList`: `git -C repoDir worktree list --porcelain` → parse output
- `worktreeDirty`: `git -C worktreePath status --porcelain` → non-empty output = dirty

Branch name is auto-generated: `wt-<timestamp>` (e.g. `wt-1722000000`). This is a safe unique name that avoids conflicts without requiring user input.

---

### 3. `apps/desktop/src/main/index.ts` — new IPC handlers

Four new channels following the existing `KbResult` pattern:

| Channel | Arguments | Returns | Description |
|---|---|---|---|
| `arlo-doc:worktreeCreate` | `repoDir: string` | `KbResult<WorktreeInfo>` | Creates worktree + branch, returns path + branch |
| `arlo-doc:worktreeDelete` | `repoDir: string, worktreePath: string` | `KbResult<void>` | Removes the worktree |
| `arlo-doc:worktreeList` | `repoDir: string` | `KbResult<WorktreeInfo[]>` | Lists all worktrees |
| `arlo-doc:worktreeDirty` | `worktreePath: string` | `KbResult<boolean>` | Checks for uncommitted changes |

Worktree files are placed at: `<repoDir>/.git/arlo-worktrees/<branch>/` — a predictable, contained location inside the repo's own `.git` directory so they don't pollute the user's filesystem.

A new `getRepoDir()` helper resolves the main repo root from any `kbRoot` path via `git -C <path> rev-parse --show-toplevel`.

---

### 4. `packages/client/src/types.ts` — extend `ClientInterface`

```typescript
worktreeCreate(repoDir: string): Promise<KbResult<WorktreeInfo>>;
worktreeDelete(repoDir: string, worktreePath: string): Promise<KbResult<void>>;
worktreeList(repoDir: string): Promise<KbResult<WorktreeInfo[]>>;
worktreeDirty(worktreePath: string): Promise<KbResult<boolean>>;
```

---

### 5. `apps/desktop/src/renderer/src/App.tsx` — state restructure

#### INITIAL_STATE

```typescript
const INITIAL_STATE: AppState = {
  tabs: [],
  activeTabId: null,
  tabStates: {},
  viewMode: 'preview',
  modal: null,
  showChat: false,
  draftStatus: null,
  draftName: '',
  lastApprovalResult: null,
};
```

No hardcoded tabs. `onboarded` state is removed — the empty tab bar replaces the Onboarding screen entirely (REQ-1, REQ-8).

#### Derived active-tab helpers (computed inline or via `useMemo`)

```typescript
const activeTab = state.tabs.find(t => t.id === state.activeTabId) ?? null;
const activeTabState = activeTab ? state.tabStates[activeTab.id] : null;
```

These replace all the former top-level scalar accesses (`state.fileTree`, `state.activeFilePath`, etc.).

#### `handleNewTab` — create worktree + tab

```typescript
const handleNewTab = useCallback(async () => {
  if (state.tabs.length >= MAX_TABS) return;
  if (!repoDir) return;  // repoDir = resolved git root, stored in AppState

  const result = await window.arlodoc.worktreeCreate(repoDir);
  if (!result.ok) { /* show error */ return; }

  const { path: worktreePath, branch } = result.data;
  const tree = await window.arlodoc.readFolder(worktreePath);

  const id = crypto.randomUUID();
  const newTab: WorktreeTab = { id, title: 'Untitled', worktreePath, branch };
  const newTabState: WorktreeTabState = {
    ...EMPTY_TAB_STATE,
    fileTree: tree.ok ? tree.data : null,
  };

  setState(s => ({
    ...s,
    tabs: [...s.tabs, newTab],
    activeTabId: id,
    tabStates: { ...s.tabStates, [id]: newTabState },
  }));
}, [state.tabs.length, repoDir]);
```

#### `handleCloseTab` — dirty check → optional confirm → delete worktree

```typescript
const handleCloseTab = useCallback(async (tabId: string) => {
  const tab = state.tabs.find(t => t.id === tabId);
  if (!tab) return;

  const dirtyResult = await window.arlodoc.worktreeDirty(tab.worktreePath);
  const isDirty = dirtyResult.ok && dirtyResult.data;

  if (isDirty) {
    // Show confirmation dialog with worktreePath + warning text (REQ-6)
    setState(s => ({ ...s, modal: { kind: 'close-worktree', tabId, worktreePath: tab.worktreePath } }));
    return;
  }

  await doCloseTab(tabId);
}, [state.tabs, repoDir]);

const doCloseTab = useCallback(async (tabId: string) => {
  const tab = state.tabs.find(t => t.id === tabId);
  if (!tab || !repoDir) return;

  await window.arlodoc.worktreeDelete(repoDir, tab.worktreePath);

  setState(s => {
    const tabs = s.tabs.filter(t => t.id !== tabId);
    const { [tabId]: _, ...tabStates } = s.tabStates;
    // Focus: left neighbour, or right, or null (empty state)
    const closedIdx = s.tabs.findIndex(t => t.id === tabId);
    const nextTab = tabs[closedIdx - 1] ?? tabs[0] ?? null;
    return {
      ...s,
      tabs,
      tabStates,
      activeTabId: nextTab?.id ?? null,
    };
  });
}, [state.tabs, repoDir]);
```

#### `handleTabClick` — switch active tab

```typescript
const handleTabClick = useCallback((tabId: string) => {
  setState(s => ({ ...s, activeTabId: tabId, viewMode: 'preview' }));
}, []);
```

No async work — file tree is already loaded into `tabStates[tabId]`.

#### `handleOpenFolder` — replaces Onboarding

```typescript
const handleOpenFolder = useCallback(async () => {
  const chosen = await window.arlodoc.chooseFolder();
  if (!chosen.ok || chosen.data == null) return;

  const folderPath = chosen.data;
  const tree = await window.arlodoc.readFolder(folderPath);
  if (!tree.ok) return;

  // Resolve git repo root (or use folderPath directly if not a git repo)
  const repoDir = folderPath; // git root detection handled server-side
  const id = crypto.randomUUID();
  const folderName = folderPath.split('/').pop() ?? 'Untitled';
  const newTab: WorktreeTab = { id, title: folderName, worktreePath: folderPath, branch: 'main' };

  setState(s => ({
    ...s,
    repoDir: folderPath,
    tabs: [...s.tabs, newTab],
    activeTabId: id,
    tabStates: { ...s.tabStates, [id]: { ...EMPTY_TAB_STATE, fileTree: tree.data } },
  }));
}, []);
```

---

### 6. `apps/desktop/src/renderer/src/components/TitleBar.tsx` — tab close + shrink

#### Close button per tab

Each tab button gains a `×` close element:
```tsx
<button key={tab.id} onClick={() => onTabClick(tab.id)} style={{ /* existing styles */ }}>
  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
    {tab.title}
  </span>
  <span
    role="button"
    aria-label={`Close ${tab.title}`}
    onClick={e => { e.stopPropagation(); onTabClose(tab.id); }}
    style={{ flexShrink: 0, color: '#a8a8be', padding: '0 2px', borderRadius: 3 }}
  >
    ×
  </span>
</button>
```

#### Tab width — shrink to fit up to MAX_TABS

```typescript
// In TitleBar render:
const TAB_BAR_RESERVED = 120;  // traffic lights + "+" button
const availableWidth = windowWidth - TAB_BAR_RESERVED;
const tabCount = tabs.length;
const MIN_TAB_WIDTH = 40;
const MAX_TAB_WIDTH = 160;

const tabWidth = tabCount === 0
  ? MAX_TAB_WIDTH
  : Math.max(MIN_TAB_WIDTH, Math.min(MAX_TAB_WIDTH, availableWidth / tabCount));

const showTitle = tabWidth > MIN_TAB_WIDTH;  // hide text at minimum width
```

`windowWidth` is obtained via `window.innerWidth` with a `resize` event listener, or a `ResizeObserver` on the tab bar container ref.

The active tab gets `+20px` of the budget while inactive tabs split the remainder.

---

### 7. `apps/desktop/src/renderer/src/components/FileBrowser.tsx` — branch indicator

Add one new optional prop:
```typescript
interface FileBrowserProps {
  // ... existing ...
  branch?: string;   // git branch name of the active worktree
}
```

The existing folder name header becomes:
```tsx
<div style={{ padding: '10px 16px 6px', ... }}>
  {fileTree.name}
  {branch && (
    <span style={{ marginLeft: 6, fontSize: 10, color: '#8e8eaa', fontFamily: 'var(--font-mono)' }}>
      {branch}
    </span>
  )}
</div>
```

---

### 8. Empty state — `MainLayout.tsx`

When `activeTabId === null` (no tabs open), instead of rendering the full layout:

```tsx
{activeTab === null ? (
  <EmptyTabState onOpenFolder={onOpenFolder} />
) : (
  /* existing full layout */
)}
```

`EmptyTabState` renders:
- A centred "Open Folder" button (matching the design in `Arlo Sidebar Live.dc.html`)
- The `+` tab button in the title bar is still visible so the user has both paths

---

### 9. Close-Worktree Confirmation Dialog

A new `ModalKind` value: `'close-worktree'`. When active, a modal renders:

```
┌─────────────────────────────────────────────┐
│ Close worktree?                             │
│                                             │
│ Path: /path/to/worktree                     │
│                                             │
│ All unsaved edits in this worktree will be  │
│ permanently deleted.                        │
│                                             │
│         [Cancel]   [Delete worktree ⚠]      │
└─────────────────────────────────────────────┘
```

"Delete worktree" is styled in red (`#cf222e`) to signal the destructive action. Cancel returns to the normal state without closing the tab.

---

### 10. Persistence — `persistenceStore.ts`

Extend saved state to include open worktrees:

```typescript
interface PersistedState {
  lastFolderPath: string | null;
  openWorktrees: Array<{ id: string; title: string; worktreePath: string; branch: string }>;
  activeTabId: string | null;
}
```

On startup (`arlo-doc:getLastFolder` equivalent — or a new `arlo-doc:getPersistedState` channel), load the worktree list and verify each path still exists on disk (a worktree may have been manually deleted while the app was closed). Missing worktrees are silently dropped from the restored list.

---

## Component & File Touch Map

| File | Change type | Summary |
|---|---|---|
| `packages/shared/src/constants/index.ts` | Edit | Add `MAX_TABS = 25` |
| `packages/shared/src/types/worktree.ts` | New | `WorktreeInfo` type |
| `packages/shared/src/index.ts` | Edit | Export new types |
| `packages/core/src/git/GitBackend.ts` | Edit | Add 4 worktree method signatures |
| `packages/core/src/git/SpawnGitBackend.ts` | Edit | Implement 4 new methods |
| `packages/client/src/types.ts` | Edit | Add 4 worktree methods to `ClientInterface` |
| `apps/desktop/src/main/index.ts` | Edit | Add 4 new `ipcMain.handle` channels |
| `apps/desktop/src/renderer/src/types.ts` | Edit | `WorktreeTab`, `WorktreeTabState`, restructured `AppState` |
| `apps/desktop/src/renderer/src/App.tsx` | Edit | Per-tab state, new handlers, remove Onboarding flow |
| `apps/desktop/src/renderer/src/components/TitleBar.tsx` | Edit | Close button, shrink-to-fit width, `MAX_TABS` guard |
| `apps/desktop/src/renderer/src/components/FileBrowser.tsx` | Edit | `branch` prop + indicator label |
| `apps/desktop/src/renderer/src/screens/MainLayout.tsx` | Edit | Empty-state path, remove old `fileTree`/`folderPath` prop drilling |
| `apps/desktop/src/renderer/src/components/CloseWorktreeDialog.tsx` | New | Confirmation modal for dirty worktree close |
| `apps/desktop/src/renderer/src/components/EmptyTabState.tsx` | New | Empty-state UI with "Open Folder" button |
| `apps/desktop/src/main/persistenceStore.ts` | Edit | Save/restore full worktree list |

---

## Key Design Decisions

**Why not per-tab CoreEngine instances?**
`CoreEngine` in the main process is already keyed per BrowserWindow. For worktrees we need per-tab `cwd` routing, but spawning a new CoreEngine per tab adds lifecycle complexity. Instead, the worktree IPC handlers pass `worktreePath` directly to the git commands — the git backend becomes stateless with respect to worktree identity. A future multi-window model can revisit CoreEngine per-tab.

**Why `wt-<timestamp>` branch names?**
Tab names (user-visible) are decoupled from branch names (git-internal). The user never needs to know the branch name unless they inspect git. The timestamp suffix guarantees uniqueness without user input. The AI chat may later set a more meaningful branch name as part of a rename operation.

**Why store `WorktreeTabState` in `App.tsx` rather than React Context or Zustand?**
The codebase uses plain `useState` throughout. Introducing a new state library for one feature would be inconsistent. The `Record<id, WorktreeTabState>` lookup is O(1) and the shallow merge pattern already in use handles partial updates cleanly. If state complexity grows beyond this feature, a migration to Zustand can be done in a dedicated refactor.

**Why place worktrees inside `.git/arlo-worktrees/`?**
This keeps all git machinery inside the existing `.git` directory, which is already excluded from the app's file browser (`EXCLUDED_NAMES` includes `.git`). Users won't accidentally see or delete the worktree directories while browsing files.
