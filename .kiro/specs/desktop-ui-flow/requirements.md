# Requirements Document

## Introduction

The desktop-ui-flow feature wires the Arlo desktop app's static artboard screens into a fully interactive Electron/React single-page application. All state is lifted into `App.tsx` and flows down through `MainLayout` to purpose-built components. The deliverable is a TypeScript-clean build with zero `tsc --noEmit` errors and complete interactivity for the flows described in the interaction spec.

## Glossary

- **App**: The root React component (`App.tsx`) that owns all shared state.
- **AppState**: The single state object managed in `App.tsx`; fields are defined in `types.ts`.
- **MainLayout**: The `screens/MainLayout.tsx` component that receives `AppState` and all callbacks and renders the full application chrome.
- **ViewMode**: One of `'read'`, `'edit'`, or `'diff'`; determines which content component is rendered in the main area.
- **Modal**: One of `'search'`, `'publish'`, or `null`; determines which overlay component is rendered.
- **DraftStatus**: One of `'working'`, `'needs-approval'`, `'draft'`, or `null`; represents the lifecycle state of the active draft.
- **hasDraft**: Derived boolean: `draftStatus !== null`.
- **ChatPanel**: The 380px-wide interactive assistant panel rendered when `showChat === true`.
- **Onboarding**: The initial screen presented before the user has selected a knowledge base.
- **Sidebar**: The 240px-wide left navigation panel listing notebooks and notes.
- **DocumentView**: The read-only document renderer controlled by `activeNoteId`.
- **MarkdownEditor**: The split-pane markdown editor shown in `viewMode === 'edit'`.
- **DiffView**: The two-column side-by-side diff shown in `viewMode === 'diff'`.
- **SearchModal**: The full-screen overlay search panel.
- **PublishModal**: The full-screen overlay publish form.

---

## Requirements

### REQ-001: Navigation and Routing

**User Story:** As a user, I want seamless navigation between reading, editing, and diff views so that I can access the right interface without losing context.

#### Acceptance Criteria

1. WHEN a user clicks the "Edit" mode button in Toolbar, THE App SHALL set `viewMode` to `'edit'` and render `MarkdownEditor` in the main content area.
2. WHEN a user clicks the "What changed" mode button in Toolbar, THE App SHALL set `viewMode` to `'diff'` and render `DiffView` in the main content area.
3. WHEN a user clicks the "Read" mode button in Toolbar, THE App SHALL set `viewMode` to `'read'` and render `DocumentView` in the main content area.
4. WHILE `hasDraft` is false, THE Toolbar SHALL disable the "What changed" and "Publish" controls.
5. WHILE `hasDraft` is true, THE Toolbar SHALL enable the "What changed" and "Publish" controls.
6. WHEN a modal is dismissed, THE App SHALL preserve the current `viewMode` unchanged.
7. THE MainLayout SHALL render exactly one content component at a time based on `viewMode`.

---

### REQ-002: Onboarding Flow

**User Story:** As a new user, I want to choose my knowledge base storage option so that I can enter the main application.

#### Acceptance Criteria

1. WHEN the app starts and `onboarded` is false, THE App SHALL render `Onboarding` instead of `MainLayout`.
2. WHEN a user clicks the "Choose folder…" button in Onboarding, THE App SHALL call `onChooseLocal` and set `onboarded` to true, transitioning to `MainLayout`.
3. WHEN a user clicks the "Continue with GitHub" button in Onboarding, THE App SHALL call `onChooseGitHub` and set `onboarded` to true, transitioning to `MainLayout`.
4. THE Onboarding component SHALL accept `onChooseLocal` and `onChooseGitHub` as required props and wire them to the respective call-to-action buttons.

---

### REQ-003: Sidebar Interactivity

**User Story:** As a user, I want to navigate notes and expand/collapse notebooks in the sidebar so that I can find and open documents quickly.

#### Acceptance Criteria

1. WHEN a user clicks a note row in the Sidebar, THE App SHALL set `activeNoteId` and `activeTabId` to the clicked note's ID and set `viewMode` to `'read'`.
2. WHEN a user clicks a notebook row in the Sidebar, THE App SHALL toggle that notebook's ID in the `expandedNotebooks` array — adding it if absent, removing it if present.
3. WHEN a notebook ID is present in `expandedNotebooks`, THE Sidebar SHALL render that notebook's note list below the notebook row.
4. WHEN a notebook ID is absent from `expandedNotebooks`, THE Sidebar SHALL hide that notebook's note list.
5. WHEN a note row is hovered and is not the active note, THE Sidebar SHALL apply a hover background of `rgba(88,86,214,.04)` to that row.
6. WHEN a note row matches `activeNoteId`, THE Sidebar SHALL render it with accent background `rgba(88,86,214,.08)` and accent text color `#5856D6`.
7. THE Sidebar component SHALL accept `expandedNotebooks`, `onNoteClick`, and `onNotebookToggle` as required props replacing the previous hardcoded `isExpanded` behavior.

---

### REQ-004: Chat Panel Lifecycle

**User Story:** As a user, I want to open the AI chat panel, send requests, and approve or decline proposed changes so that I can collaborate with Arlo on draft edits.

#### Acceptance Criteria

1. WHEN a user clicks the chat icon in Toolbar and `showChat` is false, THE App SHALL set `showChat` to true, and IF `draftStatus` is null THEN also set `draftStatus` to `'working'` and `draftName` to `'Payments runbook refresh'`.
2. WHEN a user clicks the X button in ChatPanel, THE App SHALL set `showChat` to false while preserving `draftStatus` and `draftName`.
3. WHILE `draftStatus` is `'working'`, THE ChatPanel SHALL display a blue status badge labeled "working" and a blinking cursor after the Arlo response text.
4. WHILE `draftStatus` is `'needs-approval'`, THE ChatPanel SHALL display an amber status badge labeled "needs your approval" and render the `ApprovalCard` below the Arlo response text.
5. WHEN a user types in the ChatPanel input and the trimmed value is non-empty, THE ChatPanel SHALL render the send button in an active blue state.
6. WHEN a user submits the ChatPanel input (clicks send with non-empty trimmed value), THE ChatPanel SHALL clear the input field and THE App SHALL set `draftStatus` to `'needs-approval'` after a 1500ms delay.
7. WHEN a user clicks the Approve button in `ApprovalCard`, THE App SHALL set `draftStatus` to `'working'` and `lastApprovalResult` to `'approved'`.
8. WHEN a user clicks the Decline button in `ApprovalCard`, THE App SHALL set `draftStatus` to `'working'` and `lastApprovalResult` to `'declined'`.
9. WHEN `lastApprovalResult` is `'approved'`, THE ChatPanel SHALL display "Change approved and applied." in the messages area.
10. WHEN `lastApprovalResult` is `'declined'`, THE ChatPanel SHALL display "Change declined." in the messages area.

---

### REQ-005: Search Modal

**User Story:** As a user, I want to open a search overlay, find notes by keyword, and navigate to a result so that I can locate content without leaving the current view.

#### Acceptance Criteria

1. WHEN a user clicks the ⌘K search button or the search bar in Toolbar, THE App SHALL set `modal` to `'search'`, rendering `SearchModal`.
2. WHEN a user clicks the + (new tab) button in TitleBar, THE App SHALL set `modal` to `'search'`.
3. WHEN a user clicks a result row in `SearchModal`, THE App SHALL call `onClose` with the corresponding `noteId`, which sets `modal` to null, `activeNoteId` to that `noteId`, and `viewMode` to `'read'`.
4. WHEN a user clicks the backdrop outside the `SearchModal` card, THE App SHALL set `modal` to null without changing `activeNoteId` or `viewMode`.
5. WHEN a user clicks the Esc badge in `SearchModal`, THE App SHALL set `modal` to null without changing `activeNoteId` or `viewMode`.
6. THE SearchModal overlay SHALL stop click propagation on the modal card so that backdrop clicks do not register as card clicks.

---

### REQ-006: Publish Modal

**User Story:** As a user, I want to review and submit my draft for team review so that my AI-assisted changes go through the proper approval process.

#### Acceptance Criteria

1. WHEN a user clicks the "Publish" button in Toolbar while `hasDraft` is true, THE App SHALL set `modal` to `'publish'`, rendering `PublishModal`.
2. WHEN a user clicks "Publish for review" in `PublishModal`, THE App SHALL set `modal` to null, `draftStatus` to null, `draftName` to `''`, `showChat` to false, and `viewMode` to `'read'`.
3. WHEN a user clicks "Save and finish later" in `PublishModal`, THE App SHALL set `modal` to null while preserving all other state.
4. WHEN a user clicks the backdrop in `PublishModal`, THE App SHALL set `modal` to null while preserving all other state.
5. THE PublishModal SHALL accept `onPublish` and `onCancel` as required props wired to the respective action buttons.

---

### REQ-007: Document View

**User Story:** As a user, I want the main reading area to show the correct document content for the note I have selected so that I am always reading the relevant note.

#### Acceptance Criteria

1. WHEN `viewMode` is `'read'` and `activeNoteId` is `'deploy-rollback'`, THE DocumentView SHALL render the "Deploy rollback" document with a Prerequisites section and a code block.
2. WHEN `viewMode` is `'read'` and `activeNoteId` is any value other than `'deploy-rollback'`, THE DocumentView SHALL render the "Payments service runbook" document with frontmatter tags, H1, Escalation path table, and Failure modes section.
3. THE DocumentView SHALL fill the available width with `flex: 1` and be independently scrollable.

---

### REQ-008: Markdown Editor

**User Story:** As a user, I want a monospace markdown editor with an outline panel so that I can directly edit note content while keeping my orientation in the document structure.

#### Acceptance Criteria

1. WHEN `viewMode` is `'edit'`, THE MarkdownEditor SHALL render a left-side monospace editor pane and a right-side 186px outline panel.
2. THE MarkdownEditor SHALL display syntax-highlighted markdown using the `MarkdownLine` component with heading, text, bold, blank, and code line types.
3. THE MarkdownEditor SHALL show a blinking cursor on the line whose content includes `'Idempotency-key missing'`.
4. THE MarkdownEditor SHALL fill available space with `flex: 1` and a row layout.

---

### REQ-009: Diff View

**User Story:** As a user, I want a side-by-side diff showing live vs. draft content so that I can understand what Arlo changed before approving or publishing.

#### Acceptance Criteria

1. WHEN `viewMode` is `'diff'`, THE DiffView SHALL render a header bar with the note name, change stats, draft name, and total diff stats.
2. THE DiffView SHALL render two columns labeled "Live" and "This draft" using `DiffColumn` components.
3. THE DiffView SHALL display an "Undo this change" button overlay on the first added line in the right (draft) column.
4. THE DiffView SHALL fill available space with `flex: 1` and a column layout.

---

### REQ-010: TypeScript Compliance

**User Story:** As a developer, I want the entire renderer codebase to pass `tsc --noEmit` with zero errors so that the build pipeline remains clean.

#### Acceptance Criteria

1. THE App SHALL compile with zero TypeScript errors when `tsc --noEmit` is run against `apps/desktop`.
2. THE Onboarding component SHALL declare `onChooseLocal` and `onChooseGitHub` in its props interface so that the call in `App.tsx` compiles without error.
3. THE Sidebar component SHALL declare `expandedNotebooks`, `onNoteClick`, and `onNotebookToggle` in its props interface so that the usage in `MainLayout.tsx` compiles without error.
4. THE six new components (`DocumentView`, `MarkdownEditor`, `DiffView`, `ChatPanel`, `SearchModal`, `PublishModal`) SHALL be created at their expected import paths so that the imports in `MainLayout.tsx` resolve without module-not-found errors.
5. IF orphaned screen files (`Reading`, `Editing`, `WhatChanged`, `Agent`, `Approval`, `Search`, `Publish`) are retained, THEN THE files SHALL export their named functions without internal TypeScript errors so that they do not break the compilation of any file that imports them.
