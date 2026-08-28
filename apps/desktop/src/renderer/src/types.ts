export type ViewMode = 'read' | 'edit' | 'diff';
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
}
