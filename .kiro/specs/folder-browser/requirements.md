# Requirements Document

## Introduction

The `folder-browser` feature turns the Arlo desktop app's stub "Choose folder…" flow into a real, end-to-end local knowledge-base experience. When a user clicks "Choose folder…" in the Onboarding screen, the native operating-system folder picker opens via Electron IPC. Once a folder is selected, the app reads its contents recursively, builds an in-memory file tree, and renders that tree as a collapsible file browser panel in the left sidebar — replacing the existing hardcoded notebook list for local knowledge bases. Each tree node displays a custom SVG icon keyed to its file extension. Clicking a file node loads and displays its content in the main area. The selected folder path persists across restarts via Electron's `userData` store so the user returns to their knowledge base automatically.

This feature spans three layers of the monorepo:

- **Main process** (`apps/desktop/src/main`) — new IPC handlers for the native dialog, folder reading, and persistence.
- **Preload / client bridge** (`apps/desktop/src/preload`, `packages/client`) — new channel definitions and renderer-callable methods exposed on `window.arlodoc`.
- **Renderer** (`apps/desktop/src/renderer/src`) — updated `Onboarding`, new `FileBrowser` component, updated `AppState`, updated `App.tsx` and `MainLayout.tsx`.

---

## Glossary

- **App**: The root React component (`App.tsx`) that owns all shared state.
- **AppState**: The single state object managed in `App.tsx`; extended in this feature with `folderPath`, `fileTree`, and `activeFilePath`.
- **ClientInterface**: The TypeScript interface in `packages/client/src/types.ts` that declares every method the renderer may call via IPC.
- **Dialog**: Electron's `dialog` module used to open the native OS folder picker.
- **FileBrowser**: The new left-panel component (`components/FileBrowser.tsx`) that renders the `FileTree` as a collapsible, interactive tree.
- **FileNode**: A single entry in the file tree — either a file or a directory — represented by the `FileNode` interface.
- **FileTree**: The recursive tree data structure produced by reading a folder from disk. Root is always a `FileNode` of `kind: 'dir'`.
- **FolderReader**: The main-process module responsible for walking a directory recursively and returning a `FileNode` tree.
- **HiddenFilter**: The rule that excludes entries whose name begins with `.` or that appear in the `EXCLUDED_NAMES` constant.
- **EXCLUDED_NAMES**: The fixed set of directory names never included in the tree: `node_modules`, `dist`, `out`, `.git`, `.turbo`.
- **IPC channel**: A named `ipcMain.handle` / `ipcRenderer.invoke` pair; all channels in this app are prefixed `arlo-doc:`.
- **MainLayout**: The `screens/MainLayout.tsx` component; receives updated props to render either `FileBrowser` (local KB) or `Sidebar` (static demo).
- **Onboarding**: The initial screen; the "Choose folder…" button now triggers the native dialog instead of immediately setting `onboarded`.
- **PersistenceStore**: The main-process module that reads and writes a JSON file in `app.getPath('userData')` to remember the last opened folder path.
- **FileTypeIcon**: The renderer component that maps a file extension to an SVG icon and renders it at 14×14 px.
- **activeFilePath**: An `AppState` field holding the absolute path of the currently open file, or `null` when none is open.
- **folderPath**: An `AppState` field holding the absolute path of the currently open folder, or `null` when none is open.
- **fileTree**: An `AppState` field holding the `FileNode` root returned by the last successful folder read, or `null`.
- **expandedPaths**: An `AppState` field — a `string[]` of directory paths currently expanded in the `FileBrowser`.
- **KbResult**: The discriminated union `{ ok: true; data: T } | { ok: false; error: KbError }` used by all IPC methods.

---

## Requirements

### REQ-001: Native Folder Selection

**User Story:** As a new user, I want clicking "Choose folder…" to open the operating system's native folder picker so that I can select where my knowledge base lives without manually typing a path.

#### Acceptance Criteria

1. WHEN a user clicks the "Choose folder…" button in `Onboarding`, THE App SHALL open the operating system's native folder picker restricted to directory selection only (no files selectable).
2. WHEN the user selects a folder in the native dialog, THE App SHALL receive the selected folder path, record it as the active folder, mark the app as onboarded, and transition to `MainLayout`.
3. WHEN the user dismisses the native dialog without selecting a folder, THE App SHALL remain on the `Onboarding` screen with no state changes.
4. IF the folder selection operation fails for any reason, THEN THE App SHALL display an inline error message on the `Onboarding` screen indicating that folder selection was unsuccessful, without navigating away.
5. WHILE a folder selection operation is in progress, THE `Onboarding` component SHALL render the "Choose folder…" button in a disabled state; the button SHALL re-enable once the dialog closes for any reason (selection, cancellation, or error).

---

### REQ-002: IPC Bridge for Folder Operations

**User Story:** As a developer, I want a typed IPC bridge so that all folder-related main-process operations are callable from the renderer with the same `KbResult<T>` pattern used by the rest of the app.

#### Acceptance Criteria

1. THE `ClientInterface` in `packages/client/src/types.ts` SHALL declare a `chooseFolder()` method with return type `Promise<KbResult<string | null>>` where `data` is the chosen absolute folder path when a folder is selected, or `null` when the user cancels the dialog without selecting a folder.
2. THE `ClientInterface` SHALL declare a `readFolder(folderPath: string)` method with return type `Promise<KbResult<FileNode>>` where `FileNode` is imported from `@arlo-doc/shared`.
3. THE `ClientInterface` SHALL declare a `getLastFolder()` method with return type `Promise<KbResult<string | null>>` where `data` is the persisted folder path or `null` if none has been stored.
4. THE `ClientInterface` SHALL declare a `readFile(filePath: string)` method with return type `Promise<KbResult<string>>` where `data` is the UTF-8 text content of the file.
5. THE IPC binding in `packages/client/src/ipc.ts` SHALL implement all four methods, forwarding calls to the corresponding `arlo-doc:chooseFolder`, `arlo-doc:readFolder`, `arlo-doc:getLastFolder`, and `arlo-doc:readFile` channels; the `chooseFolder` binding SHALL map a `null` value returned by the main process to `{ ok: true, data: null }`.
6. THE main process in `apps/desktop/src/main/index.ts` SHALL register `ipcMain.handle` handlers for all four channels: `arlo-doc:chooseFolder`, `arlo-doc:readFolder`, `arlo-doc:getLastFolder`, and `arlo-doc:readFile`.
7. THE preload script SHALL expose the updated `ClientInterface` (including the four new methods) on `window.arlodoc` via `contextBridge.exposeInMainWorld`.
8. IF any of the four IPC handlers encounter a failure, THEN THE main process SHALL rethrow the error through the existing `wrapError` helper, producing a structured `KbError` with the following codes: `PERMISSION_DENIED` when the process lacks read access to the target path, `NOT_FOUND` when the target path does not exist on disk, and `UNKNOWN` for all other failures; the `arlo-doc:chooseFolder` handler SHALL return `null` (not throw) when the user cancels the dialog.

---

### REQ-003: File Tree Data Model

**User Story:** As a developer, I want a well-typed recursive file tree structure so that the renderer can render, traverse, and update the tree without re-reading the disk.

#### Acceptance Criteria

1. THE `@arlo-doc/shared` package SHALL export a `FileNode` interface with fields: `name: string`, `path: string` (absolute), `kind: 'file' | 'dir'`, `children: FileNode[]` (empty array for files, never undefined), and `skippedPaths: string[]` (present only on the root node, empty array when no errors occurred).
2. WHEN `FolderReader` encounters an entry whose name begins with `.`, THE `FolderReader` SHALL exclude that entry and all its descendants from the returned tree.
3. WHEN `FolderReader` encounters a directory whose name appears in `EXCLUDED_NAMES` (`node_modules`, `dist`, `out`, `.git`, `.turbo`), THE `FolderReader` SHALL exclude that directory and all its descendants without reading inside it.
4. THE `FolderReader` SHALL sort entries within each directory: all directories first in case-insensitive alphabetical order, then all files in case-insensitive alphabetical order.
5. THE `FolderReader` SHALL read directories to a maximum depth of 10 levels (the root folder is depth 0, its immediate children are depth 1); entries whose depth would exceed 10 SHALL be omitted — the parent directory node at depth 10 SHALL be included in the tree with an empty `children` array.
6. IF a permission error occurs while reading a directory entry, THEN THE `FolderReader` SHALL skip that entry, continue processing siblings, and append the entry's absolute path to the `skippedPaths` array on the root `FileNode`.
7. IF the `folderPath` provided to `arlo-doc:readFolder` does not exist on disk, THEN THE IPC handler SHALL return `{ ok: false, error: { code: 'NOT_FOUND', ... } }`.
8. IF the process lacks permission to read the directory at `folderPath`, THEN THE IPC handler SHALL return `{ ok: false, error: { code: 'PERMISSION_DENIED', ... } }`.

---

### REQ-004: File Browser Panel

**User Story:** As a user, I want a file browser panel in the left sidebar that shows my folder's contents as an expandable tree so that I can navigate my knowledge base by folder structure.

#### Acceptance Criteria

1. WHEN `folderPath` is non-null and `fileTree` is non-null, THE `MainLayout` SHALL render `FileBrowser` in place of the hardcoded `Sidebar` notebook list.
2. THE `FileBrowser` component SHALL render the root `FileNode`'s children as a flat list of tree rows, where each row represents either a file node (a node with no children) or a directory node (a node with a `children` array), with subdirectory children rendered as indented rows below their parent when that parent is expanded.
3. WHEN a user clicks a directory row in `FileBrowser`, THE App SHALL toggle that directory's path in `expandedPaths` — adding it if absent, removing it if present.
4. WHEN a directory path is present in `expandedPaths`, THE `FileBrowser` SHALL render that directory's children below the directory row with a left indent of 12 px per nesting level.
5. WHEN a directory path is absent from `expandedPaths`, THE `FileBrowser` SHALL hide that directory's children.
6. THE `FileBrowser` SHALL display the open folder's basename as a header at the top of the panel, followed by a scrollable tree body.
7. WHEN a directory row is hovered, THE `FileBrowser` SHALL apply `background: rgba(88,86,214,.04)` to that row regardless of whether the directory is expanded or collapsed.
8. THE `FileBrowser` component SHALL accept `fileTree: FileNode`, `expandedPaths: string[]`, `activeFilePath: string | null`, `onFileClick: (path: string) => void`, and `onDirectoryToggle: (path: string) => void` as required props.
9. WHEN a user clicks a file row in `FileBrowser`, THE App SHALL call `onFileClick` with that file node's path.
10. WHEN `activeFilePath` matches a file row's path, THE `FileBrowser` SHALL apply a distinct background color to that row to visually distinguish it from non-active rows.

---

### REQ-005: File Type SVG Icons

**User Story:** As a user, I want each file in the browser to show an icon matching its type so that I can scan the tree and identify file kinds at a glance without reading every filename.

#### Acceptance Criteria

1. THE `FileTypeIcon` component SHALL render a 14×14 px inline SVG icon identified by a `data-icon` attribute for each of the following extension groups:

   | Extension group         | `data-icon` value     |
   |-------------------------|-----------------------|
   | `.md`, `.mdx`           | `markdown`            |
   | `.ts`, `.tsx`           | `typescript`          |
   | `.js`, `.jsx`, `.mjs`   | `javascript`          |
   | `.json`                 | `json`                |
   | `.yml`, `.yaml`         | `yaml`                |
   | `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp` | `image` |
   | `.sh`, `.bash`          | `shell`               |
   | `.txt`                  | `text`                |
   | all other extensions    | `generic`             |

2. THE `FileTypeIcon` component SHALL accept a `fileName: string` prop and derive the icon from the file extension using case-insensitive matching (e.g., `.MD` and `.md` both resolve to `markdown`).
3. THE `FileTypeIcon` component SHALL render the `generic` icon for filenames with no extension and for dot-only filenames (e.g., `.gitignore` which has no extension after the leading dot when the entire name is the extension).
4. THE `FileBrowser` SHALL render a `FileTypeIcon` to the left of each file row's label text.
5. THE `FileBrowser` SHALL render a 14×14 px `ChevronRight` (when collapsed) or `ChevronDown` (when expanded) icon to the left of each directory row; directory rows SHALL NOT render a `FileTypeIcon`.
6. THE `FileTypeIcon` for each extension group in criterion 1 SHALL render an SVG element that is structurally distinct from the `generic` fallback icon (i.e., different SVG path data or shape), making the icons visually differentiable.

---

### REQ-006: Active File State and Content Display

**User Story:** As a user, I want clicking a file in the browser to open that file's content in the main area so that I can read documents stored on my local file system.

#### Acceptance Criteria

1. WHEN a user clicks a file row in `FileBrowser`, THE App SHALL set `activeFilePath` to that file's absolute path, read the file's content, and display the result in the main content area.
2. WHILE a file read is in progress, THE App SHALL render a loading indicator in the main content area and all file rows in `FileBrowser` SHALL be non-interactive (rendered in a disabled state that does not respond to click events).
3. WHEN the file content is received and the file extension is `.md` or `.mdx`, THE `DocumentView` SHALL render the file's text content as styled markdown.
4. WHEN the file content is received and the file extension is not `.md` or `.mdx`, THE `DocumentView` SHALL render the file's text content in a monospace `<pre>` block with horizontal scroll.
5. IF the file read operation fails for any reason, THEN THE App SHALL display the error message in the main content area, set `activeFilePath` to `null`, and leave `viewMode` unchanged.
6. WHEN a file row matches `activeFilePath`, THE `FileBrowser` SHALL apply a distinct active visual style to that row to differentiate it from non-active rows.
7. THE `AppState` SHALL include an `activeFilePath: string | null` field and a `fileContent: string | null` field; both SHALL be updated atomically when a file is successfully opened (both set) or when a file read fails (both set to `null`).

---

### REQ-007: Folder State Persistence

**User Story:** As a returning user, I want the app to remember which folder I had open so that I do not have to re-select my knowledge base every time I launch Arlo.

#### Acceptance Criteria

1. WHEN the user selects a folder and the app transitions to `MainLayout`, THE `PersistenceStore` SHALL write the selected folder path to `{userData}/kiro-state.json` under the key `lastFolderPath`; IF the write fails for any reason, THE App SHALL continue functioning normally and log the error without surfacing it to the user.
2. WHEN the app starts and reads `{userData}/kiro-state.json`, IF the file does not exist, the key `lastFolderPath` is absent, or the file content is not valid JSON, THEN THE `PersistenceStore` SHALL return `null` without throwing an error.
3. WHEN `App.tsx` mounts and `onboarded` is false and `getLastFolder` returns a non-null path, THE App SHALL automatically call `readFolder` with that path and, on success, set `folderPath`, `fileTree`, and `onboarded` to their respective values without showing the `Onboarding` screen.
4. WHEN `App.tsx` mounts and `onboarded` is false and `getLastFolder` returns `null`, THE App SHALL render the `Onboarding` screen.
5. IF the persisted folder path no longer exists on disk when `readFolder` is called on mount, THEN THE App SHALL clear the persisted path by writing `null` to `lastFolderPath` in `kiro-state.json` and show the `Onboarding` screen.
6. THE `PersistenceStore` SHALL ensure that a crash or power loss during a write does not leave `kiro-state.json` in a corrupt or partially written state.

---

### REQ-008: TypeScript Compliance

**User Story:** As a developer, I want all new and modified files to pass `tsc --noEmit` with zero errors so that the build pipeline stays clean.

#### Acceptance Criteria

1. THE `FileNode` interface exported from `@arlo-doc/shared` SHALL be importable in all three layers (main process, preload, renderer) without the use of `any` annotations, `as any` casts, or `as unknown as T` double-cast patterns anywhere in the new or modified files.
2. THE four new methods on `ClientInterface` SHALL have fully typed signatures with no `unknown` parameters or return types, and the `ipc.ts` binding SHALL satisfy the `ClientInterface` type without `@ts-ignore` or `@ts-expect-error` suppression comments.
3. THE `FileBrowser` component props interface SHALL use the `FileNode` type from `@arlo-doc/shared` directly, not a locally redeclared equivalent.
4. THE updated `AppState` interface SHALL include `folderPath: string | null`, `fileTree: FileNode | null`, `activeFilePath: string | null`, `fileContent: string | null`, and `expandedPaths: string[]`.
5. THE App SHALL produce zero TypeScript errors when `electron-vite typecheck` is run against `apps/desktop` (covering all three compilation targets: main, preload, and renderer).

---

## Correctness Properties

### CP-001: FileTree Round-Trip Stability (REQ-003)

For any valid folder on disk, reading the folder twice in rapid succession with `FolderReader` and diffing the two resulting `FileNode` trees SHALL produce an empty diff — the tree representation is deterministic for a given folder state.

*Property class: idempotence / determinism.*
*Testing approach: property-based test — generate a temporary directory tree with random file/folder names (excluding names starting with `.` and `EXCLUDED_NAMES`), call `FolderReader` twice, deep-equal the results.*

---

### CP-002: HiddenFilter Exclusion (REQ-003.2, REQ-003.3)

For any `FileNode` tree produced by `FolderReader`, no node anywhere in the tree SHALL have a `name` that begins with `.` or a `name` that is a member of `EXCLUDED_NAMES`.

*Property class: invariant.*
*Testing approach: property-based test — generate trees with random names including some starting with `.` and some equal to excluded names; traverse all nodes and assert none violate the filter.*

---

### CP-003: Tree Sort Invariant (REQ-003.4)

For any `FileNode` of `kind: 'dir'` in a tree produced by `FolderReader`, the `children` array SHALL satisfy: all children with `kind: 'dir'` appear before all children with `kind: 'file'`, and within each group the entries are ordered case-insensitively by `name`.

*Property class: invariant.*
*Testing approach: property-based test — generate directories with random mixtures of files and subdirectories; assert the sort predicate holds for every directory node in the tree.*

---

### CP-004: FileTypeIcon Extension Coverage (REQ-005)

For every extension listed in the REQ-005 table, `FileTypeIcon` SHALL return a non-null, non-empty SVG element that is distinct from the generic fallback icon. For any extension not in the table, `FileTypeIcon` SHALL return the generic fallback icon, not `undefined` or an empty element.

*Property class: totality / exhaustiveness.*
*Testing approach: example-based unit test covering each listed extension plus a selection of unknown extensions; snapshot or structural assertion on the rendered SVG.*

---

### CP-005: Persistence Round-Trip (REQ-007)

For any absolute folder path string `p`, writing `p` to `PersistenceStore` and then reading it back SHALL return `p` unchanged.

*Property class: round-trip (write → read → original value).*
*Testing approach: property-based test — generate random absolute path strings (e.g., `/tmp/` + alphanumeric); write each, read back, assert equality.*

---

### CP-006: IPC KbResult Contract (REQ-002)

For every new IPC handler, any exception thrown inside the handler SHALL result in an IPC response that deserialises to `{ ok: false, error: { code: string, message: string } }` in the renderer — never an unhandled rejection or a bare string.

*Property class: error-condition invariant.*
*Testing approach: unit test each handler stub with injected errors (permission denied, not found, unexpected); assert the `invoke` helper always returns a `KbResult` with `ok: false` and a populated `error` object.*
