import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { AppState, ViewMode } from './types';
import { handleFileClickLogic } from './fileClickLogic';
import { deriveGitStatusMap } from './gitStatusMapUtils';
import { Onboarding } from './screens/Onboarding';
import { MainLayout } from './screens/MainLayout';
import './styles/globals.css';

const INITIAL_TABS = [
  { id: 'payments', title: 'Payments service runbook', type: 'document' as const },
  { id: 'deploy-rollback', title: 'Deploy rollback', type: 'document' as const },
];

const INITIAL_STATE: AppState = {
  viewMode: 'preview',
  modal: null,
  showChat: false,
  draftStatus: null,
  draftName: '',
  tabs: INITIAL_TABS,
  activeTabId: 'payments',
  activeNoteId: 'payments',
  expandedNotebooks: ['runbooks'],
  lastApprovalResult: null,
  // Folder browser fields
  folderPath: null,
  fileTree: null,
  activeFilePath: null,
  fileContent: null,
  fileLoading: false,
  expandedPaths: [],
  // Git
  gitStatus: null,
  fileDiff: null,
};

export function App(): React.ReactElement {
  const [onboarded, setOnboarded] = useState(false);
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [choosePending, setChoosePending] = useState(false);
  const [chooseError, setChooseError] = useState<string | null>(null);
  // Last folder path loaded from persistence — shown as quick-resume option
  const [lastFolder, setLastFolder] = useState<string | null>(null);

  const update = useCallback((patch: Partial<AppState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  // On mount: load the persisted last folder path so Onboarding can show it,
  // but do NOT auto-onboard — always show Onboarding first.
  useEffect(() => {
    void (async () => {
      const result = await window.arlodoc.getLastFolder();
      if (result.ok && result.data != null) {
        setLastFolder(result.data);
      }
    })();
  }, []);

  // Mode switching
  const handleModeChange = useCallback(
    (mode: ViewMode) => {
      update({ viewMode: mode, modal: null });
    },
    [update],
  );

  // Search
  const handleOpenSearch = useCallback(() => {
    update({ modal: 'search' });
  }, [update]);

  const handleCloseSearch = useCallback(
    (noteId?: string) => {
      if (noteId) {
        update({ modal: null, activeNoteId: noteId, viewMode: 'preview' });
      } else {
        update({ modal: null });
      }
    },
    [update],
  );

  // Chat
  const handleChatToggle = useCallback(() => {
    setState((s) => {
      const opening = !s.showChat;
      return {
        ...s,
        showChat: opening,
        draftStatus: opening && !s.draftStatus ? 'working' : s.draftStatus,
        draftName: opening && !s.draftName ? 'Payments runbook refresh' : s.draftName,
      };
    });
  }, []);

  const handleCloseChat = useCallback(() => {
    update({ showChat: false });
  }, [update]);

  // Approval
  const handleNeedsApproval = useCallback(() => {
    update({ draftStatus: 'needs-approval' });
  }, [update]);

  const handleApprove = useCallback(() => {
    update({ draftStatus: 'working', lastApprovalResult: 'approved' });
  }, [update]);

  const handleDecline = useCallback(() => {
    update({ draftStatus: 'working', lastApprovalResult: 'declined' });
  }, [update]);

  // Publish
  const handleOpenPublish = useCallback(() => {
    update({ modal: 'publish' });
  }, [update]);

  const handlePublish = useCallback(() => {
    update({
      modal: null,
      draftStatus: null,
      draftName: '',
      showChat: false,
      viewMode: 'preview',
    });
  }, [update]);

  const handleCancelPublish = useCallback(() => {
    update({ modal: null });
  }, [update]);

  // Tabs
  const handleTabClick = useCallback(
    (id: string) => {
      update({ activeTabId: id, activeNoteId: id, viewMode: 'preview' });
    },
    [update],
  );

  const handleNewTab = useCallback(() => {
    update({ modal: 'search' });
  }, [update]);

  // Sidebar
  const handleNoteClick = useCallback(
    (noteId: string) => {
      update({ activeNoteId: noteId, activeTabId: noteId, viewMode: 'preview' });
    },
    [update],
  );

  const handleNotebookToggle = useCallback((notebookId: string) => {
    setState((s) => {
      const expanded = s.expandedNotebooks.includes(notebookId)
        ? s.expandedNotebooks.filter((id) => id !== notebookId)
        : [...s.expandedNotebooks, notebookId];
      return { ...s, expandedNotebooks: expanded };
    });
  }, []);

  // Open a specific folder path (used by both "Choose folder" and "Resume last")
  const openFolder = useCallback(async (folderPath: string) => {
    const tree = await window.arlodoc.readFolder(folderPath);
    if (!tree.ok) {
      setChooseError(tree.error.message);
      return false;
    }
    update({ folderPath, fileTree: tree.data });
    setOnboarded(true);
    return true;
  }, [update]);

  // Folder selection — native OS picker
  const handleChooseFolder = useCallback(async () => {
    setChoosePending(true);
    setChooseError(null);
    try {
      const chosen = await window.arlodoc.chooseFolder();
      if (!chosen.ok) {
        setChooseError(chosen.error.message);
        return;
      }
      if (chosen.data == null) return; // user cancelled
      await openFolder(chosen.data);
    } finally {
      setChoosePending(false);
    }
  }, [openFolder]);

  // Resume last folder — called from the Onboarding quick-resume card
  const handleResumeLastFolder = useCallback(async () => {
    if (!lastFolder) return;
    setChoosePending(true);
    setChooseError(null);
    try {
      await openFolder(lastFolder);
    } finally {
      setChoosePending(false);
    }
  }, [lastFolder, openFolder]);

  // Race-condition guard: tracks the most recently requested file path
  const latestFileRef = useRef<string | null>(null);

  // File interactions — delegates to extracted logic for testability
  const handleFileClick = useCallback(async (filePath: string) => {
    await handleFileClickLogic(filePath, latestFileRef, update, window.arlodoc);
  }, [update]);

  const handleDirectoryToggle = useCallback((dirPath: string) => {
    setState((s) => {
      const next = s.expandedPaths.includes(dirPath)
        ? s.expandedPaths.filter((p) => p !== dirPath)
        : [...s.expandedPaths, dirPath];
      return { ...s, expandedPaths: next };
    });
  }, []);

  const handleContentChange = useCallback((content: string) => {
    update({ fileContent: content });
  }, [update]);

  // Derive git status map from AppState.gitStatus for FileBrowser badges
  const gitStatusMap = useMemo(
    () => deriveGitStatusMap(state.gitStatus, state.folderPath),
    [state.gitStatus, state.folderPath],
  );

  // Requirements 6.4, 3.3 — null and "" both yield false
  const showDiffTab = Boolean(state.fileDiff);

  // Requirement 6.5 — reset viewMode when the diff tab disappears
  useEffect(() => {
    if (!showDiffTab && state.viewMode === 'diff') {
      update({ viewMode: 'preview' });
    }
  }, [showDiffTab]);

  if (!onboarded) {
    return (
      <Onboarding
        onChooseLocal={handleChooseFolder}
        onChooseGitHub={handleChooseFolder}
        onResumeLastFolder={handleResumeLastFolder}
        lastFolderPath={lastFolder}
        isPending={choosePending}
        error={chooseError}
      />
    );
  }

  return (
    <MainLayout
      state={state}
      gitStatusMap={gitStatusMap}
      showDiffTab={showDiffTab}
      onModeChange={handleModeChange}
      onOpenSearch={handleOpenSearch}
      onCloseSearch={handleCloseSearch}
      onChatToggle={handleChatToggle}
      onCloseChat={handleCloseChat}
      onNeedsApproval={handleNeedsApproval}
      onApprove={handleApprove}
      onDecline={handleDecline}
      onOpenPublish={handleOpenPublish}
      onPublish={handlePublish}
      onCancelPublish={handleCancelPublish}
      onTabClick={handleTabClick}
      onNewTab={handleNewTab}
      onNoteClick={handleNoteClick}
      onNotebookToggle={handleNotebookToggle}
      onFileClick={handleFileClick}
      onDirectoryToggle={handleDirectoryToggle}
      onContentChange={handleContentChange}
    />
  );
}
