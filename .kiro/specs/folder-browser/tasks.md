# Implementation Plan: folder-browser

## Overview

Implements the full local knowledge-base flow: native OS folder picker → recursive file tree build → left-sidebar `FileBrowser` panel with SVG file-type icons → file content display → persistence across restarts.

The work is organised in eight waves that mirror the monorepo's compilation dependency order (shared types → client bridge → main process → renderer types → renderer components → wiring → verification).

---

## Tasks

- [x] 1. Export `FileNode` interface and `EXCLUDED_NAMES` from `@arlo-doc/shared`
  - [x] 1.1 Create `packages/shared/src/filesystem.ts` with the `FileNode` interface (`name`, `path`, `kind`, `children`, `skippedPaths`) and the `EXCLUDED_NAMES` readonly string array (`node_modules`, `dist`, `out`, `.git`, `.turbo`)
    - Use `as const` on `EXCLUDED_NAMES` so TypeScript narrows it to a readonly tuple
    - `skippedPaths` is required on every node (empty array for non-root nodes)
    - _Requirements: REQ-003.1, REQ-008.1_
  - [x] 1.2 Add `export * from './filesystem.js'` to `packages/shared/src/index.ts`
    - Keep the existing exports untouched; add the new line at the end
    - _Requirements: REQ-003.1, REQ-008.1_

- [x] 2. Extend `ClientInterface` and IPC binding with four folder methods
  - [x] 2.1 Add `chooseFolder`, `readFolder`, `getLastFolder`, and `readFile` to the `ClientInterface` in `packages/client/src/types.ts`
    - Import `FileNode` from `@arlo-doc/shared`; no `any`, no `@ts-ignore`
    - `chooseFolder(): Promise<KbResult<string | null>>`
    - `readFolder(folderPath: string): Promise<KbResult<FileNode>>`
    - `getLastFolder(): Promise<KbResult<string | null>>`
    - `readFile(filePath: string): Promise<KbResult<string>>`
    - _Requirements: REQ-002.1, REQ-002.2, REQ-002.3, REQ-002.4, REQ-008.2_
  - [x] 2.2 Implement the four bindings in `packages/client/src/ipc.ts` using the existing `makeInvoke` helper
    - Map to channels `arlo-doc:chooseFolder`, `arlo-doc:readFolder`, `arlo-doc:getLastFolder`, `arlo-doc:readFile`
    - `chooseFolder` binding uses `invoke<string | null>('arlo-doc:chooseFolder')` — a `null` return is `{ ok: true, data: null }`, not an error
    - No custom error handling needed in the binding layer; `makeInvoke` already wraps exceptions into `KbResult`
    - _Requirements: REQ-002.5, REQ-008.2_

- [x] 3. Implement `FolderReader` in the main process
  - [x] 3.1 Create `apps/desktop/src/main/folderReader.ts` with the `readFolder(folderPath: string): Promise<FileNode>` export
    - Use `fs/promises.readdir` with `{ withFileTypes: true }`; recurse via `readDirInto` helper
    - Skip entries whose `name.startsWith('.')` (HiddenFilter)
    - Skip directory entries whose name is in `EXCLUDED_NAMES` without descending into them
    - Cap recursion at `MAX_DEPTH = 10`; nodes at depth 10 keep `children: []` without reading further
    - Sort each directory's children: all `kind: 'dir'` entries first (case-insensitive alpha), then all `kind: 'file'` entries (case-insensitive alpha)
    - On `EACCES`/`EPERM` for an individual entry: skip the entry and append its absolute path to the root's `skippedPaths`; continue processing siblings
    - On `ENOENT`/`EACCES`/`EPERM` on the root `folderPath`: throw — the IPC handler will map these to `NOT_FOUND` / `PERMISSION_DENIED`
    - _Requirements: REQ-003.1, REQ-003.2, REQ-003.3, REQ-003.4, REQ-003.5, REQ-003.6, REQ-003.7, REQ-003.8_
  - [x] 3.2 Write property test for HiddenFilter and EXCLUDED_NAMES exclusion (Property 3)
    - **Property 3: HiddenFilter exclusion invariant** — for any `FileNode` tree produced by `FolderReader`, no node anywhere in the tree SHALL have a `name` starting with `.` or equal to an `EXCLUDED_NAMES` member
    - Use `fast-check` to generate arbitrary directory trees (names including dot-prefixed and EXCLUDED_NAMES entries); write to a temp dir, run `readFolder`, traverse all nodes
    - **Validates: Requirements REQ-003.2, REQ-003.3**
  - [x] 3.3 Write property test for tree sort invariant (Property 4)
    - **Property 4: Tree sort invariant** — for any `FileNode` of `kind: 'dir'`, its `children` satisfy dirs-before-files and case-insensitive alpha order within each group
    - **Validates: Requirements REQ-003.4**
  - [x] 3.4 Write property test for max-depth bound (Property 5)
    - **Property 5: Max-depth bound** — no node in any tree produced by `FolderReader` is reachable at depth > 10 (root = depth 0)
    - Generate deeply nested structures (depth > 10); assert no node path has more than 10 segments below the root
    - **Validates: Requirements REQ-003.5**
  - [x] 3.5 Write property test for folder read determinism (CP-001)
    - **CP-001: FileTree round-trip stability** — reading the same folder twice in rapid succession produces identical `FileNode` trees (deep equality)
    - **Validates: Requirements REQ-003**

- [x] 4. Implement `PersistenceStore` in the main process
  - [x] 4.1 Create `apps/desktop/src/main/persistenceStore.ts` with `getLastFolder(): Promise<string | null>` and `saveLastFolder(folderPath: string | null): Promise<void>`
    - State file path: `join(app.getPath('userData'), 'kiro-state.json')`
    - `getLastFolder`: read file → `JSON.parse` → return `parsed.lastFolderPath ?? null`; return `null` on any error (missing file, invalid JSON, etc.) without throwing
    - `saveLastFolder`: merge with existing state object, write to a `.tmp` sibling, then `fs.rename` to the final path (atomic); on any write error log to `console.error` and attempt cleanup of the `.tmp` file — never throw
    - _Requirements: REQ-007.1, REQ-007.2, REQ-007.6_
  - [x] 4.2 Write property test for persistence round-trip (Property 11 / CP-005)
    - **Property 11: Persistence round-trip** — for any absolute path string `p`, `saveLastFolder(p)` followed by `getLastFolder()` returns `p` unchanged
    - Use `fast-check` with `fc.string({ minLength: 1 })` prefixed with `/` to form valid-ish paths; write to a temp directory
    - **Validates: Requirements REQ-007.1, REQ-007.2**

- [x] 5. Register four IPC handlers in the main process
  - [x] 5.1 Add the `arlo-doc:chooseFolder` handler in `apps/desktop/src/main/index.ts`
    - Use `dialog.showOpenDialog` with `properties: ['openDirectory']`; attach the dialog to the sender's `BrowserWindow`
    - Return `null` (not throw) when `result.canceled` or `result.filePaths` is empty — this maps to `{ ok: true, data: null }` in the renderer
    - _Requirements: REQ-001.1, REQ-002.6, REQ-002.8_
  - [x] 5.2 Add the `arlo-doc:readFolder` handler in `apps/desktop/src/main/index.ts`
    - Call `readFolder(folderPath)` from `folderReader.ts`; on success call `saveLastFolder(folderPath)` fire-and-forget (do not await before returning)
    - Map `ENOENT` → `NOT_FOUND`, `EACCES`/`EPERM` → `PERMISSION_DENIED` via a `nodeErrCode` helper; attach to `.kbError` before rethrowing
    - _Requirements: REQ-002.6, REQ-002.8, REQ-003.7, REQ-003.8, REQ-007.1_
  - [x] 5.3 Add the `arlo-doc:getLastFolder` handler in `apps/desktop/src/main/index.ts`
    - Delegate to `getLastFolder()` from `persistenceStore.ts`; wrap in `try/catch` with `wrapError` as a safety net
    - _Requirements: REQ-002.6, REQ-007.2_
  - [x] 5.4 Add the `arlo-doc:readFile` handler in `apps/desktop/src/main/index.ts`
    - Use `fs.readFile(filePath, 'utf-8')`; apply the same `nodeErrCode` mapping as the `readFolder` handler
    - _Requirements: REQ-002.6, REQ-002.8, REQ-006.1_
  - [x] 5.5 Write unit tests for IPC KbResult contract (CP-006 / REQ-002.8)
    - **CP-006: IPC KbResult contract** — every handler, when its underlying operation throws, must produce a response deserialising to `{ ok: false, error: { code: string, message: string } }` — never an unhandled rejection
    - Test each handler stub with injected `ENOENT`, `EACCES`, and unexpected errors; assert `invoke` wrapper always yields a `KbResult` with `ok: false` and a populated `error`
    - **Validates: Requirements REQ-002.8**

- [x] 6. Checkpoint — Verify shared, client, and main process layers
  - Ensure all tests written so far pass, run `electron-vite typecheck` (main and preload targets only at this stage), and ask the user if anything is unclear before proceeding to renderer work.

- [x] 7. Extend `AppState` with folder-browser fields
  - [x] 7.1 Update `apps/desktop/src/renderer/src/types.ts`
    - Import `FileNode` from `@arlo-doc/shared`
    - Add six new fields to `AppState`: `folderPath: string | null`, `fileTree: FileNode | null`, `activeFilePath: string | null`, `fileContent: string | null`, `fileLoading: boolean`, `expandedPaths: string[]`
    - _Requirements: REQ-006.7, REQ-008.4_

- [x] 8. Implement the `FileTypeIcon` renderer component
  - [x] 8.1 Create `apps/desktop/src/renderer/src/components/FileTypeIcon.tsx`
    - Accept `fileName: string` prop; derive extension via `lastIndexOf('.')` — if dot is absent or is at index 0 (e.g. `.gitignore`), return `generic`
    - Use case-insensitive matching (`toLowerCase()`) before looking up the icon group
    - Render a 14×14 px inline SVG with `xmlns`, `width="14"`, `height="14"`, `viewBox="0 0 14 14"`, and a `data-icon` attribute set to the group name
    - Implement all 9 icon groups using the exact SVG path data from the design document: `markdown`, `typescript`, `javascript`, `json`, `yaml`, `image`, `shell`, `text`, `generic`
    - `typescript` and `javascript` icons use a filled colored `<rect>` background; all others use stroke-only paths
    - _Requirements: REQ-005.1, REQ-005.2, REQ-005.3, REQ-005.6_
  - [x] 8.2 Write property test for `FileTypeIcon` totality (Property 8 / CP-004)
    - **Property 8: FileTypeIcon totality** — for any `fileName` string, `FileTypeIcon` renders an SVG element with a non-empty `data-icon` attribute; never returns `null`, `undefined`, or an element without `data-icon`
    - Use `fast-check` with `fc.string()` for arbitrary filenames
    - **Validates: Requirements REQ-005.1, REQ-005.2, REQ-005.3**
  - [x] 8.3 Write property test for `FileTypeIcon` case-insensitivity (Property 9)
    - **Property 9: FileTypeIcon case-insensitivity** — for any known extension, changing the case of extension characters produces the same `data-icon` value (e.g. `.MD`, `.md`, `.Md` all produce `data-icon="markdown"`)
    - Use `fc.constantFrom(...knownExtensions)` with randomised casing via `fc.string` or manual mutation
    - **Validates: Requirements REQ-005.2**

- [x] 9. Implement the `FileBrowser` renderer component
  - [x] 9.1 Create `apps/desktop/src/renderer/src/components/FileBrowser.tsx`
    - Accept props: `fileTree: FileNode`, `expandedPaths: string[]`, `activeFilePath: string | null`, `onFileClick: (path: string) => void`, `onDirectoryToggle: (path: string) => void`, `isLoading?: boolean`
    - Implement the `flattenVisible` helper that pre-computes `{ node: FileNode, depth: number }[]` from the tree and the current `expandedPaths`; only root children and expanded directory children (recursive) appear
    - Render the folder's basename as a header (uppercase, 11px, muted) above a scrollable tree body
    - Implement `TreeRow` as a sub-component; each row is 26px tall with `paddingLeft: 8 + depth * 12` px
    - Directory rows: `ChevronDown` (expanded) or `ChevronRight` (collapsed) icon at 12px — no `FileTypeIcon`
    - File rows: `FileTypeIcon` at 14px to the left of the filename
    - Active row style: `background: rgba(88,86,214,.08)`, `color: #5856D6`, `fontWeight: 500`
    - Hover style (non-active): `background: rgba(88,86,214,.04)`, tracked via `useState<string | null>(null)` for hovered path
    - Loading state: `pointerEvents: 'none'`, `opacity: 0.6` on each row when `isLoading` is true
    - _Requirements: REQ-004.1, REQ-004.2, REQ-004.3, REQ-004.4, REQ-004.5, REQ-004.6, REQ-004.7, REQ-004.8, REQ-004.9, REQ-004.10, REQ-005.4, REQ-005.5, REQ-006.2, REQ-006.6_
  - [x] 9.2 Write property test for `FileBrowser` expansion visibility (Property 7)
    - **Property 7: FileBrowser expansion visibility** — for any `FileNode` tree and any set of `expandedPaths`, the visible rows rendered are exactly: all root children, plus all children of every expanded directory node (recursively); no extra or missing rows
    - Use `fast-check` to generate arbitrary `FileNode` trees and arbitrary `expandedPaths` subsets; assert the rendered row count and paths match `flattenVisible` output
    - **Validates: Requirements REQ-004.3, REQ-004.4, REQ-004.5**

- [x] 10. Extend `DocumentView` to render real file content
  - [x] 10.1 Update `apps/desktop/src/renderer/src/components/DocumentView.tsx`
    - Add optional props `fileContent?: string | null` and `activeFilePath?: string | null`
    - Add `isMarkdownPath(filePath: string): boolean` helper — returns true when path ends with `.md` or `.mdx` (case-insensitive)
    - When `fileContent` and `activeFilePath` are both non-null: if markdown, render in a centred prose block (`maxWidth: 720`, `<pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)' }}`); otherwise render in a full-width `<pre>` with `fontFamily: 'var(--font-mono)'` and `overflowX: 'auto'`
    - When either prop is null, fall through to the existing demo-note rendering so demo mode is unaffected
    - _Requirements: REQ-006.3, REQ-006.4_

- [x] 11. Update `Onboarding` to support pending and error states
  - [x] 11.1 Update `apps/desktop/src/renderer/src/screens/Onboarding.tsx`
    - Add `isPending?: boolean` and `error?: string | null` to `OnboardingProps`
    - When `isPending` is true: set button label to `"Opening…"`, `disabled={true}`, `opacity: 0.6`, `cursor: 'not-allowed'` on the "Personal knowledge base" card button
    - When `error` is non-null: render a paragraph below both cards in `color: '#c0392b'`, `fontSize: 12.5`
    - The button SHALL re-enable (normal style, original label) when `isPending` returns to false
    - _Requirements: REQ-001.4, REQ-001.5_

- [x] 12. Add `FileBrowser` slot and `LoadingView` to `MainLayout`
  - [x] 12.1 Update `apps/desktop/src/renderer/src/screens/MainLayout.tsx`
    - Add `onFileClick: (path: string) => void` and `onDirectoryToggle: (path: string) => void` to `MainLayoutProps`
    - In the sidebar slot: when `state.fileTree` is non-null render `FileBrowser` (passing `fileTree`, `expandedPaths`, `activeFilePath`, `onFileClick`, `onDirectoryToggle`, `isLoading: state.fileLoading`); otherwise render the existing `Sidebar`
    - In the content slot: when `state.fileLoading` is true render `LoadingView`; when `state.fileContent != null && state.activeFilePath != null` render `DocumentView` with the real-file props; otherwise render `DocumentView` in demo mode
    - Add the `LoadingView` inline component: centred flex container with a single `"Loading…"` span in `color: '#8e8eaa'`, `fontSize: 13`
    - _Requirements: REQ-004.1, REQ-006.1, REQ-006.2_

- [x] 13. Wire all folder state and callbacks in `App.tsx`
  - [x] 13.1 Add `onboarded`, `choosePending`, and `chooseError` state; add initial values for new `AppState` fields
    - Initialise `INITIAL_STATE` additions: `folderPath: null`, `fileTree: null`, `activeFilePath: null`, `fileContent: null`, `fileLoading: false`, `expandedPaths: []`
    - `choosePending` and `chooseError` are local `useState` (not part of `AppState`)
    - _Requirements: REQ-008.4_
  - [x] 13.2 Add `useEffect` mount hook for auto-onboard from persistence
    - On mount (when `onboarded` is false): call `getLastFolder()`; if result is a non-null path, call `readFolder(path)` and on success set `folderPath`, `fileTree`, and `onboarded = true`; if `readFolder` returns `NOT_FOUND`, remain on `Onboarding` (persisted path will be overwritten on next successful selection)
    - _Requirements: REQ-007.3, REQ-007.4, REQ-007.5_
  - [x] 13.3 Implement `handleChooseFolder` callback
    - Set `choosePending = true`, `chooseError = null`; call `chooseFolder()`; if cancelled (`data === null`) return without state changes; on success call `readFolder(chosen path)`, on success set `folderPath`, `fileTree`, `onboarded = true`; on any `ok: false` result set `chooseError` to the error message; always set `choosePending = false` in a `finally` block
    - _Requirements: REQ-001.1, REQ-001.2, REQ-001.3, REQ-001.4, REQ-001.5_
  - [x] 13.4 Implement `handleFileClick` and `handleDirectoryToggle` callbacks
    - `handleFileClick`: set `fileLoading: true`, `activeFilePath: filePath`; call `readFile(filePath)`; on success set `fileLoading: false`, `fileContent: result.data`; on error set `fileLoading: false`, `activeFilePath: null`, `fileContent: null`
    - `handleDirectoryToggle`: toggle `dirPath` in `expandedPaths` (add if absent, remove if present) using `setState` functional update
    - _Requirements: REQ-006.1, REQ-006.2, REQ-006.5, REQ-006.7, REQ-004.3_
  - [x] 13.5 Pass new props to `Onboarding` and `MainLayout`
    - Pass `onChooseLocal={handleChooseFolder}`, `isPending={choosePending}`, `error={chooseError}` to `Onboarding`
    - Pass `onFileClick={handleFileClick}`, `onDirectoryToggle={handleDirectoryToggle}` to `MainLayout`
    - _Requirements: REQ-001.1, REQ-001.4, REQ-001.5_

- [x] 14. Final checkpoint — TypeScript compliance and production build
  - Run `electron-vite typecheck` against `apps/desktop` covering all three compilation targets (main, preload, renderer); fix any errors before proceeding.
  - Run `pnpm --filter @arlo-doc/desktop build`; confirm a clean production build with no errors.
  - Ensure all tests pass, ask the user if anything needs adjustment.
  - _Requirements: REQ-008.1, REQ-008.2, REQ-008.3, REQ-008.4, REQ-008.5_

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP — the core feature works without them.
- Each task references the specific requirements it satisfies for traceability.
- The design document contains complete SVG path data and exact style values for all components — refer to it during implementation.
- The preload script must also be updated to expose the four new `ClientInterface` methods on `window.arlodoc` via `contextBridge.exposeInMainWorld` — this is covered as part of task 2.2 (the preload delegates to `createIpcBinding` which picks up the new methods automatically once `ipc.ts` is updated).
- `fast-check` is the designated property-based testing library; no additional setup is required (TypeScript-native).
- `electron-vite typecheck` covers all three compilation targets simultaneously; run it after every wave to catch cross-layer type errors early.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1", "4.1", "7.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "3.4", "3.5", "4.2", "5.1", "5.2", "5.3", "5.4"] },
    { "id": 3, "tasks": ["5.5", "8.1"] },
    { "id": 4, "tasks": ["8.2", "8.3", "9.1"] },
    { "id": 5, "tasks": ["9.2", "10.1", "11.1", "12.1"] },
    { "id": 6, "tasks": ["13.1", "13.2", "13.3", "13.4", "13.5"] }
  ]
}
```
