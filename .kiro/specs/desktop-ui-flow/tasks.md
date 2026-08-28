# Implementation Plan: desktop-ui-flow

## Overview

Wire the Arlo desktop app's static artboard screens into a fully interactive single-page application. Tasks 1–3 are already complete. Tasks 4–11 are the implementation work. Tasks 12–13 are verification.

## Tasks

- [x] 1. `types.ts` — AppState, ViewMode, DraftStatus, ModalKind types
  - Already complete. No changes needed.
  - _Requirements: REQ-010_

- [x] 2. `App.tsx` — Lift all state, wire all handlers, conditional render Onboarding vs MainLayout
  - Already complete. No changes needed.
  - _Requirements: REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006_

- [x] 3. `screens/MainLayout.tsx` — Receives AppState + callbacks, renders TitleBar/Toolbar/Sidebar/content/modals
  - Already complete. No changes needed.
  - _Requirements: REQ-001, REQ-007, REQ-008, REQ-009_

- [x] 4. Update `screens/Onboarding.tsx` — Add `onChooseLocal` and `onChooseGitHub` props
  - [x] 4.1 Add `OnboardingProps` interface with `onChooseLocal: () => void` and `onChooseGitHub: () => void`
    - Update function signature to accept these props
    - Add `onClick?: () => void` to the `OnboardingCard` inner component's props
    - Wire `onChooseLocal` to the left card's button and `onChooseGitHub` to the right card's button
    - _Requirements: REQ-002.2, REQ-002.3, REQ-002.4, REQ-010.2_

- [x] 5. Update `components/Sidebar.tsx` — Add expandedNotebooks/onNoteClick/onNotebookToggle props + hover state
  - [x] 5.1 Replace hardcoded `isExpanded` with prop-driven `expandedNotebooks` array and add callbacks
    - Add `expandedNotebooks: string[]`, `onNoteClick: (noteId: string) => void`, and `onNotebookToggle: (notebookId: string) => void` to `SidebarProps`
    - Remove `isExpanded?: boolean` from the `NotebookItem` interface and remove it from each entry in `NOTEBOOKS`
    - Replace `nb.isExpanded` checks with `expandedNotebooks.includes(nb.id)`
    - Add `onClick={() => onNotebookToggle(nb.id)}` to notebook rows
    - Add `onClick={() => onNoteClick(note.id)}` to note rows
    - Add `useState<string | null>(null)` for `hoveredId` and set `onMouseEnter`/`onMouseLeave` on note rows
    - Apply `background: rgba(88,86,214,.04)` to hovered non-active rows
    - _Requirements: REQ-003.1, REQ-003.2, REQ-003.3, REQ-003.4, REQ-003.5, REQ-003.6, REQ-003.7, REQ-010.3_

- [x] 6. Create `components/DocumentView.tsx` — Note content renderer driven by `activeNoteId`
  - [x] 6.1 Create the component file and implement `activeNoteId`-based content routing
    - Import `React` from `'react'`
    - Define `interface DocumentViewProps { activeNoteId: string; }`
    - When `activeNoteId === 'deploy-rollback'`: render H1 "Deploy rollback", H2 "Prerequisites", and a `<pre>` code block with a deploy command sequence
    - All other values: render the Payments service runbook layout extracted from `screens/Reading.tsx` — frontmatter tag pills, H1, intro paragraph, Escalation path table (3 rows: L1/L2/L3), Failure modes heading and outro paragraph
    - Outer wrapper: `flex: 1`, `overflowY: 'auto'`, `background: '#fff'`, flex-center column; inner content: `maxWidth: 720`, `padding: '48px 40px'`
    - _Requirements: REQ-007.1, REQ-007.2, REQ-007.3, REQ-010.4_

- [x] 7. Create `components/MarkdownEditor.tsx` — Monospace markdown editor with outline panel
  - [x] 7.1 Extract the editor and outline panel from `screens/Editing.tsx`
    - Import `React` from `'react'`
    - Copy `OUTLINE_ITEMS`, `MARKDOWN_LINES` data arrays verbatim from `Editing.tsx`
    - Copy the `MarkdownLine` and `Cursor` sub-components verbatim
    - Compute `cursorLineIndex` as the index of the line whose `content` includes `'Idempotency-key missing'`
    - Left panel: `flex: 1`, `overflowY: 'auto'`, `padding: '36px 40px'`; renders `MARKDOWN_LINES.map((line, i) => <MarkdownLine key={i} line={line} isCursorLine={i === cursorLineIndex} />)` inside a `maxWidth: 680` container
    - Right panel: `width: 186`, `borderLeft: '1px solid rgba(0,0,0,.06)'`, `background: '#fafafa'`, `padding: '16px 12px'`; renders "Outline" label + `OUTLINE_ITEMS`
    - Outer wrapper: `flex: 1`, `display: 'flex'`
    - Export as `export function MarkdownEditor()`
    - _Requirements: REQ-008.1, REQ-008.2, REQ-008.3, REQ-008.4, REQ-010.4_

- [x] 8. Create `components/DiffView.tsx` — Two-column side-by-side diff
  - [x] 8.1 Extract the diff layout from `screens/WhatChanged.tsx`
    - Import `React` and `{ RotateCcw }` from `'lucide-react'`
    - Copy `DiffRow` interface, `DIFF_ROWS` data array, and `DiffColumn` sub-component verbatim from `WhatChanged.tsx`
    - Render header bar (44px): note name, `(M)` badge, `+18`/`-2` stats, draft name, total `+32`/`-3` stats
    - Render column headers bar (30px): "Live" and "This draft" over `background: #f8f8fc`
    - Render two-column diff: `flex: 1, display: 'flex'`; left column `borderRight: '1px solid rgba(0,0,0,.06)'`; right column has `showUndoButton={true}`
    - Outer wrapper: `flex: 1`, `display: 'flex'`, `flexDirection: 'column'`
    - Export as `export function DiffView()`
    - _Requirements: REQ-009.1, REQ-009.2, REQ-009.3, REQ-009.4, REQ-010.4_

- [x] 9. Create `components/ChatPanel.tsx` — Interactive AI chat panel (merges Agent + Approval states)
  - [x] 9.1 Scaffold the component with full props interface and layout skeleton
    - Import `React, { useState }` and `{ X, ArrowUp, ChevronRight, FileText, Check }` from `lucide-react`
    - Import `DraftStatus` type from `'../types'`
    - Define `ChatPanelProps` interface with all 7 props
    - Add `const [inputValue, setInputValue] = useState('')`
    - Render panel shell: `width: 380`, left border, rounded left corners, left shadow, flex column
    - _Requirements: REQ-004_
  - [x] 9.2 Implement header with dynamic status badge and close button
    - Render "Arlo" title on left
    - Render status badge: blue pill "working" when `draftStatus === 'working'`; amber pill "needs your approval" when `draftStatus === 'needs-approval'`
    - Render X button with `onClick={onClose}`
    - _Requirements: REQ-004.3, REQ-004.4_
  - [x] 9.3 Implement messages area with user bubble, tool call cards, response text, and conditional content
    - Copy `ToolCallCard` and `Cursor` sub-components from `screens/Agent.tsx`
    - Render user message bubble and two `ToolCallCard` entries
    - Render Arlo response text; append `<Cursor />` when `draftStatus === 'working'`
    - When `draftStatus === 'needs-approval'`: render inline `ApprovalCard` below response text
    - Copy `DIFF_LINES` and `DiffLine` sub-components from `screens/Approval.tsx` for use in `ApprovalCard`
    - Implement `ApprovalCard` sub-component: header with "Arlo wants to edit this note" + file pill, diff preview, Decline/Approve buttons (`onDecline`/`onApprove`), "Always allow · this draft only" text
    - When `lastApprovalResult === 'approved'`: render "Change approved and applied." in success green (`#1f9d6b`)
    - When `lastApprovalResult === 'declined'`: render "Change declined." in danger red (`#d1435b`)
    - _Requirements: REQ-004.3, REQ-004.4, REQ-004.7, REQ-004.8, REQ-004.9, REQ-004.10_
  - [x] 9.4 Implement footer with draft pill, controlled textarea, and send button
    - Render draft dot (blue for `working`, orange for `needs-approval`) + "Draft: {draftName}" label
    - Render `<textarea>` with `value={inputValue}` and `onChange={e => setInputValue(e.target.value)}`; placeholder "Ask Arlo…"
    - Render send button (ArrowUp icon): `background: '#5856D6'` active when `inputValue.trim() !== ''`, `background: '#f0f0f8'` inactive otherwise
    - On send click (when active): `setInputValue('')` then `setTimeout(() => onNeedsApproval(), 1500)`
    - _Requirements: REQ-004.5, REQ-004.6_

- [x] 10. Create `components/SearchModal.tsx` — Full-screen search overlay with result navigation
  - [x] 10.1 Implement the overlay, modal card, and backdrop dismiss
    - Import `React` and `{ Search as SearchIcon }` from `'lucide-react'`
    - Define `interface SearchModalProps { onClose: (noteId?: string) => void; }`
    - Outer wrapper: `position: 'absolute'`, `inset: 0`
    - Backdrop div: full inset, `background: 'rgba(26,26,46,.28)'`, `onClick={() => onClose()}`
    - Modal card: `position: 'absolute'`, `top: 96`, centered via `left: '50%' / transform: translateX(-50%)`, `width: 720`, white bg, `borderRadius: 12`, shadow; `onClick={e => e.stopPropagation()}`
    - _Requirements: REQ-005.4, REQ-005.6_
  - [x] 10.2 Implement modal card contents with result click and Esc dismiss handlers
    - Copy `RESULTS`, `FILTER_PILLS`, `HighlightedExcerpt`, `badgeStyle` from `screens/Search.tsx`
    - Render input row with SearchIcon, static text "idempotency key retry" + `<Cursor />`, and Esc badge with `onClick={() => onClose()}`
    - Render filter pills row
    - Render results list: each row `onClick={() => onClose(NOTE_IDS[result.id])}` where `NOTE_IDS = { r1: 'payments', r2: 'adr-014', r3: 'api-ref', r4: 'inc-2291', r5: 'on-call' }`
    - Render footer with count and progress indicator
    - _Requirements: REQ-005.1, REQ-005.3, REQ-005.5_

- [x] 11. Create `components/PublishModal.tsx` — Full-screen publish form overlay
  - [x] 11.1 Implement the overlay, modal card structure, and action button callbacks
    - Import `React` and `{ Check }` from `'lucide-react'`
    - Define `interface PublishModalProps { onPublish: () => void; onCancel: () => void; }`
    - Same overlay pattern as `SearchModal`: backdrop `onClick={() => onCancel()}`, modal card with `onClick={e => e.stopPropagation()}`; `width: 620`, `top: 110`
    - Copy `FILES_CHANGED`, `SUMMARY_POINTS`, and `FieldGroup` sub-component from `screens/Publish.tsx`
    - Render modal header "Publish for review", body (Title field, Summary bullets, 4 changed files, Reviewers row, AI attribution checkbox), and footer
    - Footer: "Save and finish later" button → `onCancel()`; "Publish for review" button → `onPublish()`
    - _Requirements: REQ-006.2, REQ-006.3, REQ-006.4, REQ-006.5, REQ-010.4_

- [x] 12. Verify TypeScript compilation
  - Run `tsc --noEmit` in `apps/desktop` and confirm zero errors.
  - All 6 missing-module errors and 2 prop-mismatch errors from the issue must be gone.
  - _Requirements: REQ-010.1, REQ-010.2, REQ-010.3, REQ-010.4, REQ-010.5_

- [x] 13. Verify production build
  - Run `pnpm --filter @arlo-doc/desktop build` and confirm a clean exit with no errors or warnings.
  - _Requirements: REQ-010.1_

## Notes

- Tasks 1–3 are pre-completed and marked `[x]`. Do not re-implement them.
- All new component files must match the import paths used in `MainLayout.tsx` exactly (e.g., `../components/DocumentView`).
- Data arrays (`MARKDOWN_LINES`, `DIFF_ROWS`, `RESULTS`, etc.) should be extracted verbatim from the orphaned screen files — do not rewrite the data.
- The orphaned screens (`Reading.tsx`, `Editing.tsx`, `WhatChanged.tsx`, `Agent.tsx`, `Approval.tsx`, `Search.tsx`, `Publish.tsx`) remain in `screens/` and must not be deleted, since `Search.tsx` and `Publish.tsx` render `<Reading />` as a backdrop.
- Sub-tasks marked with `*` are optional and can be skipped for a faster MVP.
- Design tokens (colors, fonts, dimensions) are documented in `design.md` §7 and must be applied consistently.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["4.1", "5.1"] },
    { "id": 1, "tasks": ["6.1", "7.1", "8.1"] },
    { "id": 2, "tasks": ["9.1"] },
    { "id": 3, "tasks": ["9.2", "9.3", "9.4", "10.1"] },
    { "id": 4, "tasks": ["10.2", "11.1"] }
  ]
}
```
