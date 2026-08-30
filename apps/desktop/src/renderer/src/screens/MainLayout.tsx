import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AppState, ViewMode, WorktreeTabState } from '../types';
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
import { SettingsModal } from '../components/settings/SettingsModal';
import { EmptyTabState } from '../components/EmptyTabState';
import { CloseWorktreeDialog } from '../components/CloseWorktreeDialog';
import { NoFileSelected } from '../components/NoFileSelected';

export interface MainLayoutProps {
  state: AppState;
  /** Per-tab state for the currently active tab (null when no tab is active). */
  activeTabState: WorktreeTabState | null;
  gitStatusMap?: Map<string, string>;
  showDiffTab?: boolean;
  onModeChange: (mode: ViewMode) => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onSearchResultClick?: (filePath: string, lineNumber?: number) => void;
  onChatToggle: () => void;
  onCloseChat: () => void;
  onNeedsApproval: () => void;
  onApprove: () => void;
  onDecline: () => void;
  onOpenPublish: () => void;
  onPublish: () => void;
  onCancelPublish: () => void;
  onCancelCloseTab: () => void;
  onTabClick: (id: string) => void;
  onNewTab: () => void;
  onCloseTab: (tabId: string) => void;
  onCloseTabConfirm: () => void;
  onOpenFolder?: () => void;
  onOpenSettings?: (() => void) | undefined;
  onCloseSettings?: (() => void) | undefined;
  onAppSettingsChange?: ((next: import('@arlo-doc/shared').AppSettings) => void) | undefined;
  /** Application settings, so the editor and preview honour them. */
  appSettings?: import('@arlo-doc/shared').AppSettings | null | undefined;
  onResume?: () => void;
  lastFolderPath?: string | null | undefined;
  onNoteClick?: (noteId: string) => void;
  onNotebookToggle?: (notebookId: string) => void;
  onFileClick: (path: string) => void;
  onDirectoryToggle: (path: string) => void;
  onContentChange: (content: string) => void;
  onSave: () => void;
  fileSaving?: boolean | undefined;
  fileSaveError?: string | null | undefined;
  hasUnsavedChanges?: boolean | undefined;
  showHiddenFiles?: boolean | undefined;
  onToggleHiddenFiles?: () => void;
  isCreatingTab?: boolean | undefined;
  scrollToLine?: number | null | undefined;
  onScrollComplete?: (() => void) | undefined;
}

// ── LoadingView ────────────────────────────────────────────────────────────

function LoadingView(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 13, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)' }}>
        {t('common.loading')}
      </span>
    </div>
  );
}

// ── MainLayout ─────────────────────────────────────────────────────────────

export function MainLayout({
  state,
  activeTabState,
  gitStatusMap,
  showDiffTab = false,
  onModeChange,
  onOpenSearch,
  onCloseSearch,
  onSearchResultClick,
  onChatToggle,
  onCloseChat,
  onNeedsApproval,
  onApprove,
  onDecline,
  onOpenPublish,
  onPublish,
  onCancelPublish,
  onCancelCloseTab,
  onTabClick,
  onNewTab,
  onCloseTab,
  onCloseTabConfirm,
  onOpenFolder,
  onOpenSettings,
  onCloseSettings,
  onAppSettingsChange,
  appSettings,
  onResume,
  lastFolderPath,
  onNoteClick,
  onNotebookToggle,
  onFileClick,
  onDirectoryToggle,
  onContentChange,
  onSave,
  fileSaving,
  fileSaveError,
  hasUnsavedChanges,
  showHiddenFiles = false,
  onToggleHiddenFiles,
  isCreatingTab = false,
  scrollToLine,
  onScrollComplete,
}: MainLayoutProps): React.ReactElement {
  const hasDraft = state.draftStatus !== null;
  const sidebarVariant = hasDraft ? 'draft' : 'live';

  // Per-tab values — pulled from activeTabState
  const fileTree = activeTabState?.fileTree ?? null;
  const expandedPaths = activeTabState?.expandedPaths ?? [];
  const activeFilePath = activeTabState?.activeFilePath ?? null;
  const fileContent = activeTabState?.fileContent ?? null;
  const fileLoading = activeTabState?.fileLoading ?? false;
  const fileDiff = activeTabState?.fileDiff ?? null;

  // Active tab metadata (for branch indicator etc.)
  const activeTab = state.tabs.find(t => t.id === state.activeTabId) ?? null;

  // Derive repo name from repoDir: last path segment of the repo root
  const repoName = state.repoDir
    ? state.repoDir.split('/').filter(Boolean).pop() ?? undefined
    : undefined;

  // Derive breadcrumb from active file path: last two path segments
  // e.g. /repo/docs/guide.md → ['docs', 'guide.md']
  // If no file active, show the tab title (folder name) only
  const breadcrumb: string[] = (() => {
    if (activeFilePath) {
      const parts = activeFilePath.split('/').filter(Boolean);
      return parts.length >= 2 ? parts.slice(-2) : parts;
    }
    if (activeTab) return [activeTab.title];
    return [];
  })();

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-card)',
        position: 'relative',
      }}
    >
      <TitleBar
        draftStatus={state.draftStatus}
        draftName={state.draftName}
        tabs={state.tabs}
        activeTabId={state.activeTabId}
        onTabClick={onTabClick}
        onTabClose={onCloseTab}
        onNewTab={onNewTab}
        isCreatingTab={isCreatingTab}
      />
      <Toolbar
        breadcrumb={breadcrumb}
        activeMode={state.viewMode}
        onModeChange={onModeChange}
        publishEnabled={hasDraft}
        chatActive={state.showChat}
        onChatToggle={onChatToggle}
        onPublish={onOpenPublish}
        onSearchClick={onOpenSearch}
        showDiffTab={showDiffTab}
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={onSave}
        isSaving={fileSaving}
      />

      {state.activeTabId === null ? (
        <EmptyTabState
          onOpenFolder={onOpenFolder ?? (() => {})}
          lastFolderPath={lastFolderPath}
          {...(onResume ? { onResume } : {})}
        />
      ) : (
        <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
          {fileTree ? (
            <FileBrowser
              fileTree={fileTree}
              expandedPaths={expandedPaths}
              activeFilePath={activeFilePath}
              onFileClick={onFileClick}
              onDirectoryToggle={onDirectoryToggle}
              isLoading={fileLoading}
              gitStatusMap={gitStatusMap}
              branch={activeTab?.branch}
              repoName={repoName}
              showHidden={showHiddenFiles}
              {...(onToggleHiddenFiles ? { onToggleHidden: onToggleHiddenFiles } : {})}
              onOpenSettings={onOpenSettings}
            />
          ) : (
            <Sidebar
              variant={sidebarVariant}
              onNoteClick={onNoteClick ?? (() => {})}
              onNotebookToggle={onNotebookToggle ?? (() => {})}
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
              fileLoading ? (
                <LoadingView />
              ) : fileContent != null && activeFilePath != null ? (
                <DocumentView
                  fileContent={fileContent}
                  activeFilePath={activeFilePath}
                  scrollToLine={scrollToLine}
                  onScrollComplete={onScrollComplete}
                  frontMatterMode={appSettings?.editor.frontMatter}
                  lineWidth={appSettings?.editor.lineWidth}
                />
              ) : (
                <NoFileSelected />
              )
            )}
            {state.viewMode === 'edit' && (
              <MarkdownEditor
                content={fileContent}
                onChange={onContentChange}
                onSave={onSave}
                isSaving={fileSaving}
                saveError={fileSaveError}
                fontFamily={appSettings?.editor.fontFamily}
                fontSize={appSettings?.editor.fontSize}
                lineWidth={appSettings?.editor.lineWidth}
                wrapLines={appSettings?.editor.wrapLines}
                lineNumbers={appSettings?.editor.lineNumbers}
              />
            )}
            {state.viewMode === 'diff' && <UnifiedDiffView diff={fileDiff} />}

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
      )}

      {/* Modals */}
      {state.modal === 'search' && (
        <SearchModal
          repoDir={state.repoDir}
          fileTree={activeTabState?.fileTree ?? null}
          onClose={onCloseSearch}
          onResultClick={onSearchResultClick ?? (() => {})}
        />
      )}
      {state.modal === 'publish' && (
        <PublishModal onPublish={onPublish} onCancel={onCancelPublish} repoDir={state.repoDir} />
      )}
      {state.modal === 'settings' && (
        <SettingsModal
          repoPath={state.repoDir}
          repoName={repoName ?? null}
          onClose={onCloseSettings ?? (() => {})}
          onAppSettingsChange={onAppSettingsChange}
        />
      )}
      {state.modal !== null &&
        typeof state.modal === 'object' &&
        state.modal.kind === 'close-worktree' && (
          <CloseWorktreeDialog
            worktreePath={state.modal.worktreePath}
            onConfirm={onCloseTabConfirm}
            onCancel={onCancelCloseTab}
          />
        )}
    </div>
  );
}
