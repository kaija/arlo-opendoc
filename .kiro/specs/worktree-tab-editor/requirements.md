# Worktree Tab Editor — Requirements

## Overview

Each tab in the application corresponds to a dedicated git worktree. The tab system allows users to work on independent branches of the same repository simultaneously, with each tab maintaining its own isolated file state. The left-side file browser always reflects the worktree of the currently active tab.

---

## Requirements

### REQ-1 — Initial state: no tabs

**User Story:** As a user launching the app, I want to start with a clean, empty editor so I am not presented with stale or unexpected worktree state.

**Acceptance Criteria:**
- On first launch (or when all tabs have been closed), the tab bar is empty — no tabs are shown.
- The file browser shows an empty state with an "Open Folder" prompt.
- No git worktree is created or attached until the user explicitly opens one.

---

### REQ-2 — Creating a tab via the `+` button

**User Story:** As a user, I want to manually open a new editing context so I can work on a separate worktree independently from any other open tab.

**Acceptance Criteria:**
- A `+` button is permanently visible at the right end of the tab bar.
- Clicking `+` creates a new git worktree from the current HEAD of the active repository and opens a new tab pointing to that worktree.
- The new tab is immediately set as the active tab.
- The new tab is given a default title of "Untitled" until renamed (e.g. by AI chat or user action).
- A maximum of `MAX_TABS = 25` tabs may be open simultaneously. When the limit is reached, the `+` button is disabled and shows a tooltip indicating the limit.

---

### REQ-3 — Tab naming

**User Story:** As a user, I want each tab to have a meaningful name so I can quickly identify which worktree / editing context it represents.

**Acceptance Criteria:**
- Default name for a newly created tab is "Untitled".
- The AI chat system may rename a tab to a descriptive name based on the content being edited or the task in progress.
- Tab titles that are too long to display are truncated with an ellipsis (`…`); the full name is shown in a tooltip on hover.

---

### REQ-4 — Tab bar layout and overflow

**User Story:** As a user with many tabs open, I want all tabs to remain accessible without the tab bar overflowing or requiring horizontal scrolling.

**Acceptance Criteria:**
- The tab bar must fit up to `MAX_TABS = 25` tabs within the visible window width.
- When more than a few tabs are open, each tab shrinks proportionally so that all tabs remain visible simultaneously (no horizontal scroll).
- A minimum tab width of 40px is enforced; below this width only the close (`×`) button is shown (no title text).
- The active tab may display slightly wider than inactive tabs to keep its title readable.

---

### REQ-5 — Switching tabs

**User Story:** As a user, I want to click any tab to switch to that editing context so the file browser and editor content update immediately.

**Acceptance Criteria:**
- Clicking an inactive tab makes it active.
- The file browser on the left immediately switches to reflect the file tree of the selected tab's worktree.
- The editor area restores the last viewed file and cursor position within that worktree.
- Switching tabs does not trigger any git operations (no commits, no checkouts outside the worktree).

---

### REQ-6 — Closing a tab

**User Story:** As a user, I want to close a tab and have the underlying worktree cleaned up automatically so I do not accumulate orphaned git worktrees.

**Acceptance Criteria:**
- Each tab displays a close (`×`) button that is always visible (not only on hover), given the small tab size.
- Before closing, the system checks whether the worktree has any uncommitted changes or untracked files.
- If uncommitted changes are detected, a confirmation dialog is shown with:
  - The full worktree path displayed clearly.
  - An explicit warning: "All unsaved edits in this worktree will be permanently deleted."
  - Two actions: **Delete worktree** (destructive, red) and **Cancel**.
- If no uncommitted changes exist, the worktree is deleted without a confirmation dialog.
- After the worktree is removed, the tab is closed and focus shifts to the nearest remaining tab (prefer the tab to the left).
- If the last tab is closed, the app returns to the empty / no-tab state (REQ-1).

---

### REQ-7 — File browser reflects active worktree

**User Story:** As a user, I want the file browser to always show the files inside the current tab's worktree so I know exactly what I am editing.

**Acceptance Criteria:**
- The file browser root is set to the worktree root of the active tab, not the main repository root.
- A subtle indicator (e.g. a label above the file tree) shows the active worktree path or branch name.
- When switching tabs, the file browser root changes immediately with no manual refresh required.

---

### REQ-8 — "Open Folder" button

**User Story:** As a user in the empty state, I want a visible affordance to open a folder so I can start working without hunting for a menu item.

**Acceptance Criteria:**
- When no tab is active (empty state), the sidebar displays an "Open Folder" button in the position previously occupied by the breadcrumb row.
- Clicking the button opens the OS native folder picker.
- Selecting a folder creates a new worktree tab rooted at that folder (or initialises a git repo there if none exists) and names the tab after the folder name.

---

### REQ-9 — Constant: maximum tab count

**Acceptance Criteria:**
- A single named constant `MAX_TABS` (default: `25`) controls the maximum number of concurrent tabs.
- This constant is defined in one place and referenced everywhere it is needed (tab creation guard, `+` button disabled state, tab width calculation).
