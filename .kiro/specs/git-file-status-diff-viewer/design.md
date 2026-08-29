# Design Document — git-file-status-diff-viewer

## Overview

This feature extends the desktop application with live git awareness: a `GitStatusBadge` per file in `FileBrowser`, and a conditional "What Changed" tab in `Toolbar` that renders the unified diff for the currently-open file. The change is end-to-end: from a new `diff()` method on `GitBackend` / `SpawnGitBackend`, through `CoreEngine`, the IPC channel `arlo-doc:gitDiff`, the preload bridge, and into React state (`AppState.gitStatus`, `AppState.fileDiff`).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ Renderer Process                                                      │
│                                                                       │
│  App.tsx                                                              │
│  ├── handleFileClick()                                                │
│  │    ├── window.arlodoc.gitStatus()  → AppState.gitStatus           │
│  │    └── window.arlodoc.gitDiff(path) → AppState.fileDiff           │
│  │                                                                    │
│  ├── derived: gitStatusMap  ← AppState.gitStatus.files               │
│  ├── derived: showDiffTab   ← AppState.fileDiff non-null/non-empty   │
│  │                                                                    │
│  └── MainLayout.tsx                                                   │
│       ├── FileBrowser  ← gitStatusMap prop                           │
│       │    └── TreeRow → GitStatusBadge (M/A/D)                      │
│       ├── Toolbar      ← showDiffTab prop                            │
│       │    └── segmented control conditionally includes "diff" btn   │
│       └── DiffViewer   ← AppState.fileDiff (when viewMode="diff")   │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ Preload (contextBridge)                                               │
│  createIpcBinding → window.arlodoc.gitDiff(filePath)                 │
│  channel: "arlo-doc:gitDiff"                                         │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ Main Process                                                          │
│  ipcMain.handle("arlo-doc:gitDiff", …)                               │
│  └── getEngine(windowId).gitDiff(filePath)                           │
│                                                                       │
├─────────────────────────────────────────────────────────────────────┤
│ Core Package                                                          │
│  CoreEngine.gitDiff(filePath)                                        │
│  └── GitBackend.diff(kbRoot, filePath)                               │
│       └── SpawnGitBackend: git diff HEAD -- <filePath>               │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. `GitBackend` interface (packages/core/src/git/GitBackend.ts)

Add one method:

```typescript
diff(repoDir: string, filePath: string): Promise<string>;
```

Returns the raw unified diff string. Resolves to `""` when the file has no diff against `HEAD` (untracked or clean).

---

### 2. `SpawnGitBackend` (packages/core/src/git/SpawnGitBackend.ts)

```typescript
async diff(repoDir: string, filePath: string): Promise<string> {
  try {
    return await runGit(["diff", "HEAD", "--", filePath], repoDir);
  } catch (err) {
    // runGit rejects on non-zero exit; re-throw with original message
    throw err;
  }
}
```

`runGit` already handles:
- Non-zero exit → rejects with `new Error(stderr)` (satisfies Requirement 1.4)
- Zero exit with empty stdout → resolves with `""` (satisfies Requirement 1.3)

No special empty-string handling is required beyond what `runGit` already does.

---

### 3. `CoreEngine` (packages/core/src/CoreEngine.ts)

```typescript
async gitDiff(filePath: string): Promise<string> {
  return this.config.git.diff(this.config.kbRoot, filePath);
}
```

Delegates directly to the injected `GitBackend`. `kbRoot` already serves as `repoDir` for all other git operations.

---

### 4. `ClientInterface` (packages/client/src/types.ts)

Add to the interface:

```typescript
gitDiff(filePath: string): Promise<KbResult<string>>;
```

---

### 5. IPC binding (packages/client/src/ipc.ts)

Add to `createIpcBinding`:

```typescript
gitDiff: (filePath: string) =>
  invoke<string>("arlo-doc:gitDiff", filePath),
```

---

### 6. IPC handler (apps/desktop/src/main/index.ts)

```typescript
ipcMain.handle("arlo-doc:gitDiff", async (event, filePath: string) => {
  try {
    return await getEngine(event.sender.id).gitDiff(filePath);
  } catch (err) {
    wrapError(err);
  }
});
```

An empty-string return from `gitDiff` is a success value and passes through without `wrapError`.

---

### 7. `AppState` (apps/desktop/src/renderer/src/types.ts)

```typescript
export interface AppState {
  // … existing fields …

  /** Current git status for the open folder, or null if not fetched yet. */
  gitStatus: GitStatus | null;
  /** Unified diff string for the active file; null = not fetched, "" = no diff. */
  fileDiff: string | null;
}
```

`INITIAL_STATE` in `App.tsx` initialises both to `null`.

---

### 8. `App.tsx` — `handleFileClick` (apps/desktop/src/renderer/src/App.tsx)

Race-condition guard using a ref to track the most recently requested file path:

```typescript
const latestFileRef = useRef<string | null>(null);

const handleFileClick = useCallback(async (filePath: string) => {
  const lower = filePath.toLowerCase();
  const supported =
    lower.endsWith('.md') || lower.endsWith('.mdx') || lower.endsWith('.txt');
  if (!supported) return;

  latestFileRef.current = filePath;
  update({ fileLoading: true, activeFilePath: filePath });

  // Parallel fetches: file content + git status + git diff
  const [contentResult, statusResult, diffResult] = await Promise.all([
    window.arlodoc.readFile(filePath),
    window.arlodoc.gitStatus(),
    window.arlodoc.gitDiff(filePath),
  ]);

  // Discard stale results if user opened a different file
  if (latestFileRef.current !== filePath) return;

  if (!contentResult.ok) {
    update({ fileLoading: false, activeFilePath: null, fileContent: null });
    return;
  }
  update({
    fileLoading: false,
    fileContent: contentResult.data,
    ...(statusResult.ok ? { gitStatus: statusResult.data } : {}),
    ...(diffResult.ok   ? { fileDiff:   diffResult.data  } : {}),
  });
}, [update]);
```

`Promise.all` fires all three IPC calls concurrently, keeping latency at the max of the three rather than their sum.

---

### 9. `gitStatusMap` derivation (App.tsx)

Derived synchronously inside the render path:

```typescript
import { useMemo } from 'react';
import path from 'path-browserify'; // already in renderer bundle

const gitStatusMap = useMemo((): Map<string, string> => {
  if (!state.gitStatus || !state.folderPath) return new Map();
  const map = new Map<string, string>();
  for (const file of state.gitStatus.files) {
    const abs = path.join(state.folderPath, file.path);
    let letter: string;
    switch (file.status) {
      case 'added':
      case 'untracked':
        letter = 'A'; break;
      case 'deleted':
        letter = 'D'; break;
      case 'renamed':
      case 'modified':
      default:
        letter = 'M'; break;
    }
    map.set(abs, letter);
  }
  return map;
}, [state.gitStatus, state.folderPath]);
```

---

### 10. `showDiffTab` and viewMode guard (App.tsx)

```typescript
const showDiffTab = Boolean(state.fileDiff); // null → false, "" → false, string → true

// Reset viewMode when the diff tab disappears
useEffect(() => {
  if (!showDiffTab && state.viewMode === 'diff') {
    update({ viewMode: 'preview' });
  }
}, [showDiffTab]);
```

---

### 11. `GitStatusBadge` inline component (FileBrowser.tsx)

Rendered inline inside `TreeRow`, to the right of the file name:

```tsx
interface GitStatusBadgeProps {
  status: string; // "M" | "A" | "D"
}

const STATUS_COLORS: Record<string, string> = {
  M: '#d98000',
  A: '#2da44e',
  D: '#cf222e',
};

function GitStatusBadge({ status }: GitStatusBadgeProps): React.ReactElement {
  const color = STATUS_COLORS[status] ?? '#8e8eaa';
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        color,
        lineHeight: 1,
        flexShrink: 0,
        letterSpacing: 0,
      }}
      aria-label={`git status: ${status}`}
    >
      {status}
    </span>
  );
}
```

`TreeRow` receives the optional `gitStatus?: string` prop and renders `<GitStatusBadge>` when present:

```tsx
{gitStatus && <GitStatusBadge status={gitStatus} />}
```

The badge sits between the file name `<span>` and the right edge of the row, using the row's `gap: 4` spacing.

---

### 12. `FileBrowser` prop extension

```tsx
interface FileBrowserProps {
  // … existing props …
  gitStatusMap?: Map<string, string>;
}
```

Pass `gitStatusMap?.get(node.path)` as the `gitStatus` prop of each `TreeRow`.

---

### 13. `Toolbar` — conditional diff tab

The `MODES` array is replaced with a computed value:

```tsx
const modes = useMemo(
  () =>
    showDiffTab
      ? [
          { id: 'preview' as const, label: 'Preview' },
          { id: 'edit'    as const, label: 'Edit'    },
          { id: 'diff'    as const, label: 'What changed' },
        ]
      : [
          { id: 'preview' as const, label: 'Preview' },
          { id: 'edit'    as const, label: 'Edit'    },
        ],
  [showDiffTab],
);
```

`Toolbar` accepts `showDiffTab: boolean` and uses the computed `modes` array to render the segmented control.

---

### 14. `UnifiedDiffView` component (new: apps/desktop/src/renderer/src/components/UnifiedDiffView.tsx)

Replaces the hardcoded `DiffView` when `viewMode === 'diff'`:

```tsx
interface UnifiedDiffViewProps {
  diff: string | null;
}

export function UnifiedDiffView({ diff }: UnifiedDiffViewProps): React.ReactElement {
  if (!diff) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 13, color: '#8e8eaa', fontFamily: 'var(--font-sans)' }}>
          No changes to display
        </span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
      <pre
        style={{
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: 1.6,
          whiteSpace: 'pre',
          color: '#1a1a2e',
        }}
      >
        {diff}
      </pre>
    </div>
  );
}
```

`MainLayout` replaces `{state.viewMode === 'diff' && <DiffView />}` with `{state.viewMode === 'diff' && <UnifiedDiffView diff={state.fileDiff} />}`.

---

## Data Models

### `GitStatusMap`

```
Map<string, "M" | "A" | "D">
```

- Keys are **absolute** file paths (joined from `folderPath` + relative `file.path`).
- Values are single-letter codes derived as follows:

| `GitStatusFile.status` | Letter |
|------------------------|--------|
| `"modified"`           | `"M"`  |
| `"renamed"`            | `"M"`  |
| `"added"`              | `"A"`  |
| `"untracked"`          | `"A"`  |
| `"deleted"`            | `"D"`  |

### `AppState` additions

| Field        | Type               | Initial | Meaning                                        |
|--------------|--------------------|---------|------------------------------------------------|
| `gitStatus`  | `GitStatus \| null` | `null`  | Latest git status for the open folder          |
| `fileDiff`   | `string \| null`   | `null`  | Unified diff for the active file (`""` = clean)|

---

## Error Handling

| Failure point                   | Behaviour                                                                                  |
|---------------------------------|--------------------------------------------------------------------------------------------|
| `gitStatus()` returns `ok:false` | Leave `AppState.gitStatus` unchanged; no modal. Badges may be stale but never wrong.      |
| `gitDiff()` returns `ok:false`  | Leave `AppState.fileDiff` unchanged; no modal. Tab stays hidden on first open.            |
| `git diff HEAD` non-zero exit   | `SpawnGitBackend.diff` rejects; `wrapError` converts to `KbError`; `ok:false` returned.  |
| No upstream / not a git repo    | `git diff HEAD` exits 0 with empty stdout → `fileDiff = ""`; tab stays hidden.            |
| Race condition (fast switching) | `latestFileRef` guard discards stale results; only the last-opened file updates state.    |
| `fileDiff` becomes null/empty   | `useEffect` resets `viewMode` to `"preview"` if it was `"diff"`.                          |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: SpawnGitBackend.diff delegates command arguments correctly

*For any* `repoDir` and `filePath`, calling `SpawnGitBackend.diff(repoDir, filePath)` must invoke the git subprocess with arguments `["diff", "HEAD", "--", filePath]` in `repoDir`, and must resolve with the raw stdout string that the subprocess produces.

**Validates: Requirements 1.2**

---

### Property 2: CoreEngine.gitDiff delegates to GitBackend with kbRoot

*For any* `filePath` string, `CoreEngine.gitDiff(filePath)` must return exactly the same value that `GitBackend.diff(kbRoot, filePath)` returns, where `kbRoot` is the configured root directory.

**Validates: Requirements 2.1**

---

### Property 3: IPC binding routes gitDiff to the correct channel

*For any* `filePath` string, invoking `ipcBinding.gitDiff(filePath)` must call `ipcRenderer.invoke` with channel `"arlo-doc:gitDiff"` and `filePath` as the sole additional argument.

**Validates: Requirements 2.3**

---

### Property 4: showDiffTab is true if and only if fileDiff is non-null and non-empty

*For any* `fileDiff` value: if it is `null` or `""`, `showDiffTab` must be `false`; if it is any other non-empty string, `showDiffTab` must be `true`.

**Validates: Requirements 3.3, 6.4**

---

### Property 5: handleFileClick updates both gitStatus and fileDiff for the opened file

*For any* supported `filePath`, after `handleFileClick(filePath)` completes (with a mocked `window.arlodoc`), `AppState.gitStatus` must equal the value returned by `gitStatus()` and `AppState.fileDiff` must equal the value returned by `gitDiff(filePath)`.

**Validates: Requirements 4.1, 4.2**

---

### Property 6: Race condition guard — only the last-opened file's diff is applied

*For any* two successive file paths `A` then `B` where `B` is opened while `A`'s fetch is still pending, after both fetches complete `AppState.fileDiff` must equal the diff for `B` and must not equal a stale diff for `A`.

**Validates: Requirements 4.5**

---

### Property 7: FileBrowser renders a GitStatusBadge for every path in gitStatusMap

*For any* `gitStatusMap` containing an entry for a given file path, the `TreeRow` rendered for that path must include a `GitStatusBadge` displaying the mapped single-letter code. Conversely, for any path absent from the map, no badge is rendered.

**Validates: Requirements 5.2, 5.6**

---

### Property 8: gitStatusMap derivation preserves all files with correct letter codes

*For any* `GitStatus` object with an arbitrary `files` array, the derived `GitStatusMap` must contain exactly one entry per file whose `status` maps to a letter code according to the table in the design, and each entry's absolute path must equal `path.join(folderPath, file.path)`.

**Validates: Requirements 5.7**

---

### Property 9: viewMode resets to "preview" when showDiffTab transitions to false

*For any* `AppState` where `viewMode === "diff"`, setting `fileDiff` to `null` or `""` must cause `viewMode` to become `"preview"`.

**Validates: Requirements 6.5**

---

### Property 10: UnifiedDiffView renders diff content with monospace preformatted styling

*For any* non-empty unified diff string, `UnifiedDiffView` must render its content inside a `<pre>` element with a monospace `fontFamily`, preserving whitespace and newlines.

**Validates: Requirements 7.3**
