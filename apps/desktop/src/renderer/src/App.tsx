import React, { useState, useCallback } from 'react';
import type { AppState, ViewMode } from './types';
import { Onboarding } from './screens/Onboarding';
import { MainLayout } from './screens/MainLayout';
import './styles/globals.css';

const INITIAL_TABS = [
  { id: 'payments', title: 'Payments service runbook', type: 'document' as const },
  { id: 'deploy-rollback', title: 'Deploy rollback', type: 'document' as const },
];

const INITIAL_STATE: AppState = {
  viewMode: 'read',
  modal: null,
  showChat: false,
  draftStatus: null,
  draftName: '',
  tabs: INITIAL_TABS,
  activeTabId: 'payments',
  activeNoteId: 'payments',
  expandedNotebooks: ['runbooks'],
  lastApprovalResult: null,
};

export function App(): React.ReactElement {
  const [onboarded, setOnboarded] = useState(false);
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  const update = useCallback((patch: Partial<AppState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const handleOnboard = useCallback(() => {
    setOnboarded(true);
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
        update({ modal: null, activeNoteId: noteId, viewMode: 'read' });
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
      viewMode: 'read',
    });
  }, [update]);

  const handleCancelPublish = useCallback(() => {
    update({ modal: null });
  }, [update]);

  // Tabs
  const handleTabClick = useCallback(
    (id: string) => {
      update({ activeTabId: id, activeNoteId: id, viewMode: 'read' });
    },
    [update],
  );

  const handleNewTab = useCallback(() => {
    update({ modal: 'search' });
  }, [update]);

  // Sidebar
  const handleNoteClick = useCallback(
    (noteId: string) => {
      update({ activeNoteId: noteId, activeTabId: noteId, viewMode: 'read' });
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

  if (!onboarded) {
    return <Onboarding onChooseLocal={handleOnboard} onChooseGitHub={handleOnboard} />;
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
    />
  );
}
