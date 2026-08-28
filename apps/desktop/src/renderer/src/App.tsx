import React, { useState, useCallback, useEffect } from 'react';
import type { AppState, ViewMode } from './types';
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
};

export function App(): React.ReactElement {
  const [onboarded, setOnboarded] = useState(false);
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [choosePending, setChoosePending] = useState(false);
  const [chooseError, setChooseError] = useState<string | null>(null);

  const update = useCallback((patch: Partial<AppState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  // Auto-onboard from persisted folder on mount
  useEffect(() => {
    if (onboarded) return;
    void (async () => {
      const lastResult = await window.arlodoc.getLastFolder();
      if (!lastResult.ok || lastResult.data == null) return;
      const treeResult = await window.arlodoc.readFolder(lastResult.data);
      if (!treeResult.ok) return;
      update({ folderPath: lastResult.data, fileTree: treeResult.data });
      setOnboarded(true);
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

  // Folder selection
  const handleChooseFolder = useCallback(async () => {
    setChoosePending(true);
    setChooseError(null);
    try {
      const chosen = await window.arlodoc.chooseFolder();
      if (!chosen.ok) {
        setChooseError(chosen.error.message);
        return;
      }
      if (chosen.data == null) return; // user cancelled — no state change
      const tree = await window.arlodoc.readFolder(chosen.data);
      if (!tree.ok) {
        setChooseError(tree.error.message);
        return;
      }
      update({ folderPath: chosen.data, fileTree: tree.data });
      setOnboarded(true);
    } finally {
      setChoosePending(false);
    }
  }, [update]);

  // File interactions
  const handleFileClick = useCallback(async (filePath: string) => {
    const lower = filePath.toLowerCase();
    const supported = lower.endsWith('.md') || lower.endsWith('.mdx') || lower.endsWith('.txt');
    if (!supported) return; // only markdown and text files are previewable
    update({ fileLoading: true, activeFilePath: filePath });
    const result = await window.arlodoc.readFile(filePath);
    if (!result.ok) {
      update({ fileLoading: false, activeFilePath: null, fileContent: null });
      return;
    }
    update({ fileLoading: false, fileContent: result.data });
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

  if (!onboarded) {
    return (
      <Onboarding
        onChooseLocal={handleChooseFolder}
        onChooseGitHub={handleChooseFolder}
        isPending={choosePending}
        error={chooseError}
      />
    );
  }

  return (
    <MainLayout
      state={state}
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
