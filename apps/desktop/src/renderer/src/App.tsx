import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { MAX_TABS } from '@arlo-doc/shared';
import type { AppState, ViewMode, WorktreeTab, WorktreeTabState } from './types';
import { EMPTY_TAB_STATE } from './types';
import type { PersistedClientState } from '@arlo-doc/client';
import { handleFileClickLogic } from './fileClickLogic';
import type { TabStateUpdater } from './fileClickLogic';
import { deriveGitStatusMap } from './gitStatusMapUtils';
import { MainLayout } from './screens/MainLayout';
import { Onboarding } from './screens/Onboarding';
import './styles/globals.css';

const INITIAL_STATE: AppState = {
  tabs: [],
  activeTabId: null,
  tabStates: {},
  viewMode: 'preview',
  modal: null,
  showChat: false,
  draftStatus: null,
  draftName: '',
  lastApprovalResult: null,
  repoDir: null,
};

export function App(): React.ReactElement {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [lastFolderPath, setLastFolderPath] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [chooseError, setChooseError] = useState<string | null>(null);
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);
  const [isCreatingTab, setIsCreatingTab] = useState(false);

  const update = useCallback((patch: Partial<AppState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  // ── Derived active-tab helpers ──────────────────────────────────────────
  const activeTab = useMemo(
    () => state.tabs.find((t) => t.id === state.activeTabId) ?? null,
    [state.tabs, state.activeTabId],
  );
  const activeTabState: WorktreeTabState | null = useMemo(
    () => (activeTab ? (state.tabStates[activeTab.id] ?? null) : null),
    [activeTab, state.tabStates],
  );

  /**
   * Update a single tab's WorktreeTabState by id.
   * Used by all per-tab handlers and fileClickLogic.
   */
  const updateTabState: TabStateUpdater = useCallback(
    (tabId: string, patch: Partial<WorktreeTabState>) => {
      setState((s) => {
        const existing = s.tabStates[tabId];
        if (!existing) return s;
        return {
          ...s,
          tabStates: {
            ...s.tabStates,
            [tabId]: { ...existing, ...patch },
          },
        };
      });
    },
    [],
  );

  // ── Persistence helpers ─────────────────────────────────────────────────

  /**
   * Persists current tabs + active tab + last folder to disk.
   * Called fire-and-forget after every mutation that changes the tab list.
   * Write failures are swallowed in the main process (REQ-007.1).
   */
  const persistState = useCallback((s: AppState) => {
    const payload: PersistedClientState = {
      lastFolderPath: s.repoDir,
      openWorktrees: s.tabs.map((t) => ({
        id: t.id,
        title: t.title,
        worktreePath: t.worktreePath,
        branch: t.branch,
        ...(t.isMainTab ? { isMainTab: true as const } : {}),
      })),
      activeTabId: s.activeTabId,
    };
    void window.arlodoc.saveState(payload);
  }, []);

  // ── Restore persisted tabs on mount ─────────────────────────────────────
  // REQ-9.4: called once after the first render. Loads the persisted state
  // from disk, verifies paths still exist (main process handles that), then
  // reconstructs WorktreeTab + WorktreeTabState for each surviving worktree.
  useEffect(() => {
    let cancelled = false;

    async function restore(): Promise<void> {
      const result = await window.arlodoc.getPersistedState();
      if (!result.ok || cancelled) return;

      const { lastFolderPath, openWorktrees, activeTabId } = result.data;

      // Show last folder path immediately for the empty state resume button
      setLastFolderPath(lastFolderPath);

      // Case A: no persisted worktrees but we have a last folder → auto-resume
      if (openWorktrees.length === 0) {
        if (!lastFolderPath) return;
        const [treeResult, statusResult] = await Promise.all([
          window.arlodoc.readFolder(lastFolderPath),
          window.arlodoc.gitStatus(),
        ]);
        if (cancelled || !treeResult.ok) return;
        const branch = statusResult.ok ? statusResult.data.branch : 'main';
        const id = crypto.randomUUID();
        const folderName = lastFolderPath.split('/').pop() ?? 'Untitled';
        setState((s) => ({
          ...s,
          repoDir: lastFolderPath,
          tabs: [{
            id,
            title: folderName,
            worktreePath: lastFolderPath,
            branch,
            isMainTab: true,
          }],
          activeTabId: id,
          tabStates: { [id]: { ...EMPTY_TAB_STATE, fileTree: treeResult.data } },
        }));
        return;
      }

      // Case B: restore full worktree list
      const treeResults = await Promise.all(
        openWorktrees.map((wt) => window.arlodoc.readFolder(wt.worktreePath)),
      );

      if (cancelled) return;

      const tabs: WorktreeTab[] = [];
      const tabStates: Record<string, WorktreeTabState> = {};

      openWorktrees.forEach((wt, i) => {
        tabs.push({
          id: wt.id,
          title: wt.title,
          worktreePath: wt.worktreePath,
          branch: wt.branch,
          ...(wt.isMainTab ? { isMainTab: true as const } : {}),
        });
        const treeResult = treeResults[i];
        tabStates[wt.id] = {
          ...EMPTY_TAB_STATE,
          fileTree: treeResult?.ok ? treeResult.data : null,
        };
      });

      // Determine a valid active tab
      const validIds = new Set(tabs.map((t) => t.id));
      const restoredActiveTabId =
        activeTabId !== null && validIds.has(activeTabId)
          ? activeTabId
          : (tabs[0]?.id ?? null);

      setState((s) => ({
        ...s,
        repoDir: lastFolderPath,
        tabs,
        tabStates,
        activeTabId: restoredActiveTabId,
      }));
    }

    void restore();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ── Persist tabs whenever the tab list or active selection changes ───────
  // Runs after any setState that modifies tabs/activeTabId/repoDir.
  // Skips the initial render (tabs is empty and repoDir is null) to avoid
  // overwriting a valid persisted state with an empty one on startup.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    persistState(state);
  // persist whenever the tab list, active selection, or repo dir changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tabs, state.activeTabId, state.repoDir]);

  // ── Mode switching ──────────────────────────────────────────────────────
  const handleModeChange = useCallback(
    (mode: ViewMode) => {
      update({ viewMode: mode, modal: null });
    },
    [update],
  );

  // ── Search ──────────────────────────────────────────────────────────────
  const handleOpenSearch = useCallback(() => {
    update({ modal: 'search' });
  }, [update]);

  const handleCloseSearch = useCallback(() => {
    update({ modal: null });
  }, [update]);

  // ── Chat ────────────────────────────────────────────────────────────────
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

  // ── Approval ────────────────────────────────────────────────────────────
  const handleNeedsApproval = useCallback(() => {
    update({ draftStatus: 'needs-approval' });
  }, [update]);

  const handleApprove = useCallback(() => {
    update({ draftStatus: 'working', lastApprovalResult: 'approved' });
  }, [update]);

  const handleDecline = useCallback(() => {
    update({ draftStatus: 'working', lastApprovalResult: 'declined' });
  }, [update]);

  // ── Publish ─────────────────────────────────────────────────────────────
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

  // ── Tabs ────────────────────────────────────────────────────────────────
  const handleTabClick = useCallback(
    (id: string) => {
      update({ activeTabId: id, viewMode: 'preview' });
    },
    [update],
  );

  const handleNewTab = useCallback(async () => {
    if (state.tabs.length >= MAX_TABS) return;
    if (!state.repoDir) return;

    setIsCreatingTab(true);
    try {
      const result = await window.arlodoc.worktreeCreate(state.repoDir);
      if (!result.ok) {
        console.error('worktreeCreate failed:', result.error);
        return;
      }

      const { path: worktreePath, branch } = result.data;
      const tree = await window.arlodoc.readFolder(worktreePath, showHiddenFiles);

      const id = crypto.randomUUID();
      const newTab: WorktreeTab = { id, title: 'Untitled', worktreePath, branch };
      const newTabState: WorktreeTabState = {
        ...EMPTY_TAB_STATE,
        fileTree: tree.ok ? tree.data : null,
      };

      setState((s) => ({
        ...s,
        tabs: [...s.tabs, newTab],
        activeTabId: id,
        tabStates: { ...s.tabStates, [id]: newTabState },
      }));
    } finally {
      setIsCreatingTab(false);
    }
  }, [state.tabs.length, state.repoDir, showHiddenFiles]);  const doCloseTab = useCallback(async (tabId: string) => {
    setState((s) => {
      const tab = s.tabs.find((t) => t.id === tabId);
      if (!tab) return s;
      // Only delete the worktree if this is NOT the main folder tab
      if (!tab.isMainTab && s.repoDir) {
        void window.arlodoc.worktreeDelete(s.repoDir, tab.worktreePath);
      }
      const tabs = s.tabs.filter((t) => t.id !== tabId);
      const { [tabId]: _removed, ...tabStates } = s.tabStates;
      const closedIdx = s.tabs.findIndex((t) => t.id === tabId);
      // Prefer left neighbour, fall back to right neighbour, then null (empty state)
      const nextTab = tabs[closedIdx - 1] ?? tabs[closedIdx] ?? null;
      return {
        ...s,
        tabs,
        tabStates,
        activeTabId: nextTab?.id ?? null,
        modal: null,
      };
    });
  }, []);

  const handleOpenFolder = useCallback(async () => {
    setIsPending(true);
    setChooseError(null);
    try {
      const chosen = await window.arlodoc.chooseFolder();
      if (!chosen.ok) { setChooseError(chosen.error.message); return; }
      if (chosen.data == null) return; // user cancelled

      const folderPath = chosen.data;
      const [treeResult, statusResult] = await Promise.all([
        window.arlodoc.readFolder(folderPath, showHiddenFiles),
        window.arlodoc.gitStatus(),
      ]);
      if (!treeResult.ok) { setChooseError(treeResult.error.message); return; }

      const branch = statusResult.ok ? statusResult.data.branch : 'main';
      const id = crypto.randomUUID();
      const folderName = folderPath.split('/').pop() ?? 'Untitled';
      const newTab: WorktreeTab = {
        id,
        title: folderName,
        worktreePath: folderPath,
        branch,
        isMainTab: true,
      };

      setState((s) => ({
        ...s,
        repoDir: folderPath,
        tabs: [...s.tabs, newTab],
        activeTabId: id,
        tabStates: { ...s.tabStates, [id]: { ...EMPTY_TAB_STATE, fileTree: treeResult.data } },
      }));
    } finally {
      setIsPending(false);
    }
  }, []);

  const handleResumeFolder = useCallback(async () => {
    if (!lastFolderPath) return;
    const [treeResult, statusResult] = await Promise.all([
      window.arlodoc.readFolder(lastFolderPath, showHiddenFiles),
      window.arlodoc.gitStatus(),
    ]);
    if (!treeResult.ok) return;
    const branch = statusResult.ok ? statusResult.data.branch : 'main';
    const id = crypto.randomUUID();
    const folderName = lastFolderPath.split('/').pop() ?? 'Untitled';
    setState((s) => ({
      ...s,
      repoDir: lastFolderPath,
      tabs: [...s.tabs, { id, title: folderName, worktreePath: lastFolderPath, branch, isMainTab: true }],
      activeTabId: id,
      tabStates: { ...s.tabStates, [id]: { ...EMPTY_TAB_STATE, fileTree: treeResult.data } },
    }));
  }, [lastFolderPath]);

  const handleCloseTab = useCallback(
    async (tabId: string) => {
      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab) return;

      const dirtyResult = await window.arlodoc.worktreeDirty(tab.worktreePath);
      const isDirty = dirtyResult.ok && dirtyResult.data;

      if (isDirty) {
        setState((s) => ({
          ...s,
          modal: { kind: 'close-worktree', tabId, worktreePath: tab.worktreePath },
        }));
        return;
      }

      await doCloseTab(tabId);
    },
    [state.tabs, doCloseTab],
  );

  // ── Race-condition guard: tracks the most recently requested file path ──
  const latestFileRef = useRef<string | null>(null);
  // Keep a ref to the latest state so handleSave never closes over stale values
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  // ── Toggle hidden files — refreshes all open tabs ────────────────────────
  const handleToggleHiddenFiles = useCallback(async () => {
    const next = !showHiddenFiles;
    setShowHiddenFiles(next);
    // Re-read every open tab's folder tree with the new visibility setting
    const currentTabs = state.tabs;
    const results = await Promise.all(
      currentTabs.map((tab) => window.arlodoc.readFolder(tab.worktreePath, next)),
    );
    console.log('[toggleHidden] next:', next, 'tabs:', currentTabs.length, 'results:', results.map(r => r.ok ? r.data.children.length + ' children' : 'error'));
    setState((prev) => {
      const newStates = { ...prev.tabStates };
      currentTabs.forEach((tab, i) => {
        const r = results[i];
        if (r?.ok && newStates[tab.id]) {
          console.log('[toggleHidden] updating tab', tab.id, 'fileTree children:', r.data.children.filter(c => c.name.startsWith('.')).length, 'hidden');
          newStates[tab.id] = { ...newStates[tab.id]!, fileTree: r.data };
        }
      });
      return { ...prev, tabStates: newStates };
    });
  }, [showHiddenFiles, state.tabs]);

  // ── File interactions (5.6) ─────────────────────────────────────────────
  const handleFileClick = useCallback(async (filePath: string) => {
    if (!state.activeTabId) return;
    const tabId = state.activeTabId;
    await handleFileClickLogic(filePath, tabId, latestFileRef, updateTabState, window.arlodoc);
  }, [state.activeTabId, updateTabState]);

  const handleDirectoryToggle = useCallback((dirPath: string) => {
    setState((s) => {
      if (!s.activeTabId) return s;
      const tabId = s.activeTabId;
      const tabState = s.tabStates[tabId];
      if (!tabState) return s;
      const next = tabState.expandedPaths.includes(dirPath)
        ? tabState.expandedPaths.filter((p) => p !== dirPath)
        : [...tabState.expandedPaths, dirPath];
      return {
        ...s,
        tabStates: {
          ...s.tabStates,
          [tabId]: { ...tabState, expandedPaths: next },
        },
      };
    });
  }, []);

  const handleContentChange = useCallback((content: string) => {
    setState((s) => {
      if (!s.activeTabId) return s;
      const tabId = s.activeTabId;
      const tabState = s.tabStates[tabId];
      if (!tabState) return s;
      return {
        ...s,
        tabStates: {
          ...s.tabStates,
          [tabId]: { ...tabState, fileContent: content },
        },
      };
    });
  }, []);

  // ── handleSave (5.7) — reads/writes per-tab state ──────────────────────
  const handleSave = useCallback(async () => {
    const s = stateRef.current;
    const tabId = s.activeTabId;
    if (!tabId) return;
    const tabState = s.tabStates[tabId];
    if (!tabState) return;

    const { activeFilePath, fileContent, fileSaving } = tabState;
    if (!activeFilePath || fileContent == null || fileSaving) return;

    updateTabState(tabId, { fileSaving: true, fileSaveError: null });

    const result = await window.arlodoc.writeFile(activeFilePath, fileContent);
    if (!result.ok) {
      updateTabState(tabId, { fileSaving: false, fileSaveError: result.error.message });
      return;
    }

    // Refresh both git diff (What Changed tab) and git status (FileBrowser badges)
    const [diffResult, statusResult] = await Promise.all([
      window.arlodoc.gitDiff(activeFilePath),
      window.arlodoc.gitStatus(),
    ]);

    updateTabState(tabId, {
      fileSaving: false,
      fileSaveError: null,
      savedContent: fileContent,
      ...(diffResult.ok ? { fileDiff: diffResult.data } : {}),
      ...(statusResult.ok ? { gitStatus: statusResult.data } : {}),
    });
  }, [updateTabState]); // stable — reads latest state via stateRef

  // ── Derived values from activeTabState ─────────────────────────────────

  // True when in-memory content differs from what was last saved/loaded (5.6)
  const hasUnsavedChanges =
    activeTabState?.fileContent != null &&
    activeTabState.fileContent !== activeTabState.savedContent;

  // gitStatusMap (5.8) — derive from activeTabState + activeTab.worktreePath
  const gitStatusMap = useMemo(
    () => deriveGitStatusMap(activeTabState?.gitStatus ?? null, activeTab?.worktreePath ?? null),
    [activeTabState?.gitStatus, activeTab?.worktreePath],
  );

  // Requirements 6.4, 3.3 — null and "" both yield false
  const showDiffTab = Boolean(activeTabState?.fileDiff);

  // Requirement 6.5 — reset viewMode when the diff tab disappears
  useEffect(() => {
    if (!showDiffTab && state.viewMode === 'diff') {
      update({ viewMode: 'preview' });
    }
  }, [showDiffTab]);

  if (state.repoDir === null) {
    return (
      <Onboarding
        onChooseLocal={handleOpenFolder}
        onChooseGitHub={handleOpenFolder}
        {...(lastFolderPath ? { onResumeLastFolder: handleResumeFolder } : {})}
        lastFolderPath={lastFolderPath}
        isPending={isPending}
        error={chooseError}
      />
    );
  }

  return (
    <MainLayout
      state={state}
      activeTabState={activeTabState}
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
      onOpenFolder={handleOpenFolder}
      onResume={handleResumeFolder}
      lastFolderPath={lastFolderPath}
      onTabClick={handleTabClick}
      onNewTab={handleNewTab}
      onCloseTab={handleCloseTab}
      onCloseTabConfirm={() => {
        const m = state.modal;
        if (m && typeof m === 'object' && 'tabId' in m) void doCloseTab(m.tabId);
      }}
      onCancelCloseTab={() => update({ modal: null })}
      onFileClick={handleFileClick}
      onDirectoryToggle={handleDirectoryToggle}
      onContentChange={handleContentChange}
      onSave={handleSave}
      fileSaving={activeTabState?.fileSaving}
      fileSaveError={activeTabState?.fileSaveError}
      hasUnsavedChanges={hasUnsavedChanges}
      showHiddenFiles={showHiddenFiles}
      onToggleHiddenFiles={handleToggleHiddenFiles}
      isCreatingTab={isCreatingTab}
    />
  );
}
