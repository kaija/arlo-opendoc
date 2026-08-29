import React from 'react';
import type { AppState, ViewMode } from '../types';
import { TitleBar } from '../components/TitleBar';
import { Toolbar } from '../components/Toolbar';
import { Sidebar } from '../components/Sidebar';
import { FileBrowser } from '../components/FileBrowser';
import { DocumentView } from '../components/DocumentView';
import { MarkdownEditor } from '../components/MarkdownEditor';
import { UnifiedDiffView } from '../components/UnifiedDiffView';
import { ChatPanel } from '../components/ChatPanel';
import { SearchModal } from '../components/SearchModal';
import { PublishModal } from '../components/PublishModal';

export interface MainLayoutProps {
  state: AppState;
  gitStatusMap?: Map<string, string>;
  showDiffTab?: boolean;
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
  onFileClick: (path: string) => void;
  onDirectoryToggle: (path: string) => void;
  onContentChange: (content: string) => void;
}

// ── LoadingView ────────────────────────────────────────────────────────────

function LoadingView(): React.ReactElement {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 13, color: '#8e8eaa', fontFamily: 'var(--font-sans)' }}>
        Loading…
      </span>
    </div>
  );
}

// ── MainLayout ─────────────────────────────────────────────────────────────

export function MainLayout({
  state,
  gitStatusMap,
  showDiffTab = false,
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
  onFileClick,
  onDirectoryToggle,
  onContentChange,
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
        showDiffTab={showDiffTab}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {state.fileTree ? (
          <FileBrowser
            fileTree={state.fileTree}
            expandedPaths={state.expandedPaths}
            activeFilePath={state.activeFilePath}
            onFileClick={onFileClick}
            onDirectoryToggle={onDirectoryToggle}
            isLoading={state.fileLoading}
            gitStatusMap={gitStatusMap}
          />
        ) : (
          <Sidebar
            variant={sidebarVariant}
            activeNoteId={state.activeNoteId}
            expandedNotebooks={state.expandedNotebooks}
            onNoteClick={onNoteClick}
            onNotebookToggle={onNotebookToggle}
          />
        )}

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
          {state.viewMode === 'preview' && (
            state.fileLoading ? (
              <LoadingView />
            ) : state.fileContent != null && state.activeFilePath != null ? (
              <DocumentView
                activeNoteId={state.activeNoteId}
                fileContent={state.fileContent}
                activeFilePath={state.activeFilePath}
              />
            ) : (
              <DocumentView activeNoteId={state.activeNoteId} />
            )
          )}
          {state.viewMode === 'edit' && <MarkdownEditor content={state.fileContent} onChange={onContentChange} />}
          {state.viewMode === 'diff' && <UnifiedDiffView diff={state.fileDiff} />}

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
