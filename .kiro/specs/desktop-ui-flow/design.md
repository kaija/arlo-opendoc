# Design: desktop-ui-flow

## 1. Overview

This spec wires the Arlo desktop app's static artboard screens into a fully interactive single-page application. All screens previously existed as isolated, non-interactive `screens/*.tsx` files. The goal is to:

1. Lift all state into `App.tsx` as a single `AppState` object
2. Route rendering through `MainLayout` using `viewMode` and `modal` fields
3. Extract reusable, prop-driven components from the orphaned screen files
4. Fix all TypeScript errors caused by missing components and missing props
5. Make the complete interaction flow from Onboarding through Publish functional

No new features are introduced — this is a wiring and refactoring task.

---

## 2. Architecture

### 2.1 AppState Shape

```typescript
interface AppState {
  viewMode: 'read' | 'edit' | 'diff';   // which content view is active
  modal: 'search' | 'publish' | null;   // overlay modal, if any
  showChat: boolean;                     // whether ChatPanel is visible
  draftStatus: 'working' | 'needs-approval' | 'draft' | null;
  draftName: string;                     // display name of the active draft
  tabs: Tab[];                           // open document/search tabs
  activeTabId: string;                   // which tab is selected
  activeNoteId: string;                  // which note DocumentView renders
  expandedNotebooks: string[];           // IDs of open notebooks in Sidebar
  lastApprovalResult: 'approved' | 'declined' | null;
}
```

`hasDraft` is a derived boolean (`draftStatus !== null`) used in MainLayout for conditional rendering.

### 2.2 Component Hierarchy

```
App
├── Onboarding           (gate: onboarded === false)
└── MainLayout           (gate: onboarded === true)
    ├── TitleBar         (tabs, activeTabId, draftStatus, draftName)
    ├── Toolbar          (viewMode, hasDraft, showChat)
    ├── Sidebar          (variant, activeNoteId, expandedNotebooks)  ← updated
    └── content row
        ├── DocumentView  (viewMode === 'read')  ← new
        ├── MarkdownEditor (viewMode === 'edit') ← new
        ├── DiffView      (viewMode === 'diff')  ← new
        └── ChatPanel     (showChat === true)    ← new
    └── modals (position: absolute, inset: 0)
        ├── SearchModal  (modal === 'search')    ← new
        └── PublishModal (modal === 'publish')   ← new
```

### 2.3 Data Flow

All state lives in `App.tsx`. `MainLayout` receives the complete `AppState` plus handler callbacks as props. No child component owns shared state — they call callbacks to request state changes. Internal UI-only state (hover, input value) lives in the component that needs it.

```
User action
  → child component calls callback prop
    → App.tsx handler calls setState
      → React re-renders MainLayout and children with new state
```

---

## 3. Screen Inventory

The 8 original artboard screens map to the new component model as follows:

| Original screen        | New model                                    | Status        |
|------------------------|----------------------------------------------|---------------|
| `screens/Onboarding`   | `screens/Onboarding` (updated, add props)    | Update        |
| `screens/Reading`      | `components/DocumentView` (extracted)         | Extract       |
| `screens/Editing`      | `components/MarkdownEditor` (extracted)       | Extract       |
| `screens/WhatChanged`  | `components/DiffView` (extracted)             | Extract       |
| `screens/Agent`        | `components/ChatPanel` — working state        | Extract+wire  |
| `screens/Approval`     | `components/ChatPanel` — needs-approval state | Merge into ^  |
| `screens/Search`       | `components/SearchModal` (extracted+props)    | Extract       |
| `screens/Publish`      | `components/PublishModal` (extracted+props)   | Extract       |

The orphaned screens (`Reading`, `Editing`, `WhatChanged`, `Agent`, `Approval`, `Search`, `Publish`) remain in `screens/` and continue to compile. `Search.tsx` and `Publish.tsx` render `<Reading />` as a blurred backdrop — this continues to work because `Reading` still exports its function.

---

## 4. Component Specifications

### 4.1 `screens/Onboarding.tsx` (update)

**Props added:**
```typescript
interface OnboardingProps {
  onChooseLocal: () => void;
  onChooseGitHub: () => void;
}
```

**Changes:** Wire `onClick={onChooseLocal}` to the "Choose folder…" button inside the left `OnboardingCard`, and `onClick={onChooseGitHub}` to the "Continue with GitHub" button inside the right `OnboardingCard`. The `OnboardingCard` component needs an `onClick?: () => void` prop threaded through to its `<button>`.

---

### 4.2 `components/Sidebar.tsx` (update)

**Props added:**
```typescript
interface SidebarProps {
  variant: 'live' | 'draft';
  activeNoteId: string;
  expandedNotebooks: string[];
  onNoteClick: (noteId: string) => void;
  onNotebookToggle: (notebookId: string) => void;
}
```

**Changes:**
- Remove `isExpanded` from the `NotebookItem` interface and the `NOTEBOOKS` data.
- Replace `nb.isExpanded` checks with `expandedNotebooks.includes(nb.id)`.
- Notebook rows: add `onClick={() => onNotebookToggle(nb.id)}`.
- Note rows: add `onClick={() => onNoteClick(note.id)}`.
- Add `useState<string | null>(null)` for `hoveredId`.
- Set `onMouseEnter={() => setHoveredId(note.id)}` / `onMouseLeave={() => setHoveredId(null)}` on note rows.
- Hovered non-active rows get `background: rgba(88,86,214,.04)`.

---

### 4.3 `components/DocumentView.tsx` (new)

**Props:**
```typescript
interface DocumentViewProps { activeNoteId: string; }
```

**Layout:** `flex: 1`, `overflowY: auto`, `background: #fff`, centered content column (`maxWidth: 720`, `padding: 48px 40px`).

**Content routing:**

- `activeNoteId === 'deploy-rollback'`: renders "Deploy rollback" document
  - H1: "Deploy rollback"
  - H2: "Prerequisites"
  - A `<pre>` / code block showing a deploy command sequence
- All other IDs: renders "Payments service runbook" (content extracted from `screens/Reading.tsx`)
  - Frontmatter tag pills: `owner: payments-team`, `review by: 2026-09-30`, `severity: sev1`
  - H1: "Payments service runbook"
  - Intro paragraph
  - H2: "Escalation path" + intro paragraph + 3-row table (Level/Who/Response time)
  - H2: "Failure modes" + outro paragraph

---

### 4.4 `components/MarkdownEditor.tsx` (new)

**Props:** none

**Layout:** `flex: 1`, `display: flex`, flex row.

**Left panel:** `flex: 1`, `overflowY: auto`, `padding: 36px 40px`, monospace editor. Renders `MARKDOWN_LINES` array using the `MarkdownLine` component. `cursorLineIndex` is the index of the line whose content includes `'Idempotency-key missing'`.

**Right panel (Outline):** `width: 186px`, `borderLeft: 1px solid rgba(0,0,0,.06)`, `background: #fafafa`, `padding: 16px 12px`. "Outline" label + `OUTLINE_ITEMS` list.

Content (data arrays and `MarkdownLine` sub-component) is extracted verbatim from `screens/Editing.tsx`.

---

### 4.5 `components/DiffView.tsx` (new)

**Props:** none

**Layout:** `flex: 1`, `display: flex`, `flexDirection: column`.

Structure:
1. **Header bar** (44px): note name, `(M)` badge, `+18`/`-2` stats, draft name, total `+32`/`-3` stats.
2. **Column headers** (30px): "Live" | "This draft" over `background: #f8f8fc`.
3. **Two-column diff**: `flex: 1`, `display: flex`. Left and right columns each take `flex: 1`. Right column gets the "Undo this change" button overlay.

Content (data arrays and `DiffColumn`/`DiffLine` sub-components) is extracted verbatim from `screens/WhatChanged.tsx`.

---

### 4.6 `components/ChatPanel.tsx` (new)

**Props:**
```typescript
interface ChatPanelProps {
  draftStatus: DraftStatus;
  draftName: string;
  lastApprovalResult: 'approved' | 'declined' | null;
  onClose: () => void;
  onNeedsApproval: () => void;
  onApprove: () => void;
  onDecline: () => void;
}
```

**Internal state:** `inputValue: string` (controlled textarea).

**Layout:** `width: 380px`, `flexShrink: 0`, `background: #fff`, `borderLeft: 1px solid rgba(0,0,0,.08)`, `borderRadius: 12px 0 0 12px`, `boxShadow: -10px 0 24px rgba(0,0,0,.08)`.

**Header (44px):**
- "Arlo" title (left)
- Status badge (center):
  - `draftStatus === 'working'` → blue dot + "working" pill (`background: rgba(88,86,214,.06)`, color `#5856D6`)
  - `draftStatus === 'needs-approval'` → orange dot + "needs your approval" pill (`background: rgba(192,122,18,.08)`, color `#c07a12`)
- X close button → calls `onClose()`

**Messages area (`flex: 1`, `overflowY: auto`):**
- User message bubble (`background: #f0f0f8`, `borderRadius: 10`)
- `ToolCallCard` × 2: "Searched knowledge base — 4 results" and "Read Payments service runbook"
- Arlo response text
  - When `draftStatus === 'working'`: show blinking `<Cursor />` after response text
  - When `draftStatus === 'needs-approval'`: show `<ApprovalCard>` below response text
- When `lastApprovalResult !== null`: show result line ("Change approved and applied." or "Change declined.") in appropriate color (success green or danger red)

**`ApprovalCard` (inline sub-component):**
- Header: "Arlo wants to edit this note" + "Payments service runbook" file pill
- Diff area: `DIFF_LINES` array from `screens/Approval.tsx`, rendered using `DiffLine`
- Footer: "Arlo drafted this change…" note + Decline / Approve buttons
  - Approve → `onApprove()`
  - Decline → `onDecline()`
- "Always allow · this draft only" link text below buttons

**Footer:**
- Draft status pill (dot + "Draft: {draftName}"): dot is blue when `working`, orange when `needs-approval`
- `<textarea>` with placeholder "Ask Arlo…", controlled by `inputValue`
- Send button (ArrowUp icon):
  - `disabled` (grey: `background: #f0f0f8`) when `inputValue.trim() === ''`
  - Active (blue: `background: #5856D6`) when `inputValue.trim() !== ''`
  - On click: clear `inputValue`, call `setTimeout(() => onNeedsApproval(), 1500)`

---

### 4.7 `components/SearchModal.tsx` (new)

**Props:**
```typescript
interface SearchModalProps { onClose: (noteId?: string) => void; }
```

**Layout:** `position: absolute`, `inset: 0`. Two children:

1. **Backdrop:** full-size `div`, `background: rgba(26,26,46,.28)`, `onClick={() => onClose()}`.
2. **Modal card:** `position: absolute`, `top: 96px`, `left: 50%`, `transform: translateX(-50%)`, `width: 720px`, white background, `borderRadius: 12`, shadow. `onClick={e => e.stopPropagation()}`.

Modal card contents (extracted from `screens/Search.tsx`):
- Input row with SearchIcon, "idempotency key retry" text + `<Cursor />`, Esc badge (onClick → `onClose()`)
- Filter pills row (All notebooks, Runbooks, Architecture Decisions, Incidents)
- Results list: 5 rows from `RESULTS` array, each with `onClick={() => onClose(noteIdMap[result.id])}`
- Footer with count + progress indicator

NoteId map for result clicks:
```typescript
const NOTE_IDS: Record<string, string> = {
  r1: 'payments',
  r2: 'adr-014',
  r3: 'api-ref',
  r4: 'inc-2291',
  r5: 'on-call',
};
```

---

### 4.8 `components/PublishModal.tsx` (new)

**Props:**
```typescript
interface PublishModalProps { onPublish: () => void; onCancel: () => void; }
```

**Layout:** Same overlay pattern as `SearchModal`. Modal card: `width: 620px`, `top: 110px`.

Modal card contents (extracted from `screens/Publish.tsx`):
- Header: "Publish for review" title
- Body: Title field, Summary bullets, 4 changed files, Reviewers row, AI attribution checkbox
- Footer: "Save and finish later" button → `onCancel()` | "Publish for review" button → `onPublish()`

---

## 5. Interaction Flow

```
App start
  └─ onboarded = false → render <Onboarding>
       "Choose folder…" click  → onChooseLocal()  → setOnboarded(true)
       "Continue with GitHub"  → onChooseGitHub() → setOnboarded(true)

MainLayout — initial state: viewMode='read', modal=null, showChat=false, draftStatus=null

  [Navigation]
  Toolbar ⌘K / search bar  → modal='search'  → SearchModal visible
  Toolbar chat icon         → showChat=true, draftStatus='working', draftName='Payments runbook refresh'
  Sidebar note click        → activeNoteId=clicked, activeTabId=clicked, viewMode='read'
  Sidebar notebook toggle   → expandedNotebooks toggled for that notebookId
  Tab click                 → activeTabId=clicked, activeNoteId=clicked, viewMode='read'
  + (new tab) button        → modal='search'
  Toolbar "Edit" mode       → viewMode='edit' → MarkdownEditor visible
  Toolbar "What changed"    → viewMode='diff' → DiffView visible (only when hasDraft)
  Toolbar "Publish"         → modal='publish' → PublishModal visible (only when hasDraft)

  [ChatPanel lifecycle]
  Panel open (showChat=true):
    Header X button         → showChat=false (draftStatus and draftName preserved)
    Input send (with text)  → clear input, setTimeout 1500ms → draftStatus='needs-approval'
    ApprovalCard Approve    → draftStatus='working', lastApprovalResult='approved'
    ApprovalCard Decline    → draftStatus='working', lastApprovalResult='declined'

  [SearchModal]
  Result click              → modal=null, activeNoteId=result.noteId, viewMode='read'
  Backdrop click            → modal=null
  Esc badge click           → modal=null

  [PublishModal]
  "Publish for review"      → modal=null, draftStatus=null, draftName='', showChat=false, viewMode='read'
  "Save and finish later"   → modal=null
  Backdrop click            → modal=null
```

---

## 6. State Transitions Table

| User action | State changes |
|---|---|
| "Choose folder…" or "Continue with GitHub" | `onboarded = true` |
| Toolbar search / ⌘K | `modal = 'search'` |
| Toolbar chat icon (off → on) | `showChat = true`, `draftStatus = 'working'` (if null), `draftName = 'Payments runbook refresh'` (if empty) |
| Toolbar chat icon (on → off) | `showChat = false` |
| Toolbar "Edit" | `viewMode = 'edit'`, `modal = null` |
| Toolbar "What changed" | `viewMode = 'diff'`, `modal = null` |
| Toolbar "Publish" | `modal = 'publish'` |
| Sidebar note click | `activeNoteId = id`, `activeTabId = id`, `viewMode = 'read'` |
| Sidebar notebook toggle | `expandedNotebooks` toggled (add/remove id) |
| Tab click | `activeTabId = id`, `activeNoteId = id`, `viewMode = 'read'` |
| + tab button | `modal = 'search'` |
| ChatPanel X | `showChat = false` |
| ChatPanel send | (after 1500ms) `draftStatus = 'needs-approval'` |
| ApprovalCard Approve | `draftStatus = 'working'`, `lastApprovalResult = 'approved'` |
| ApprovalCard Decline | `draftStatus = 'working'`, `lastApprovalResult = 'declined'` |
| SearchModal result click | `modal = null`, `activeNoteId = result.noteId`, `viewMode = 'read'` |
| SearchModal backdrop/Esc | `modal = null` |
| PublishModal "Publish for review" | `modal = null`, `draftStatus = null`, `draftName = ''`, `showChat = false`, `viewMode = 'read'` |
| PublishModal "Save and finish later" | `modal = null` |
| PublishModal backdrop | `modal = null` |

---

## 7. Design Tokens

All components must use these values. No hardcoded one-offs.

### Colors

| Role | Value |
|---|---|
| Accent | `#5856D6` |
| Accent hover | `#4745B5` |
| Accent light bg | `rgba(88,86,214,.08)` |
| Accent hover row | `rgba(88,86,214,.04)` |
| Text primary | `#1a1a2e` |
| Text secondary | `#52526b` |
| Text tertiary | `#64648c` |
| Text muted | `#8e8eaa` |
| Background white | `#fff` |
| Background light | `#f8f8fc` |
| Background off-white | `#f0f0f8` |
| Border subtle | `rgba(0,0,0,.06)` |
| Border default | `rgba(0,0,0,.08)` |
| Border strong | `rgba(0,0,0,.10)` |
| Success | `#1f9d6b` |
| Warning | `#c07a12` |
| Warning bg | `rgba(192,122,18,.08)` |
| Danger | `#d1435b` |
| Diff add bg | `#eefaf4` |
| Diff add marker | `#d6f2e4` |
| Diff remove bg | `#fdf0f2` |
| Diff remove marker | `#f7d7dd` |

### Typography

| Variable | Usage |
|---|---|
| `var(--font-sans)` | All UI text, labels, headings |
| `var(--font-mono)` | Code blocks, diff lines, monospaced input, keyboard shortcuts |

### Component Dimensions

| Component | Key dimension |
|---|---|
| Sidebar | `width: 240px` |
| ChatPanel | `width: 380px` |
| Outline panel | `width: 186px` |
| SearchModal card | `width: 720px`, `top: 96px` |
| PublishModal card | `width: 620px`, `top: 110px` |
| TitleBar | `height: 38px` |
| Toolbar | `height: 44px` |
| ChatPanel header | `height: 44px` |

---

## 8. Error Handling

### Chat panel closed mid-draft

When `showChat` becomes `false`, `draftStatus` and `draftName` are **preserved**. The draft pill in TitleBar and the enabled state of "Publish" and "What changed" toolbar buttons remain visible. The user can reopen the chat panel and see the conversation in whatever state it was left in.

### Publish with active approval pending

The "Publish" button is only enabled when `hasDraft === true` (`draftStatus !== null`). If `draftStatus === 'needs-approval'`, the user can still open PublishModal. On confirm, `draftStatus` resets to `null` and `showChat` to `false`, clearing the draft cleanly.

### Invalid `activeNoteId`

`DocumentView` treats any `activeNoteId` that is not `'deploy-rollback'` as the Payments runbook. There is no error state — the component gracefully falls back to the default content.

### Missing modal state

`MainLayout` only renders `SearchModal` and `PublishModal` when `modal` is exactly `'search'` or `'publish'`. Any other `modal` value (including `null`) renders nothing, preventing ghost overlays.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Notebook toggle is a clean toggle

For any `AppState` and any `notebookId`, calling the notebook toggle handler twice in succession should return `expandedNotebooks` to its original value.

**Validates: Requirements REQ-003**

### Property 2: Chat open always sets draftStatus

For any `AppState` where `showChat === false` and `draftStatus === null`, after `handleChatToggle()` is called, `showChat === true` and `draftStatus === 'working'`.

**Validates: Requirements REQ-004**

### Property 3: Publish resets all draft state

For any `AppState` where `draftStatus !== null`, after `handlePublish()` is called, `draftStatus === null`, `draftName === ''`, `showChat === false`, and `modal === null`.

**Validates: Requirements REQ-006**

### Property 4: Modal close never affects viewMode

For any `AppState` with `modal !== null`, closing the modal (backdrop or cancel) sets `modal === null` without changing `viewMode`.

**Validates: Requirements REQ-001**

### Property 5: Search navigation sets read mode

For any `activeNoteId` returned by `SearchModal.onClose(noteId)`, the resulting state has `viewMode === 'read'` and `modal === null`.

**Validates: Requirements REQ-005**
