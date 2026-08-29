# Requirements Document

## Introduction

The `search-bar` feature adds a global search modal to the Arlo desktop app, accessible via `Cmd+Shift+F`. The modal provides two complementary search modes in a single overlay: **Search Files** (fuzzy file name matching, real-time, debounced) and **Find in Files** (full-text content search powered by a local ripgrep binary, triggered on Enter). Both modes operate entirely within the Electron main process against the currently open repo directory — no server roundtrip is involved.

Search results are grouped by file and displayed VS Code–style with matching lines and surrounding context. Clicking a result opens the file in the active worktree tab at the matching line and highlights the file in the sidebar `FileBrowser`. Search options available in v1 include case-sensitive matching, regex mode, and automatic exclusion of `node_modules`, `.git`, `dist`, and `build` directories.

This feature spans four layers:

- **Shared types** (`packages/shared/src`) — `FileNameMatch`, `ContentMatch`, `ContentMatchLine`, and `SearchOptions` interfaces.
- **Main process** (`apps/desktop/src/main`) — new `arlo-doc:searchFiles` and `arlo-doc:findInFiles` IPC handlers wrapping fuzzy file-name matching and ripgrep execution.
- **Preload / client bridge** (`packages/client/src`) — two new `ClientInterface` methods and their IPC bindings.
- **Renderer** (`apps/desktop/src/renderer/src`) — replaced `SearchModal` component, keyboard-shortcut wiring in `App.tsx`, and `handleSearchOpen` / `handleSearchResultClick` handlers that integrate with the existing worktree tab editor and `FileBrowser`.

---

## Glossary

- **App**: The root React component (`App.tsx`) that owns all shared `AppState`.
- **AppState**: The single state object managed in `App.tsx`; `modal: 'search'` signals the `SearchModal` is open.
- **ClientInterface**: The TypeScript interface in `packages/client/src/types.ts` declaring every renderer-callable IPC method.
- **ContentMatch**: A result record from `Find in Files` containing a file path and an array of `ContentMatchLine` entries.
- **ContentMatchLine**: A single line entry within a `ContentMatch` — a line number, the raw line text, and a boolean flag indicating whether it is a matching line (versus a context line).
- **DEFAULT_EXCLUDES**: The fixed set of directory names excluded from all searches: `node_modules`, `.git`, `dist`, `build`.
- **FileNameMatch**: A result record from `Search Files` containing a file path and the file's base name.
- **FileBrowser**: The left-panel component (`components/FileBrowser.tsx`) that renders the active tab's file tree.
- **Find in Files**: The content search mode; executes `rg` against file contents and returns `ContentMatch[]` grouped by file.
- **IPC channel**: A named `ipcMain.handle` / `ipcRenderer.invoke` pair; all channels are prefixed `arlo-doc:`.
- **KbResult**: The discriminated union `{ ok: true; data: T } | { ok: false; error: KbError }` used by all IPC methods.
- **MainLayout**: The `screens/MainLayout.tsx` component that hosts `SearchModal` when `state.modal === 'search'`.
- **ModalKind**: The union type in `apps/desktop/src/renderer/src/types.ts` that controls which overlay is visible; includes `'search'` as an existing member.
- **RipgrepRunner**: The main-process module responsible for locating and spawning the `rg` binary and parsing its output.
- **Search Files**: The file-name search mode; walks the in-memory file tree and applies fuzzy matching against base names.
- **SearchModal**: The React component (`components/SearchModal.tsx`) rendered when `state.modal === 'search'`; replaced in full by this feature.
- **SearchOptions**: Options shared by both search modes: `caseSensitive: boolean`, `useRegex: boolean`.
- **WorktreeTab**: A tab record in `AppState.tabs`; each tab has an independent `worktreePath`.
- **WorktreeTabState**: Per-tab state in `AppState.tabStates`; holds `activeFilePath`, `fileTree`, and `expandedPaths`.
- **activeTabId**: The `AppState` field identifying the currently focused tab; search always targets the active tab's repo dir.

---

## Requirements

### REQ-001: Global Search Keyboard Shortcut

**User Story:** As a user, I want to open the search modal with a keyboard shortcut so that I can start searching without taking my hands off the keyboard.

#### Acceptance Criteria

1. WHEN the user presses `Cmd+Shift+F` (macOS) or `Ctrl+Shift+F` (Windows/Linux) while the app is focused, THE App SHALL set `state.modal` to `'search'` within 200 ms, causing `SearchModal` to appear and move keyboard focus to the search input field.
2. WHEN `state.modal` is `'search'` and the user presses `Escape`, THE App SHALL set `state.modal` to `null`, closing `SearchModal` and clearing any text entered in the search inputs.
3. WHEN `state.modal` is not `null` and is not `'search'` (e.g. `'publish'` or a `CloseWorktreeModal` object), THE App SHALL NOT respond to `Cmd+Shift+F` by overwriting the current modal.
4. WHEN `state.activeTabId` is `null` (empty state — no folder open), THE App SHALL NOT open `SearchModal` in response to `Cmd+Shift+F`.
5. THE `Cmd+Shift+F` shortcut SHALL be interceptable even when a child element (e.g., a focused input or text area) has keyboard focus, such that the shortcut always opens the modal when criteria 3 and 4 are not active.

---

### REQ-002: Search Modal Structure

**User Story:** As a user, I want the search modal to present file-name and content search in a single overlay so that I can switch between search modes without navigating away.

#### Acceptance Criteria

1. THE `SearchModal` component SHALL render as a centred overlay card 720 px wide, positioned 96 px from the top of the viewport, above a dimmed backdrop (`rgba(26,26,46,.28)`).
2. THE `SearchModal` SHALL display two tabs at the top of the card: **Search Files** and **Find in Files**.
3. WHEN `SearchModal` first mounts, THE `SearchModal` SHALL activate the **Search Files** tab and move keyboard focus to the search input field within that tab.
4. WHEN the user clicks the backdrop or presses `Escape` while the modal is open, THE `SearchModal` SHALL invoke `onClose()` and the modal SHALL be removed from the display.
5. WHEN the user clicks anywhere on the card, THE `SearchModal` SHALL NOT invoke `onClose()`.
6. THE `SearchModal` SHALL accept the following props: `repoDir: string`, `fileTree: FileNode | null`, `onClose: () => void`, `onResultClick: (filePath: string, lineNumber?: number) => void`.
7. WHILE `repoDir` is `null` or `fileTree` is `null`, THE `SearchModal` SHALL render an inline message — "No folder open" — in place of the result list and SHALL render both tab search inputs as non-interactive, not accepting keyboard input or triggering a search.
8. WHEN the user clicks a tab that is not currently active, THE `SearchModal` SHALL activate that tab and move keyboard focus to its search input field.

---

### REQ-003: Search Files Tab — Fuzzy File Name Search

**User Story:** As a user, I want to type a partial file name and immediately see a list of matching files so that I can quickly open any file in my repo without navigating the folder tree.

#### Acceptance Criteria

1. WHEN the user types in the **Search Files** input, THE `SearchModal` SHALL execute the file-name search no sooner than 150 ms after the last keystroke (debounced), using the current `searchOptions.caseSensitive` setting, and update the result list.
2. THE file-name search SHALL operate entirely in the renderer process against the flattened list of `FileNode` leaves derived from the active tab's `fileTree`; it SHALL NOT make an IPC call.
3. THE file-name search SHALL return up to 50 `FileNameMatch` results, ordered by descending match score (best match first); results with equal scores SHALL be ordered alphabetically by full path ascending.
4. WHEN the query is an empty string, THE `SearchModal` SHALL display an empty result list and SHALL NOT execute a search.
5. THE `FileNameMatcher` SHALL match the query against each file's base name (not the full path) using a fuzzy algorithm that: scores consecutive character runs higher than non-consecutive runs; scores matches at the start of a word boundary higher than mid-word matches; and scores an exact prefix match above any fuzzy match.
6. THE result list for **Search Files** SHALL display each `FileNameMatch` as a single row showing the file's base name in normal weight and the full path below it in a reduced-opacity monospace font.
7. WHEN `searchOptions.caseSensitive` is `false`, THE `FileNameMatcher` SHALL compare both query and base name lowercased; WHEN `searchOptions.caseSensitive` is `true`, THE `FileNameMatcher` SHALL compare them verbatim.
8. WHEN `searchOptions.useRegex` is `true`, THE `SearchModal` SHALL treat the query as a JavaScript `RegExp` pattern (with the `i` flag added when `searchOptions.caseSensitive` is `false`) applied against each base name; IF the pattern is syntactically invalid, THE `SearchModal` SHALL display an inline error — "Invalid regex" — below the input and SHALL NOT execute the search.
9. WHEN a non-empty query produces zero matches, THE `SearchModal` SHALL display a message — "No files matching «query»" — in the result area and SHALL NOT display an empty list.
10. WHEN `fileTree` is non-null but contains no leaf `FileNode` entries, THE `SearchModal` SHALL display the message — "No files in this folder" — and SHALL NOT execute a search.

---

### REQ-004: Find in Files Tab — Full-Text Content Search

**User Story:** As a user, I want to search the text content of all files in my repo and see matching lines grouped by file so that I can locate specific code or documentation without opening each file manually.

#### Acceptance Criteria

1. WHEN the user presses `Enter` in the **Find in Files** input, THE `SearchModal` SHALL call `window.arlodoc.findInFiles(repoDir, query, searchOptions)`, render a visible spinner in the result area, and disable the search input until the result arrives.
2. THE `SearchModal` SHALL NOT execute a content search on every keystroke; content search is triggered only by the `Enter` key or a dedicated **Search** button.
3. THE `arlo-doc:findInFiles` IPC handler SHALL spawn `rg` with the following fixed flags: `--json`, `--context 2` (two lines of context above and below each match), `--max-count 5` (maximum 5 matches per file), and `--glob '!{node_modules,.git,dist,build}'` (auto-exclude `DEFAULT_EXCLUDES`).
4. WHEN `searchOptions.caseSensitive` is `false`, THE `RipgrepRunner` SHALL pass `--ignore-case` to `rg`; WHEN `searchOptions.caseSensitive` is `true`, THE `RipgrepRunner` SHALL NOT pass any case flag (rg defaults to case-sensitive).
5. WHEN `searchOptions.useRegex` is `false`, THE `RipgrepRunner` SHALL pass `--fixed-strings` to `rg` so the query is treated as a literal string; WHEN `searchOptions.useRegex` is `true`, THE `RipgrepRunner` SHALL omit `--fixed-strings`, allowing `rg` to interpret the query as a regex.
6. THE `arlo-doc:findInFiles` handler SHALL truncate results to a maximum of 20 files (the first 20 files with at least one match in `rg`'s output), yielding at most 100 total match lines.
7. THE result list for **Find in Files** SHALL display results grouped by file: a file header row showing the file's path relative to `repoDir`, followed by one row per `ContentMatchLine` showing the line number (right-aligned, 4-character minimum width, monospace) and the line text.
8. WHEN a `ContentMatchLine` has `isMatch: true`, THE `SearchModal` SHALL render that row with a visually distinct highlighted background; WHEN `isMatch: false` (context line), THE `SearchModal` SHALL render the row with the default result-list row background.
9. WHEN the query is an empty string and the user presses `Enter`, THE `SearchModal` SHALL NOT execute the search, SHALL clear any prior results, and SHALL display a neutral empty-state message in the result area.
10. IF `rg` exits with code 1 (no matches found), THE `arlo-doc:findInFiles` handler SHALL return `{ ok: true, data: [] }` — not an error.
11. IF `rg` exits with a code other than 0 or 1, THE `arlo-doc:findInFiles` handler SHALL return `{ ok: false, error: { code: 'UNKNOWN', message: rg stderr } }`.
12. WHEN the `arlo-doc:findInFiles` result is truncated to the 20-file limit, THE `SearchModal` SHALL display a notice — e.g. "Showing first 20 files — refine your query to see more" — below the result list.

---

### REQ-005: Ripgrep Binary Resolution

**User Story:** As a developer, I want the app to locate a bundled ripgrep binary at runtime so that users do not need ripgrep installed on their system.

#### Acceptance Criteria

1. THE `RipgrepRunner` SHALL resolve the `rg` binary path as follows: IF `process.env.RG_PATH` is set, use that value as the binary path with no fallback; OTHERWISE use a platform-specific path inside the Electron app bundle: `{app.getAppPath()}/bin/rg` on macOS/Linux and `{app.getAppPath()}\bin\rg.exe` on Windows. IF `RG_PATH` is set but the file does not exist at that path, THE `RipgrepRunner` SHALL return a NOT_FOUND error without falling back to the bundle path.
2. IF the resolved binary path does not exist on disk, THE `RipgrepRunner` SHALL return `{ ok: false, error: { code: 'NOT_FOUND', message: 'ripgrep binary not found at <resolved-path>' } }` where `<resolved-path>` is replaced by the actual path string that was checked, without spawning a process.
3. THE `electron-builder` configuration SHALL include the `bin/rg` (macOS/Linux) and `bin/rg.exe` (Windows) binaries as `extraResources` entries so they are present in production builds.
4. THE `RipgrepRunner` SHALL set the spawned process's `cwd` to `repoDir` and SHALL provide a minimal environment containing only the `PATH` variable from the parent process, with all other parent environment variables excluded.
5. THE `RipgrepRunner` SHALL enforce a 30-second timeout on the spawned `rg` process; IF the process does not exit within 30 seconds, THE `RipgrepRunner` SHALL kill it and return `{ ok: false, error: { code: 'TIMEOUT', message: 'ripgrep timed out after 30 seconds' } }`.

---

### REQ-006: IPC Bridge for Search Operations

**User Story:** As a developer, I want typed IPC methods for both search modes so that the renderer can call them with the same `KbResult<T>` pattern used by all other operations.

#### Acceptance Criteria

1. THE `ClientInterface` in `packages/client/src/types.ts` SHALL declare a `searchFiles(repoDir: string, query: string, options: SearchOptions) => Promise<KbResult<FileNameMatch[]>>` method.
2. THE `ClientInterface` SHALL declare a `findInFiles(repoDir: string, query: string, options: SearchOptions) => Promise<KbResult<ContentMatch[]>>` method.
3. THE IPC binding in `packages/client/src/ipc.ts` SHALL implement both methods, forwarding calls to `arlo-doc:searchFiles` and `arlo-doc:findInFiles` channels using the existing `invoke()` wrapper.
4. THE main process SHALL register `ipcMain.handle` handlers for both `arlo-doc:searchFiles` and `arlo-doc:findInFiles`, following the existing `wrapError` error-propagation pattern; any exception thrown inside either handler SHALL result in a `KbResult` with `ok: false` and a non-empty `error` object being returned to the renderer — never an unhandled rejection.
5. THE preload script SHALL expose the updated `ClientInterface` (including both new methods) on `window.arlodoc` via `contextBridge.exposeInMainWorld`.
6. IF either `arlo-doc:searchFiles` or `arlo-doc:findInFiles` is called with `repoDir` pointing to a path that does not exist on disk, THE respective handler SHALL return `{ ok: false, error: { code: 'NOT_FOUND', message: 'repo directory not found: <repoDir>' } }`.
7. IF either `arlo-doc:searchFiles` or `arlo-doc:findInFiles` is called with an empty `query` string, THE respective handler SHALL return `{ ok: true, data: [] }` immediately without spawning any process or filesystem operation.

---

### REQ-007: Search Options

**User Story:** As a user, I want to toggle case sensitivity and regex mode so that I can refine my search without switching tools.

#### Acceptance Criteria

1. THE `SearchModal` SHALL display two toggle buttons positioned directly below the active tab's search input field: **Aa** (case sensitive) and **.\*** (regex mode).
2. WHEN the user clicks the **Aa** toggle, THE `SearchModal` SHALL update `searchOptions.caseSensitive` and, if the active tab's search input is non-empty, re-execute the search for the active tab.
3. WHEN the user clicks the **.\*** toggle, THE `SearchModal` SHALL update `searchOptions.useRegex` and, if the active tab's search input is non-empty, re-execute the search for the active tab.
4. THE initial state of both toggles SHALL be `false` (off) each time `SearchModal` mounts.
5. WHEN `searchOptions.caseSensitive` is `true`, THE **Aa** toggle SHALL render in an active visual state (e.g., filled background with contrasting label text); WHEN `false`, it SHALL render in an inactive visual state (e.g., muted or outlined appearance).
6. WHEN `searchOptions.useRegex` is `true`, THE **.\*** toggle SHALL render in an active visual state; WHEN `false`, it SHALL render in an inactive visual state.
7. THE `searchOptions` state SHALL be local to `SearchModal` and SHALL NOT be persisted to `AppState` or disk.
8. WHEN `searchOptions.useRegex` is `true` and the active tab's search input contains a syntactically invalid regex pattern, THE `SearchModal` SHALL display an inline error indicator and SHALL NOT execute or re-execute a search.

---

### REQ-008: Keyboard Navigation

**User Story:** As a user, I want to navigate search results and open files using only the keyboard so that my workflow stays fast without requiring mouse interaction.

#### Acceptance Criteria

1. WHEN the result list contains at least one entry, THE `SearchModal` SHALL maintain a `selectedIndex` that identifies the currently highlighted result row, initialised to `0` (first result) whenever the result list changes.
2. WHEN the user presses `ArrowDown` while the search input is focused or a result is selected, THE `SearchModal` SHALL increment `selectedIndex` by 1, wrapping to 0 when the end of the list is reached.
3. WHEN the user presses `ArrowUp` while the search input is focused or a result is selected, THE `SearchModal` SHALL decrement `selectedIndex` by 1, wrapping to the last index when at 0.
4. WHEN the user presses `Enter` on the **Search Files** tab, IF `selectedIndex` points to a valid `FileNameMatch`, THE `SearchModal` SHALL call `onResultClick(match.filePath)` and close the modal.
5. WHEN the user presses `Enter` on the **Find in Files** tab and `selectedIndex` is `-1` (no result selected), THE `SearchModal` SHALL execute the content search.
6. WHEN the user presses `Enter` on the **Find in Files** tab and `selectedIndex` is `0` or greater pointing to a valid `ContentMatchLine`, THE `SearchModal` SHALL call `onResultClick(match.filePath, line.lineNumber)` and close the modal.
7. WHEN `selectedIndex` changes due to keyboard navigation, THE `SearchModal` SHALL scroll the selected result row into the visible area of the result list within one rendered frame.
8. WHEN the result list is empty, `ArrowUp` and `ArrowDown` SHALL have no effect.

---

### REQ-009: Result Click — Open File at Line

**User Story:** As a user, I want clicking or selecting a search result to open the file in the editor at the matching line so that I can immediately start reading or editing the relevant content.

#### Acceptance Criteria

1. WHEN `onResultClick(filePath, lineNumber?)` is called, THE App SHALL call `window.arlodoc.readFile(filePath)` and, on success, update `tabStates[activeTabId].activeFilePath` to `filePath` and `tabStates[activeTabId].fileContent` to the file's contents.
2. WHEN `lineNumber` is provided and is a positive integer (≥ 1), THE App SHALL store it in `tabStates[activeTabId].scrollToLine` so that `DocumentView` scrolls to and highlights that line after the file content renders; IF `lineNumber` exceeds the total number of lines in the file, THE App SHALL set `scrollToLine` to the last line of the file.
3. WHEN `onResultClick` is called, THE `SearchModal` SHALL invoke `onClose()` before awaiting the result of `readFile`, so the modal is dismissed without waiting for the file read to complete.
4. WHEN `onResultClick(filePath)` is called and `filePath` is inside a directory not currently expanded in `tabStates[activeTabId].expandedPaths`, THE App SHALL expand all ancestor directories of `filePath` by appending each ancestor's path to `expandedPaths`, making the file visible in `FileBrowser` without requiring the user to manually expand folders.
5. IF `window.arlodoc.readFile(filePath)` fails, THE App SHALL set `tabStates[activeTabId].activeFilePath` to `null`, clear `tabStates[activeTabId].fileContent`, and display the error message derived from the failure in the main content area.

---

### REQ-010: Result Display and Visual Feedback

**User Story:** As a user, I want clear visual feedback during search so that I can tell when a search is running, when it found nothing, and how many results were found.

#### Acceptance Criteria

1. WHILE a `findInFiles` IPC call is in flight (from the moment the call is made until the response is received), THE `SearchModal` SHALL render a visible spinner in the result area and SHALL render the **Find in Files** input as non-interactive; WHEN the response arrives (success or error), the input SHALL be re-enabled.
2. WHEN `findInFiles` returns `{ ok: true, data: [] }` (no matches), THE `SearchModal` SHALL display a horizontally centred message communicating that no results were found for the given query.
3. WHEN `findInFiles` returns `{ ok: false, error: ... }`, THE `SearchModal` SHALL display an error message derived from the `error` field in the result area, SHALL NOT show a spinner, and SHALL re-enable the **Find in Files** input.
4. THE `SearchModal` footer SHALL display the total result count: for **Search Files**, "N files" where N is the number of `FileNameMatch` entries; for **Find in Files**, "N matches across M files" where N is the total number of match lines with `isMatch: true` and M is the number of `ContentMatch` entries.
5. WHILE a `findInFiles` IPC call is in flight, THE `SearchModal` footer SHALL display a loading state (e.g., "Searching…") in place of the result count; WHEN an error is returned, the footer SHALL display "Search failed" in place of the result count.
6. WHEN the result list exceeds the height of the result container, THE result list SHALL be vertically scrollable within a container of maximum height 420 px; the input row, tabs row, options row, and footer SHALL remain fixed and not scroll.
7. THE currently selected result row (from keyboard navigation) SHALL render with a visually distinct highlighted background to distinguish it from non-selected rows.
8. WHEN a **Find in Files** result is grouped under a file header, THE file header row SHALL display the path relative to `repoDir`, the file's `FileTypeIcon`, and the count of matching lines for that file (e.g. "3 matches").

---

### REQ-011: Shared Types

**User Story:** As a developer, I want the search result and options types defined in `@arlo-doc/shared` so that both main-process handlers and renderer components can import them from a single source without circular dependencies.

#### Acceptance Criteria

1. THE `@arlo-doc/shared` package SHALL export a `FileNameMatch` interface with fields `filePath: string` (absolute path) and `fileName: string` (base name only).
2. THE `@arlo-doc/shared` package SHALL export a `ContentMatchLine` interface with fields `lineNumber: number` (1-indexed), `text: string` (raw line content), and `isMatch: boolean` (`true` for a matched line, `false` for a context line).
3. THE `@arlo-doc/shared` package SHALL export a `ContentMatch` interface with fields `filePath: string` (absolute path) and `lines: ContentMatchLine[]`.
4. THE `@arlo-doc/shared` package SHALL export a `SearchOptions` interface with fields `caseSensitive: boolean` and `useRegex: boolean`.
5. THE `WorktreeTabState` interface in `apps/desktop/src/renderer/src/types.ts` SHALL be extended with `scrollToLine: number | null` (where non-null values are integers ≥ 1, consistent with 1-indexed line numbering; `null` by default in `EMPTY_TAB_STATE`).
6. All four new types (`FileNameMatch`, `ContentMatchLine`, `ContentMatch`, `SearchOptions`) SHALL be exported from the `@arlo-doc/shared` package barrel (e.g., `index.ts`) so they are importable in main-process, preload, and renderer code.
7. All four new types SHALL be usable in main-process, preload, and renderer code without requiring `any` casts or type assertions.

---

### REQ-012: TypeScript Compliance

**User Story:** As a developer, I want all new and modified files to pass `tsc --noEmit` with zero errors so that the build pipeline stays clean.

#### Acceptance Criteria

1. THE two new methods on `ClientInterface` (`searchFiles`, `findInFiles`) SHALL have fully typed signatures using types exported from `@arlo-doc/shared`, with no `unknown` parameters or `any` return types; the `ipc.ts` binding SHALL satisfy `ClientInterface` for all its members (including both new methods) without `@ts-ignore` or `@ts-expect-error` suppressions.
2. THE `SearchModal` component SHALL be typed with a props interface that references `FileNode` from `@arlo-doc/shared` directly — not a locally redeclared equivalent.
3. THE `RipgrepRunner` module SHALL have no `any` casts; raw `rg --json` output SHALL be parsed and validated with user-defined type guard functions (returning `value is T` predicates) before being mapped to `ContentMatch[]`.
4. THE `WorktreeTabState` interface SHALL declare `scrollToLine` as a required `number | null` field, and all existing call sites that construct or spread `WorktreeTabState` objects SHALL be updated so that `electron-vite typecheck` reports zero new errors for those files.
5. THE App SHALL produce zero TypeScript errors when `electron-vite typecheck` is run against `apps/desktop` across all three compilation targets: main, preload, and renderer.

---

## Correctness Properties

### CP-001: File Name Search Idempotence (REQ-003)

For any fixed `query`, `fileTree`, and `SearchOptions`, calling the `FileNameMatcher` twice in succession SHALL return arrays that are equal element-by-element (same paths, same order). The search is a pure function of its inputs.

*Property class: idempotence / determinism.*
*Testing approach: property-based test — generate random query strings and random `FileNode` trees; assert `matcher(q, tree, opts)` deep-equals `matcher(q, tree, opts)` for the same inputs.*

---

### CP-002: File Name Search Result Limit (REQ-003.3)

For any `query`, `fileTree`, and `SearchOptions`, the `FileNameMatcher` SHALL return an array of length at most 50.

*Property class: invariant (upper bound).*
*Testing approach: property-based test — generate file trees of arbitrary size (up to 200 leaf nodes) and arbitrary queries; assert `results.length <= 50` for all inputs.*

---

### CP-003: Find in Files Result Limit (REQ-004.6)

For any `rg` output parsed by `RipgrepRunner`, the resulting `ContentMatch[]` array SHALL contain at most 20 entries, and the sum of `lines.filter(l => l.isMatch).length` across all entries SHALL be at most 100.

*Property class: invariant (upper bound).*
*Testing approach: property-based test — generate mock `rg --json` output with arbitrary numbers of files and match lines; assert both bounds hold after parsing.*

---

### CP-004: ContentMatchLine Line Number Monotonicity (REQ-004)

For any `ContentMatch` produced by `RipgrepRunner`, the `lineNumber` values in `lines` SHALL be strictly monotonically increasing (each entry's `lineNumber` is greater than the previous entry's `lineNumber`).

*Property class: invariant (ordering).*
*Testing approach: property-based test — generate mock `rg --json` output with varying context and match lines; assert `lines[i].lineNumber < lines[i+1].lineNumber` for all consecutive pairs.*

---

### CP-005: Ripgrep JSON Round-Trip (REQ-004, REQ-005)

For any `ContentMatch[]` produced by parsing `rg --json` output, re-serialising each entry's `lines` back to a flat `{lineNumber, text}[]` and sorting by `lineNumber` SHALL produce a list whose `text` values are equal to the lines in the original `rg` output for the same file.

*Property class: round-trip (parse → re-derive → original content).*
*Testing approach: integration test — run `rg --json` against a known fixture directory; parse with `RipgrepRunner`; compare the reconstructed line texts to the actual file content read via `fs.readFile`.*

---

### CP-006: IPC KbResult Contract (REQ-006)

For every thrown exception inside `arlo-doc:searchFiles` and `arlo-doc:findInFiles`, the IPC response received by the renderer SHALL deserialise to `{ ok: false, error: { code: string, message: string } }` — never an unhandled rejection or a bare string error.

*Property class: error-condition invariant.*
*Testing approach: unit test each handler with injected errors (binary not found, rg timeout, non-zero exit); assert the returned `KbResult` always has `ok: false` and a populated `error` object with a valid `KbErrorCode`.*

---

### CP-007: Search Options Toggling Idempotence (REQ-007)

Toggling `caseSensitive` twice (on then off) and then executing the same query SHALL produce results identical to executing the query with the original `caseSensitive: false` state.

*Property class: idempotence (toggle → toggle = identity).*
*Testing approach: property-based test — generate queries and file name lists; assert `match(q, files, {caseSensitive: false})` deep-equals `match(q, files, {caseSensitive: true, ...then false again})`.*
