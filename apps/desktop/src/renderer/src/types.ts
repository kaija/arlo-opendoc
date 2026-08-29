import type { FileNode, GitStatus } from '@arlo-doc/shared';

export type ViewMode = 'preview' | 'edit' | 'diff';
export type DraftStatus = 'working' | 'needs-approval' | 'draft' | null;
export type ModalKind = 'search' | 'publish' | null;

export interface Tab {
  id: string;
  title: string;
  type: 'document' | 'search';
}

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
  // Routing
  viewMode: ViewMode;
  modal: ModalKind;
  showChat: boolean;

  // Draft
  draftStatus: DraftStatus;
  draftName: string;

  // Tabs
  tabs: Tab[];
  activeTabId: string;

  // Sidebar
  activeNoteId: string;
  expandedNotebooks: string[];

  // Post-approval message
  lastApprovalResult: 'approved' | 'declined' | null;

  // ── Folder browser ────────────────────────────────────────────────────
  /** Absolute path of the currently open folder, or null in demo mode. */
  folderPath: string | null;
  /** FileNode root returned by the last successful readFolder call. */
  fileTree: FileNode | null;
  /** Absolute path of the file currently displayed in the main area. */
  activeFilePath: string | null;
  /** UTF-8 text content of the currently open file. */
  fileContent: string | null;
  /** True while arlo-doc:readFile is in-flight. */
  fileLoading: boolean;
  /** Directory paths currently expanded in FileBrowser. */
  expandedPaths: string[];

  // ── Git ───────────────────────────────────────────────────────────────
  /** Current git status for the open folder, or null if not fetched yet. */
  gitStatus: GitStatus | null;
  /** Unified diff string for the active file; null = not fetched, "" = no diff. */
  fileDiff: string | null;
  /** True while a writeFile IPC call is in-flight. */
  fileSaving: boolean;
  /** Error message from the last failed save, or null. */
  fileSaveError: string | null;
}
