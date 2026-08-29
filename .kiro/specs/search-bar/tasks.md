# Implementation Plan: search-bar

## Overview

Implement a global search modal activated via `Cmd+Shift+F` / `Ctrl+Shift+F`. The feature spans four layers: shared types in `@arlo-doc/shared`, a `RipgrepRunner` module and two IPC handlers in the main process, two new `ClientInterface` methods in `@arlo-doc/client`, and a fully functional `SearchModal` component (plus supporting modules) in the renderer. Results open files in the active worktree tab at the matching line, scroll to that line in `DocumentView`, and expand ancestor directories in `FileBrowser`.

## Tasks

- [x] 1. Add shared search types to `packages/shared`
  - [x] 1.1 Create `packages/shared/src/types/search.ts` with four exported interfaces
    - Define `FileNameMatch { filePath: string; fileName: string }`
    - Define `ContentMatchLine { lineNumber: number; text: string; isMatch: boolean }`
    - Define `ContentMatch { filePath: string; lines: ContentMatchLine[] }`
    - Define `SearchOptions { caseSensitive: boolean; useRegex: boolean }`
    - _Requirements: REQ-011.1, REQ-011.2, REQ-011.3, REQ-011.4_

  - [x] 1.2 Re-export all four new interfaces from `packages/shared/src/index.ts`
    - Add `export type { FileNameMatch, ContentMatchLine, ContentMatch, SearchOptions } from "./types/search.js"`
    - _Requirements: REQ-011.6, REQ-011.7_

- [x] 2. Extend `WorktreeTabState` with `scrollToLine`
  - [x] 2.1 Add `scrollToLine: number | null` to `WorktreeTabState` and `EMPTY_TAB_STATE` in `apps/desktop/src/renderer/src/types.ts`
    - Set `scrollToLine: null` in `EMPTY_TAB_STATE`
    - Update all existing call sites that construct or spread `WorktreeTabState` to include `scrollToLine`
    - _Requirements: REQ-011.5, REQ-012.4_

- [x] 3. Add `ClientInterface` methods and IPC bindings in `packages/client`
  - [x] 3.1 Declare `searchFiles` and `findInFiles` method signatures on `ClientInterface` in `packages/client/src/types.ts`
    - Import `SearchOptions`, `FileNameMatch`, `ContentMatch` from `@arlo-doc/shared`
    - Add `TIMEOUT` to `KbErrorCode` union
    - _Requirements: REQ-006.1, REQ-006.2, REQ-012.1_

  - [x] 3.2 Implement `searchFiles` and `findInFiles` bindings in `packages/client/src/ipc.ts`
    - Map to channels `arlo-doc:searchFiles` and `arlo-doc:findInFiles` using the existing `invoke()` wrapper
    - _Requirements: REQ-006.3, REQ-012.1_

- [x] 4. Implement `RipgrepRunner` in the main process
  - [x] 4.1 Create `apps/desktop/src/main/ripgrepRunner.ts` with binary resolution and process spawning
    - Implement `resolveRgBinary()`: use `process.env.RG_PATH` if set (no fallback), else platform path inside `app.getAppPath()/bin/`
    - Check binary exists via `fs.access` before spawning; return `NOT_FOUND` if absent
    - Spawn `rg --json --context 2 --max-count 5 --glob '!{node_modules,.git,dist,build}'` with `cwd = repoDir` and minimal `{ PATH }` env
    - Add `--ignore-case` when `caseSensitive = false`; add `--fixed-strings` when `useRegex = false`
    - Enforce 30-second timeout with `SIGTERM` + `TIMEOUT` error
    - _Requirements: REQ-005.1, REQ-005.2, REQ-005.4, REQ-005.5, REQ-004.3, REQ-004.4, REQ-004.5_

  - [x] 4.2 Implement NDJSON output parser in `ripgrepRunner.ts`
    - Implement type guards `isRgMatch(obj): obj is RgMatchLine` and `isRgContext(obj): obj is RgContextLine`
    - Accumulate `ContentMatch` entries per file; stop early once 20 files or 100 `isMatch: true` lines reached
    - Handle exit codes: `0` → results, `1` → `{ ok: true, data: [] }`, `≥ 2` → `UNKNOWN` error
    - _Requirements: REQ-004.6, REQ-004.10, REQ-004.11, REQ-012.3_

  - [x] 4.3 Write unit tests for `RipgrepRunner` in `apps/desktop/src/main/__tests__/ripgrepRunner.test.ts`
    - `RG_PATH` set to existing file → uses that path; set to non-existent file → `NOT_FOUND`, no fallback
    - No `RG_PATH` → platform-specific bundle path constructed
    - Exit codes `0`, `1`, `≥ 2` handled correctly
    - Timeout → `{ ok: false, error: { code: 'TIMEOUT' } }`
    - Non-existent `repoDir` → `NOT_FOUND`
    - Exact `rg` flags verified per `SearchOptions` combinations
    - _Requirements: REQ-005.1, REQ-005.2, REQ-005.5, REQ-004.3–5, REQ-004.10–11_

  - [x] 4.4 Write property test for `RipgrepRunner` file count upper bound
    - **Property 5: Find in Files file count upper bound**
    - **Validates: Requirements REQ-004.6**
    - Add to `apps/desktop/src/main/__tests__/ripgrepRunner.test.ts`
    - Generate mock `rg --json` NDJSON with 0–50 distinct files; assert `ContentMatch[].length <= 20`

  - [x] 4.5 Write property test for `RipgrepRunner` total match line upper bound
    - **Property 6: Find in Files total match line upper bound**
    - **Validates: Requirements REQ-004.6**
    - Add to `apps/desktop/src/main/__tests__/ripgrepRunner.test.ts`
    - Generate mock `rg --json` NDJSON; assert sum of `lines.filter(l => l.isMatch).length` across all `ContentMatch` entries `<= 100`

  - [x] 4.6 Write property test for `ContentMatchLine` line number monotonicity
    - **Property 7: ContentMatchLine line number monotonicity**
    - **Validates: Requirements REQ-004**
    - Add to `apps/desktop/src/main/__tests__/ripgrepRunner.test.ts`
    - Generate mock NDJSON; for every `ContentMatch` assert `lines[i].lineNumber < lines[i+1].lineNumber` for all consecutive pairs

- [x] 5. Register IPC handlers in the main process
  - [x] 5.1 Register `ipcMain.handle("arlo-doc:searchFiles", …)` in `apps/desktop/src/main/index.ts`
    - Validate `repoDir` exists via `fs.access`; return `NOT_FOUND` if absent
    - Return `{ ok: true, data: [] }` immediately for empty query (renderer handles matching)
    - Wrap all exceptions via `wrapError`
    - _Requirements: REQ-006.4, REQ-006.6, REQ-006.7_

  - [x] 5.2 Register `ipcMain.handle("arlo-doc:findInFiles", …)` in `apps/desktop/src/main/index.ts`
    - Validate `repoDir`, short-circuit empty query, delegate to `RipgrepRunner.findInFiles`
    - Wrap all exceptions via `wrapError`
    - _Requirements: REQ-006.4, REQ-006.6, REQ-006.7_

  - [x] 5.3 Write property test for IPC handler error contract
    - **Property 8: IPC Handler Error Contract**
    - **Validates: Requirements REQ-006.4**
    - Add to `apps/desktop/src/main/__tests__/ripgrepRunner.test.ts`
    - Inject arbitrary exceptions into each handler; assert response always deserialises to `{ ok: false, error: { code: string, message: string } }` with non-empty `error.message`

- [x] 6. Checkpoint — Ensure all back-end and shared-layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Create `fileNameMatcher.ts` in the renderer
  - [x] 7.1 Create `apps/desktop/src/renderer/src/fileNameMatcher.ts` with `flattenLeaves`, `scoreFileName`, and `matchFileNames`
    - `flattenLeaves(tree: FileNode): FileNameMatch[]` — recursive leaf collector
    - `scoreFileName(query, baseName, options): number | null` — scoring tiers: exact prefix (1000+len), consecutive run (500+len), word-boundary (200+count), fuzzy (100−gap); `null` on no match
    - Case-insensitivity: lowercase both sides when `caseSensitive = false`
    - Regex mode: construct `new RegExp(query, caseSensitive ? '' : 'i')`; return `{ ok: false, error: 'INVALID_REGEX' }` on `SyntaxError`
    - `matchFileNames` returns up to 50 results ordered by score desc, then `filePath` asc
    - _Requirements: REQ-003.2, REQ-003.3, REQ-003.5, REQ-003.7, REQ-003.8_

  - [x] 7.2 Write unit tests for `fileNameMatcher` in `apps/desktop/src/renderer/src/__tests__/fileNameMatcher.test.ts`
    - Empty query returns `[]`
    - Query longer than any file name returns `[]`
    - Exact prefix match ranks above mid-name match
    - `useRegex = true` with invalid pattern returns `{ ok: false, error: 'INVALID_REGEX' }`
    - FileTree with no leaf nodes returns `[]`
    - _Requirements: REQ-003.4, REQ-003.8, REQ-003.10_

  - [x] 7.3 Write property test for file name search result limit
    - **Property 1: File Name Search Result Limit**
    - **Validates: Requirements REQ-003.3**
    - Add to `apps/desktop/src/renderer/src/__tests__/fileNameMatcher.test.ts`
    - For arbitrary file trees (0–200 leaf nodes) and any non-empty query, assert `matchFileNames(...).length <= 50`

  - [x] 7.4 Write property test for file name search result ordering
    - **Property 2: File Name Search Result Ordering**
    - **Validates: Requirements REQ-003.3, REQ-003.5**
    - Add to `apps/desktop/src/renderer/src/__tests__/fileNameMatcher.test.ts`
    - Assert results are score-descending; equal-score ties are `filePath`-ascending; a case-insensitive prefix match ranks above a non-prefix fuzzy match

  - [x] 7.5 Write property test for case-insensitivity idempotence
    - **Property 3: File Name Search Case-Insensitivity Idempotence**
    - **Validates: Requirements REQ-003.7**
    - Add to `apps/desktop/src/renderer/src/__tests__/fileNameMatcher.test.ts`
    - For any query `q` and base name `f` with `caseSensitive = false`, assert `scoreFileName(q.toUpperCase(), f, opts)` equals `scoreFileName(q.toLowerCase(), f, opts)`

  - [x] 7.6 Write property test for regex mode results satisfy pattern
    - **Property 4: Regex Mode — Results Satisfy the Pattern**
    - **Validates: Requirements REQ-003.8**
    - Add to `apps/desktop/src/renderer/src/__tests__/fileNameMatcher.test.ts`
    - For any syntactically valid regex `q`, every `FileNameMatch` in the result must have a `fileName` matched by `new RegExp(q, 'i')`

- [x] 8. Checkpoint — Ensure all file-name matcher tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Replace `SearchModal` component
  - [x] 9.1 Replace `apps/desktop/src/renderer/src/components/SearchModal.tsx` with full implementation
    - Props: `repoDir: string | null`, `fileTree: FileNode | null`, `onClose: () => void`, `onResultClick: (filePath: string, lineNumber?: number) => void`
    - Two tabs: **Search Files** and **Find in Files**; activates Search Files on mount with focus on input
    - Backdrop (`rgba(26,26,46,.28)`) click and `Escape` invoke `onClose()`; card click stops propagation
    - Layout: 720 px wide card, 96 px from top; scrollable result list max-height 420 px
    - `repoDir === null || fileTree === null` → "No folder open" with non-interactive inputs
    - _Requirements: REQ-002.1–8_

  - [x] 9.2 Implement Search Files tab behaviour in `SearchModal`
    - 150 ms debounce on input via `useRef`-held `setTimeout`
    - On debounce fire, call `matchFileNames` in renderer (no IPC); update `fileResults` or show regex error
    - Render each `FileNameMatch` as base name + full path in reduced-opacity monospace
    - Empty query → empty list; zero matches → "No files matching «query»"; no leaves → "No files in this folder"
    - _Requirements: REQ-003.1–10_

  - [x] 9.3 Implement Find in Files tab behaviour in `SearchModal`
    - `Enter` triggers `window.arlodoc.findInFiles(repoDir, contentQuery, searchOptions)`
    - Show spinner and disable input while in-flight; re-enable on response
    - Group results by file header (relative path, `FileTypeIcon`, match count) + `ContentMatchLine` rows
    - Matched rows highlighted; context rows default background
    - Truncation notice when `contentResults.length === 20`
    - Empty query on `Enter` → clear results, show neutral empty-state; error → "Search failed" footer
    - _Requirements: REQ-004.1–12, REQ-010.1–8_

  - [x] 9.4 Implement search options toggles (**Aa** / **.\***) in `SearchModal`
    - Two toggle buttons below active tab's input; initial state both `false` on mount
    - Toggling re-executes active tab's search if input non-empty; invalid regex suppresses re-execution
    - Active toggle rendered with filled background; inactive with muted/outlined appearance
    - _Requirements: REQ-007.1–8_

  - [x] 9.5 Implement keyboard navigation in `SearchModal`
    - `ArrowDown` / `ArrowUp` on input: increment/decrement `selectedIndex` with wrapping; no-op when list empty
    - `Enter` on Search Files: if `selectedIndex >= 0` call `onResultClick` + `onClose`
    - `Enter` on Find in Files: if `selectedIndex === -1` trigger search; if `>= 0` call `onResultClick` + `onClose`
    - `selectedIndex` resets to `0` (or `-1` while in-flight) when result list changes
    - `selectedIndex` changes trigger `scrollIntoView({ block: 'nearest' })` in `useEffect`
    - Navigable rows on Find in Files tab: only `ContentMatchLine` rows with `isMatch: true` (file headers skipped)
    - _Requirements: REQ-008.1–8_

  - [x] 9.6 Implement footer count display in `SearchModal`
    - Search Files: "N files" count; Find in Files: "N matches across M files"
    - Loading state: "Searching…"; error state: "Search failed"
    - N = total `isMatch: true` lines; M = `ContentMatch[].length`
    - _Requirements: REQ-010.4–5_

  - [x] 9.7 Write unit tests for `SearchModal` in `apps/desktop/src/renderer/src/__tests__/search.property.test.ts`
    - Mounts with Search Files tab active and input focused
    - Backdrop click calls `onClose()`; card click does not
    - `Escape` key calls `onClose()`
    - `ArrowDown` / `ArrowUp` wrapping at list boundaries
    - `Enter` with selected result on Search Files calls `onResultClick` + `onClose`
    - `Enter` on Find in Files with no selection triggers IPC call
    - Spinner visible and input disabled while IPC in-flight
    - Truncation notice shown when 20 files returned
    - "No folder open" rendered when `repoDir = null`
    - _Requirements: REQ-002.3–5, REQ-004.1, REQ-010.1, REQ-010.12_

  - [x] 9.8 Write property test for footer count accuracy
    - **Property 10: Footer Count Accuracy**
    - **Validates: Requirements REQ-010.4**
    - Add to `apps/desktop/src/renderer/src/__tests__/search.property.test.ts`
    - For arbitrary `ContentMatch[]`, assert footer "N matches across M files" has N = total `isMatch: true` lines and M = array length

- [x] 10. Wire keyboard shortcut and `handleSearchResultClick` in `App.tsx`
  - [x] 10.1 Add `Cmd+Shift+F` / `Ctrl+Shift+F` keyboard shortcut listener to `App.tsx`
    - `window` `keydown` listener; guards: skip when another modal is open or `activeTabId === null`
    - Sets `state.modal` to `'search'` on trigger; `Escape` closes and clears inputs (handled inside `SearchModal`)
    - _Requirements: REQ-001.1–5_

  - [x] 10.2 Add `getAncestorPaths(filePath: string): string[]` pure helper to `App.tsx` (exported for testing)
    - Split path on `'/'`, accumulate each prefix, return as array of ancestor path strings
    - _Requirements: REQ-009.4_

  - [x] 10.3 Implement `handleSearchResultClick(filePath, lineNumber?)` in `App.tsx`
    - Dismiss modal immediately (`update({ modal: null })`) before awaiting `readFile`
    - Expand ancestor paths by merging into `tabStates[tabId].expandedPaths`
    - Load file via `Promise.all([readFile, gitStatus, gitDiff])` with `latestFileRef` race guard
    - Clamp `lineNumber` to `[1, totalLines]` and store in `scrollToLine`; `null` if not provided
    - On `readFile` failure: set `activeFilePath: null`, `fileContent: null`, `scrollToLine: null`
    - _Requirements: REQ-009.1–5_

  - [x] 10.4 Pass `SearchModal` props through `MainLayout` — add `onSearchResultClick` prop and render `SearchModal` when `state.modal === 'search'`
    - Add `onSearchResultClick: (filePath: string, lineNumber?: number) => void` to `MainLayout` props
    - Render `<SearchModal repoDir={state.repoDir} fileTree={activeTabState?.fileTree ?? null} onClose={...} onResultClick={onSearchResultClick} />` when `state.modal === 'search'`
    - _Requirements: REQ-002.6, REQ-009.3_

  - [x] 10.5 Write unit tests for `handleSearchResultClick` and keyboard shortcut in `apps/desktop/src/renderer/src/__tests__/search.property.test.ts`
    - `handleSearchResultClick` clamps `lineNumber` > file length to last line
    - `handleSearchResultClick` expands ancestors in `expandedPaths`
    - Modal dismissed before `readFile` resolves
    - Shortcut does not open modal when `activeTabId = null`
    - Shortcut does not override `modal = 'publish'` (or any other non-search modal)
    - _Requirements: REQ-001.3–4, REQ-009.2–5_

  - [x] 10.6 Write property test for `scrollToLine` clamping
    - **Property 9: scrollToLine Clamping**
    - **Validates: Requirements REQ-009.2**
    - Add to `apps/desktop/src/renderer/src/__tests__/search.property.test.ts`
    - For arbitrary file content (determining N lines) and arbitrary positive integer `lineNumber`, assert stored `scrollToLine = min(lineNumber, N)`

- [x] 11. Update `DocumentView` to consume `scrollToLine`
  - [x] 11.1 Add `scrollToLine?: number | null` prop to `DocumentView` in `apps/desktop/src/renderer/src/components/DocumentView.tsx` (or wherever `DocumentView` is defined)
    - After file content renders, `useEffect` fires `scrollIntoView` on `data-line={scrollToLine}` element
    - Apply a transient highlight class to the target line element
    - Reset `scrollToLine` to `null` in `tabStates` (via a callback prop or state update) after scroll completes, preventing re-scroll on re-renders
    - _Requirements: REQ-009.1–2_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design's "Correctness Properties" section
- Unit tests validate specific examples and edge cases
- File-name matching runs entirely in the renderer — no IPC round-trip — keeping latency sub-millisecond for typical repos
- The `arlo-doc:searchFiles` IPC handler is a valid stub returning `[]`; it exists to satisfy `ClientInterface` for future server-side use
- `scrollToLine` is reset to `null` by `DocumentView` after scrolling to prevent re-scrolling on re-renders
- `latestFileRef` race guard in `handleSearchResultClick` mirrors the pattern already used in `handleFileClick`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "3.1"] },
    { "id": 2, "tasks": ["3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "5.1", "5.2", "7.1"] },
    { "id": 4, "tasks": ["4.3", "4.4", "4.5", "4.6", "5.3", "7.2", "7.3", "7.4", "7.5", "7.6"] },
    { "id": 5, "tasks": ["9.1", "10.2"] },
    { "id": 6, "tasks": ["9.2", "9.3", "9.4", "9.5", "9.6", "10.1", "10.3"] },
    { "id": 7, "tasks": ["9.7", "9.8", "10.4", "10.5", "10.6"] },
    { "id": 8, "tasks": ["11.1"] }
  ]
}
```
