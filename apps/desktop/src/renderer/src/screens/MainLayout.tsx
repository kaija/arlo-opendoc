import React from 'react';
import type { AppState, ViewMode } from '../types';
import { TitleBar } from '../components/TitleBar';
import { Toolbar } from '../components/Toolbar';
import { Sidebar } from '../components/Sidebar';
import { DocumentView } from '../components/DocumentView';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { DiffView } from '../components/DiffView';
import { ChatPanel } from '../components/ChatPanel';
import { SearchModal } from '../components/SearchModal';
import { PublishModal } from '../components/PublishModal';

export interface MainLayoutProps {
  state: AppState;
  onModeChange: (mode: ViewMode) => void;
  onOpenSearch: () => void;
  onCloseSearch: (noteId?: string) => void;
  onChatToggle: () => void;
  onCloseChat: () => void;
  onNeedsApproval: () => void;
  onApprove: () => void;
  onDecline: () => void;
  onOpenPublish: () => void;
  onPublish: () => void;
  onCancelPublish: () => void;
  onTabClick: (id: string) => void;
  onNewTab: () => void;
  onNoteClick: (noteId: string) => void;
  onNotebookToggle: (notebookId: string) => void;
}

export function MainLayout({
  state,
  onModeChange,
  onOpenSearch,
  onCloseSearch,
  onChatToggle,
  onCloseChat,
  onNeedsApproval,
  onApprove,
  onDecline,
  onOpenPublish,
  onPublish,
  onCancelPublish,
  onTabClick,
  onNewTab,
  onNoteClick,
  onNotebookToggle,
}: MainLayoutProps): React.ReactElement {
  const hasDraft = state.draftStatus !== null;
  const sidebarVariant = hasDraft ? 'draft' : 'live';

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        position: 'relative',
      }}
    >
      <TitleBar
        draftStatus={state.draftStatus}
        draftName={state.draftName}
        tabs={state.tabs}
        activeTabId={state.activeTabId}
        onTabClick={onTabClick}
        onNewTab={onNewTab}
      />
      <Toolbar
        breadcrumb={['Runbooks', 'Payments service runbook']}
        activeMode={state.viewMode}
        onModeChange={onModeChange}
        publishEnabled={hasDraft}
        chatActive={state.showChat}
        onChatToggle={onChatToggle}
        onPublish={onOpenPublish}
        onSearchClick={onOpenSearch}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        <Sidebar
          variant={sidebarVariant}
          activeNoteId={state.activeNoteId}
          expandedNotebooks={state.expandedNotebooks}
          onNoteClick={onNoteClick}
          onNotebookToggle={onNotebookToggle}
        />

        {/* Main content area */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {state.viewMode === 'read' && (
            <DocumentView activeNoteId={state.activeNoteId} />
          )}
          {state.viewMode === 'edit' && <MarkdownEditor />}
          {state.viewMode === 'diff' && <DiffView />}

          {/* Chat panel — slides in from right */}
          {state.showChat && (
            <ChatPanel
              draftStatus={state.draftStatus}
              draftName={state.draftName}
              lastApprovalResult={state.lastApprovalResult}
              onClose={onCloseChat}
              onNeedsApproval={onNeedsApproval}
              onApprove={onApprove}
              onDecline={onDecline}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {state.modal === 'search' && <SearchModal onClose={onCloseSearch} />}
      {state.modal === 'publish' && (
        <PublishModal onPublish={onPublish} onCancel={onCancelPublish} />
      )}
    </div>
  );
}
