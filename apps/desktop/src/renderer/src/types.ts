import type { FileNode, GitStatus } from '@arlo-doc/shared';

export type ViewMode = 'preview' | 'edit' | 'diff';

export interface WorktreeTab {
  id: string;
  /** Display name. "Untitled" until set by AI chat or user. */
  title: string;
  /** Absolute path of the worktree root on disk. */
  worktreePath: string;
  /** Git branch name checked out in this worktree. */
  branch: string;
  /** True for the initial folder tab opened via "Open Folder" — NOT a git worktree. */
  isMainTab?: boolean;
}

export interface WorktreeTabState {
  fileTree: FileNode | null;
  activeFilePath: string | null;
  fileContent: string | null;
  fileLoading: boolean;
  expandedPaths: string[];
  gitStatus: GitStatus | null;
  fileDiff: string | null;
  fileSaving: boolean;
  fileSaveError: string | null;
  /** Content at last save — used for unsaved-changes detection. */
  savedContent: string | null;
  /** Line to scroll to and highlight after a search result opens this file.
   *  1-indexed. null = no scroll target. */
  scrollToLine: number | null;
}

export const EMPTY_TAB_STATE: WorktreeTabState = {
  fileTree: null,
  activeFilePath: null,
  fileContent: null,
  fileLoading: false,
  expandedPaths: [],
  gitStatus: null,
  fileDiff: null,
  fileSaving: false,
  fileSaveError: null,
  savedContent: null,
  scrollToLine: null,
};
export type DraftStatus = 'working' | 'needs-approval' | 'draft' | null;

export interface CloseWorktreeModal {
  kind: 'close-worktree';
  tabId: string;
  worktreePath: string;
}

export type ModalKind = 'search' | 'publish' | CloseWorktreeModal | null;

export interface SidebarNote {
  id: string;
  title: string;
  isNew?: boolean;
  isModified?: boolean;
}

export interface NotebookItem {
  id: string;
  label: string;
  notes: SidebarNote[];
  hasModified?: boolean;
}

export interface AppState {
  // ── Tab system ─────────────────────────────────────────────────────────
  tabs: WorktreeTab[];
  activeTabId: string | null;           // null → empty state
  tabStates: Record<string, WorktreeTabState>;

  // ── UI ─────────────────────────────────────────────────────────────────
  viewMode: ViewMode;
  modal: ModalKind;
  showChat: boolean;
  draftStatus: DraftStatus;
  draftName: string;
  lastApprovalResult: 'approved' | 'declined' | null;
  /** Absolute path of the git repo root; set when a folder is opened. */
  repoDir: string | null;
}
