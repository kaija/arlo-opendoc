# Implementation Plan: git-file-status-diff-viewer

## Overview

Extend the desktop application with end-to-end git awareness: a `diff()` method propagated from `GitBackend` through IPC to the renderer, two new `AppState` fields, colored git status badges in `FileBrowser`, a conditional "What Changed" tab in `Toolbar`, and a `UnifiedDiffView` component that renders the unified diff for the active file.

## Tasks

- [x] 1. Extend `GitBackend` and `SpawnGitBackend` with a `diff` method
  - [x] 1.1 Add `diff(repoDir: string, filePath: string): Promise<string>` to `GitBackend` interface
    - Modify `packages/core/src/git/GitBackend.ts`
    - The method returns raw unified diff stdout; resolves to `""` when the file is clean or untracked
    - _Requirements: 1.1_

  - [x] 1.2 Implement `diff` in `SpawnGitBackend`
    - Modify `packages/core/src/git/SpawnGitBackend.ts`
    - Invoke `runGit(["diff", "HEAD", "--", filePath], repoDir)`; let `runGit` handle empty-stdout and non-zero exit semantics
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 1.3 Write property test for `SpawnGitBackend.diff`
    - **Property 1: SpawnGitBackend.diff delegates command arguments correctly**
    - **Validates: Requirements 1.2**
    - Add test to `packages/core/src/git/__tests__/SpawnGitBackend.property.test.ts` (create file)
    - Mock `runGit`; for arbitrary `repoDir` and `filePath` assert it is called with `["diff", "HEAD", "--", filePath]` in `repoDir` and the resolved value equals the mock stdout

- [x] 2. Wire `gitDiff` through `CoreEngine`, `ClientInterface`, IPC binding, and main-process handler
  - [x] 2.1 Add `gitDiff(filePath: string): Promise<string>` to `CoreEngine`
    - Modify `packages/core/src/CoreEngine.ts`
    - Delegate to `this.config.git.diff(this.config.kbRoot, filePath)`
    - _Requirements: 2.1_

  - [x] 2.2 Write property test for `CoreEngine.gitDiff`
    - **Property 2: CoreEngine.gitDiff delegates to GitBackend with kbRoot**
    - **Validates: Requirements 2.1**
    - Add test to `packages/core/src/__tests__/CoreEngine.property.test.ts` (create file)
    - For arbitrary `filePath`, mock `GitBackend.diff` and assert `CoreEngine.gitDiff(filePath)` returns the mock value

  - [x] 2.3 Declare `gitDiff(filePath: string): Promise<KbResult<string>>` in `ClientInterface`
    - Modify `packages/client/src/types.ts`
    - _Requirements: 2.2_

  - [x] 2.4 Add `gitDiff` binding in `ipc.ts`
    - Modify `packages/client/src/ipc.ts`
    - Map `gitDiff` to channel `"arlo-doc:gitDiff"` with `filePath` as sole argument via `invoke<string>`
    - _Requirements: 2.3_

  - [x] 2.5 Write property test for IPC binding `gitDiff`
    - **Property 3: IPC binding routes gitDiff to the correct channel**
    - **Validates: Requirements 2.3**
    - Add test to `packages/client/src/__tests__/ipc.property.test.ts` (create file)
    - Mock `ipcRenderer.invoke`; for arbitrary `filePath` assert it is called with `"arlo-doc:gitDiff"` and `filePath`

  - [x] 2.6 Register `ipcMain.handle("arlo-doc:gitDiff", …)` in the main process
    - Modify `apps/desktop/src/main/index.ts`
    - Call `getEngine(event.sender.id).gitDiff(filePath)` and wrap errors with `wrapError`; pass through empty string as success
    - _Requirements: 2.4, 2.5_

- [x] 3. Checkpoint — Ensure all back-end tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Extend `AppState` with `gitStatus` and `fileDiff` fields
  - [x] 4.1 Add `gitStatus: GitStatus | null` and `fileDiff: string | null` to `AppState`
    - Modify `apps/desktop/src/renderer/src/types.ts`
    - Both fields initialised to `null` in `INITIAL_STATE` inside `App.tsx`
    - _Requirements: 3.1, 3.2_

- [x] 5. Update `handleFileClick` in `App.tsx` to fetch git status and diff in parallel
  - [x] 5.1 Add race-condition guard via `latestFileRef` and parallel IPC calls
    - Modify `apps/desktop/src/renderer/src/App.tsx`
    - Add `const latestFileRef = useRef<string | null>(null)`
    - In `handleFileClick`, set `latestFileRef.current = filePath` then fire `Promise.all([readFile, gitStatus, gitDiff])`
    - After all settle, discard results if `latestFileRef.current !== filePath`
    - Update `AppState.gitStatus` and `AppState.fileDiff` on success; leave unchanged on `ok:false`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 5.2 Write property tests for `handleFileClick` state updates
    - **Property 5: handleFileClick updates both gitStatus and fileDiff for the opened file**
    - **Property 6: Race condition guard — only the last-opened file's diff is applied**
    - **Validates: Requirements 4.1, 4.2, 4.5**
    - Add tests to `apps/desktop/src/renderer/src/__tests__/App.property.test.tsx` (create file)
    - Mock `window.arlodoc`; verify state assignments for Property 5; simulate concurrent opens and verify only last-file result applies for Property 6

- [x] 6. Derive `gitStatusMap` and `showDiffTab`; add `viewMode` reset effect in `App.tsx`
  - [x] 6.1 Derive `gitStatusMap` with `useMemo` from `AppState.gitStatus`
    - Modify `apps/desktop/src/renderer/src/App.tsx`
    - Iterate `state.gitStatus.files`; join `folderPath + file.path` using `path-browserify`; map status strings to `"M"`, `"A"`, or `"D"` per design table
    - _Requirements: 5.7_

  - [x] 6.2 Derive `showDiffTab` and add `useEffect` to reset `viewMode`
    - Modify `apps/desktop/src/renderer/src/App.tsx`
    - Compute `showDiffTab = Boolean(state.fileDiff)`
    - Add `useEffect` that resets `viewMode` to `"preview"` when `!showDiffTab && state.viewMode === "diff"`
    - Pass `showDiffTab` to `Toolbar` and `gitStatusMap` to `FileBrowser`
    - _Requirements: 3.3, 6.4, 6.5_

  - [x] 6.3 Write property tests for `showDiffTab` and `viewMode` reset
    - **Property 4: showDiffTab is true if and only if fileDiff is non-null and non-empty**
    - **Property 9: viewMode resets to "preview" when showDiffTab transitions to false**
    - **Validates: Requirements 3.3, 6.4, 6.5**
    - Add tests to `apps/desktop/src/renderer/src/__tests__/App.property.test.tsx`
    - Use fast-check to generate arbitrary `fileDiff` values and assert `showDiffTab` correctness
    - Test the `useEffect` by setting `fileDiff` to `null`/`""` while `viewMode` is `"diff"` and asserting reset

  - [x] 6.4 Write property test for `gitStatusMap` derivation
    - **Property 8: gitStatusMap derivation preserves all files with correct letter codes**
    - **Validates: Requirements 5.7**
    - Add test to `apps/desktop/src/renderer/src/__tests__/App.property.test.tsx`
    - Generate arbitrary `GitStatus.files` arrays and verify every entry appears in the map with the correct letter and correct absolute path

- [x] 7. Add `GitStatusBadge` and extend `FileBrowser` with git status props
  - [x] 7.1 Implement `GitStatusBadge` inline component inside `FileBrowser.tsx`
    - Modify `apps/desktop/src/renderer/src/components/FileBrowser.tsx`
    - Define `STATUS_COLORS` map: `M → #d98000`, `A → #2da44e`, `D → #cf222e`
    - Render `<span>` with `aria-label="git status: {status}"`, monospace font, font-weight 600, font-size 10
    - _Requirements: 5.3, 5.4, 5.5_

  - [x] 7.2 Add `gitStatusMap?: Map<string, string>` prop to `FileBrowser` and pass `gitStatus` to `TreeRow`
    - Modify `apps/desktop/src/renderer/src/components/FileBrowser.tsx`
    - Pass `gitStatusMap?.get(node.path)` as `gitStatus` prop to each `TreeRow`
    - Render `{gitStatus && <GitStatusBadge status={gitStatus} />}` inside `TreeRow` to the right of the file name
    - _Requirements: 5.1, 5.2, 5.6_

  - [x] 7.3 Write property test for `FileBrowser` badge rendering
    - **Property 7: FileBrowser renders a GitStatusBadge for every path in gitStatusMap**
    - **Validates: Requirements 5.2, 5.6**
    - Add test to `apps/desktop/src/renderer/src/components/__tests__/FileBrowser.property.test.tsx`
    - For arbitrary `gitStatusMap` entries, assert `GitStatusBadge` appears for mapped paths and is absent for unmapped paths

- [x] 8. Update `Toolbar` with conditional `showDiffTab` prop
  - [x] 8.1 Add `showDiffTab: boolean` prop and compute `modes` array with `useMemo`
    - Modify `apps/desktop/src/renderer/src/components/Toolbar.tsx`
    - When `showDiffTab` is `true`, append `{ id: 'diff', label: 'What changed' }` to the modes array
    - When `showDiffTab` is `false`, omit the `diff` entry entirely
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 9. Create `UnifiedDiffView` component and wire into `MainLayout`
  - [x] 9.1 Create `UnifiedDiffView` component
    - Create `apps/desktop/src/renderer/src/components/UnifiedDiffView.tsx`
    - Accept `diff: string | null` prop
    - When `diff` is falsy, render centered `"No changes to display"` placeholder with `var(--font-sans)`, color `#8e8eaa`, font-size 13
    - When `diff` is truthy, render `<pre>` with `var(--font-mono)`, font-size 12, line-height 1.6, `whiteSpace: pre`, inside a scrollable `<div>`
    - _Requirements: 7.2, 7.3, 7.4_

  - [x] 9.2 Replace `DiffView` usage with `UnifiedDiffView` in `App.tsx` / `MainLayout`
    - Modify `apps/desktop/src/renderer/src/App.tsx` (or the layout file that renders screens)
    - When `viewMode === "diff"`, render `<UnifiedDiffView diff={state.fileDiff} />` instead of the previous `DiffView`
    - Setting `viewMode` to `"diff"` is triggered when the user clicks the "What changed" mode button
    - _Requirements: 7.1, 7.2_

  - [x] 9.3 Write property test for `UnifiedDiffView`
    - **Property 10: UnifiedDiffView renders diff content with monospace preformatted styling**
    - **Validates: Requirements 7.3**
    - Add test to `apps/desktop/src/renderer/src/components/__tests__/UnifiedDiffView.property.test.tsx` (create file)
    - For arbitrary non-empty diff strings, assert the content is inside a `<pre>` with monospace `fontFamily` and `whiteSpace: pre`
    - Assert placeholder renders when `diff` is `null` or `""`

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties derived from the design's "Correctness Properties" section
- Unit tests validate specific examples and edge cases
- The parallel `Promise.all` in `handleFileClick` keeps UI latency at the maximum of the three IPC calls rather than their sum
- `path-browserify` is already in the renderer bundle for the `gitStatusMap` derivation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.3"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.4", "4.1"] },
    { "id": 2, "tasks": ["1.3", "2.2", "2.5", "2.6"] },
    { "id": 3, "tasks": ["5.1", "6.1"] },
    { "id": 4, "tasks": ["5.2", "6.2", "7.1"] },
    { "id": 5, "tasks": ["6.3", "6.4", "7.2", "8.1", "9.1"] },
    { "id": 6, "tasks": ["7.3", "9.2"] },
    { "id": 7, "tasks": ["9.3"] }
  ]
}
```
