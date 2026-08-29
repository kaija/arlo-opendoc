# Requirements Document

## Introduction

This feature adds git-aware file status indicators to the FileBrowser and a conditional "What Changed" tab to the Toolbar. When a folder is open, the FileBrowser displays colored letter badges (M / A / D) beside file names to reflect their git status. When a user opens a file that has uncommitted changes tracked by git, a "What Changed" tab becomes visible in the Toolbar; clicking it renders the unified diff for that file. Files without a git diff never show the tab.

The feature extends the existing `arlo-doc:gitStatus` IPC handler with a new `arlo-doc:gitDiff` handler and adds `gitDiff` end-to-end from `GitBackend` through `SpawnGitBackend`, `CoreEngine`, `ClientInterface`, the IPC binding in `ipc.ts`, and the preload bridge. On the renderer side, two new fields — `gitStatus` and `fileDiff` — are added to `AppState`, and git status is fetched on every file open.

## Glossary

- **FileBrowser**: The resizable left-panel component (`FileBrowser.tsx`) that renders the folder tree using `TreeRow` sub-components.
- **Toolbar**: The top bar component (`Toolbar.tsx`) containing the breadcrumb, search bar, mode segmented control, Publish button, and Chat toggle.
- **GitStatusBadge**: A small colored inline element rendered inside `TreeRow` showing the single-letter status code (M, A, D) for a modified, added, or deleted file.
- **GitStatusMap**: A `Map<string, string>` passed to `FileBrowser` that maps absolute file paths to their single-letter git status codes derived from `GitStatus.files`.
- **WhatChanged tab**: The `diff` mode button in the Toolbar's segmented control, visible only when `AppState.fileDiff` is a non-null, non-empty string.
- **gitStatus**: The existing IPC operation `arlo-doc:gitStatus` that invokes `SpawnGitBackend.status()` and returns `GitStatus`.
- **gitDiff**: A new IPC operation `arlo-doc:gitDiff` that accepts a file path and returns the unified diff string produced by `git diff HEAD -- <path>`.
- **AppState**: The top-level React state object in `App.tsx` defined in `types.ts`.
- **CoreEngine**: The per-window business-logic class in `packages/core/src/CoreEngine.ts` that delegates to `GitBackend`.
- **GitBackend**: The interface in `packages/core/src/git/GitBackend.ts` implemented by `SpawnGitBackend`.
- **SpawnGitBackend**: The concrete `GitBackend` implementation that spawns `git` subprocesses.
- **ClientInterface**: The typed contract in `packages/client/src/types.ts` that the preload bridge satisfies.

## Requirements

### Requirement 1 — gitDiff back-end method

**User Story:** As a developer, I want the back end to produce a unified diff for a single file, so that the renderer can display what changed without reimplementing git logic.

#### Acceptance Criteria

1. THE `GitBackend` interface SHALL declare a method `diff(repoDir: string, filePath: string): Promise<string>` that returns the unified diff output for `filePath` relative to `HEAD`.
2. THE `SpawnGitBackend` SHALL implement `diff` by running `git diff HEAD -- <filePath>` in `repoDir` and resolving with the raw stdout string.
3. WHEN `git diff HEAD` produces no output for the given file (the file is untracked or identical to `HEAD`), THE `SpawnGitBackend` SHALL resolve with an empty string rather than rejecting.
4. IF the `git diff` subprocess exits with a non-zero code, THEN THE `SpawnGitBackend` SHALL reject with an `Error` whose message contains the git stderr output.

### Requirement 2 — gitDiff IPC end-to-end

**User Story:** As a renderer, I want a typed `gitDiff` method on `window.arlodoc`, so that I can fetch a file's diff through the same IPC contract as all other git operations.

#### Acceptance Criteria

1. THE `CoreEngine` SHALL expose a method `gitDiff(filePath: string): Promise<string>` that delegates to `GitBackend.diff(repoDir, filePath)`.
2. THE `ClientInterface` in `packages/client/src/types.ts` SHALL declare `gitDiff(filePath: string): Promise<KbResult<string>>`.
3. THE IPC binding in `packages/client/src/ipc.ts` SHALL map `gitDiff` to the channel `arlo-doc:gitDiff` with `filePath` as the sole argument.
4. THE Electron main process in `apps/desktop/src/main/index.ts` SHALL register a handler for `arlo-doc:gitDiff` that calls `getEngine(event.sender.id).gitDiff(filePath)` and wraps errors via `wrapError`.
5. WHEN `arlo-doc:gitDiff` is invoked and the engine returns an empty string, THE handler SHALL return an empty string (not an error).

### Requirement 3 — AppState extension

**User Story:** As a renderer, I want the application state to hold the current git status and the active file's diff, so that both the FileBrowser and the Toolbar can read from a single source of truth.

#### Acceptance Criteria

1. THE `AppState` interface in `apps/desktop/src/renderer/src/types.ts` SHALL include a field `gitStatus: GitStatus | null` initialised to `null`.
2. THE `AppState` interface SHALL include a field `fileDiff: string | null` initialised to `null`.
3. WHEN `fileDiff` is an empty string, THE renderer SHALL treat it identically to `null` for the purpose of showing or hiding the WhatChanged tab.

### Requirement 4 — Git status fetch on file open

**User Story:** As a user, I want file status badges and the "What Changed" tab to reflect the actual git state of the file I just opened, so that the information is always current.

#### Acceptance Criteria

1. WHEN the user opens a file via `handleFileClick` in `App.tsx`, THE App SHALL call `window.arlodoc.gitStatus()` and, on success, update `AppState.gitStatus` with the returned `GitStatus`.
2. WHEN the user opens a file via `handleFileClick`, THE App SHALL call `window.arlodoc.gitDiff(filePath)` and, on success, update `AppState.fileDiff` with the returned diff string.
3. WHEN either `gitStatus()` or `gitDiff()` returns `ok: false`, THE App SHALL leave the corresponding `AppState` field unchanged and SHALL NOT display an error modal.
4. WHEN the user opens a file that is not tracked by git or has no diff, THE App SHALL set `AppState.fileDiff` to an empty string.
5. WHEN the user opens a different file while a previous gitDiff fetch is still in-flight, THE App SHALL discard the in-flight result and only apply the result for the most recently opened file.

### Requirement 5 — FileBrowser git status badges

**User Story:** As a user, I want to see colored M / A / D badges next to file names in the file browser, so that I can identify modified files at a glance without opening each one.

#### Acceptance Criteria

1. THE `FileBrowser` component SHALL accept a new optional prop `gitStatusMap: Map<string, string>` alongside its existing props.
2. WHEN `gitStatusMap` contains an entry for a file's absolute path, THE `TreeRow` for that file SHALL render a `GitStatusBadge` to the right of the file name displaying the single-letter code from the map.
3. THE `GitStatusBadge` for status `"M"` SHALL use the color `#d98000` (amber).
4. THE `GitStatusBadge` for status `"A"` SHALL use the color `#2da44e` (green).
5. THE `GitStatusBadge` for status `"D"` SHALL use the color `#cf222e` (red).
6. WHEN `gitStatusMap` is undefined or does not contain an entry for a file's path, THE `TreeRow` SHALL render no badge for that file.
7. THE `App` SHALL derive a `GitStatusMap` from `AppState.gitStatus.files` by mapping each file entry's absolute path (joined from `folderPath` and the relative `path` field) to its single-letter code (`"M"` for modified, `"A"` for added or untracked, `"D"` for deleted, `"M"` for renamed) and pass it to `FileBrowser`.

### Requirement 6 — Conditional WhatChanged tab

**User Story:** As a user, I want the "What Changed" tab to appear only when the open file has a git diff, so that the toolbar does not offer a mode that has no content.

#### Acceptance Criteria

1. THE `Toolbar` component SHALL accept a new prop `showDiffTab: boolean`.
2. WHEN `showDiffTab` is `false`, THE `Toolbar` SHALL omit the `diff` mode button from the segmented control entirely.
3. WHEN `showDiffTab` is `true`, THE `Toolbar` SHALL render the `diff` mode button labeled `"What changed"` in the segmented control.
4. THE `App` SHALL compute `showDiffTab` as `true` when `AppState.fileDiff` is a non-null, non-empty string, and `false` otherwise.
5. WHEN `showDiffTab` transitions from `true` to `false` (because the user opens a file with no diff), THE `App` SHALL reset `AppState.viewMode` to `"preview"` if the current `viewMode` is `"diff"`.

### Requirement 7 — WhatChanged tab content

**User Story:** As a user, I want clicking "What Changed" to show the unified diff of the current file, so that I can review exactly what has been modified since the last commit.

#### Acceptance Criteria

1. WHEN the user clicks the `"What changed"` mode button, THE `App` SHALL set `AppState.viewMode` to `"diff"`.
2. WHILE `AppState.viewMode` is `"diff"`, THE `MainLayout` SHALL render the `WhatChanged` screen or `DiffView` component with `AppState.fileDiff` as its input.
3. THE diff view SHALL render the unified diff string as preformatted text using a monospace font.
4. WHEN `AppState.fileDiff` is null or empty and `viewMode` is `"diff"`, THE diff view SHALL render a placeholder message `"No changes to display"`.
