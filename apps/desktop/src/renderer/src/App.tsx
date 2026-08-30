import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { MAX_TABS } from '@arlo-doc/shared';
import type { AppState, ViewMode, WorktreeTab, WorktreeTabState } from './types';
import { EMPTY_TAB_STATE } from './types';
import type { RepoSession, RecentRepoSummary } from '@arlo-doc/client';
import { handleFileClickLogic } from './fileClickLogic';
import type { TabStateUpdater } from './fileClickLogic';
import { deriveGitStatusMap } from './gitStatusMapUtils';
import { MainLayout } from './screens/MainLayout';
import { Onboarding } from './screens/Onboarding';
import './styles/globals.css';
import { useTheme } from './components/settings/useTheme';
import { useInterfaceLanguage } from './i18n/useInterfaceLanguage';
import type { AppSettings } from '@arlo-doc/shared';

/**
 * Returns all ancestor directory paths for a given file path.
 * E.g. "/a/b/c/file.ts" → ["/a", "/a/b", "/a/b/c"]
 * Used by handleSearchResultClick to expand ancestor directories in FileBrowser (REQ-009.4).
 */
export function getAncestorPaths(filePath: string): string[] {
  const parts = filePath.split('/').filter(Boolean);
  const ancestors: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    ancestors.push('/' + parts.slice(0, i).join('/'));
  }
  return ancestors;
}

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
  const [recentRepos, setRecentRepos] = useState<RecentRepoSummary[]>([]);
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
   * Persists the current tabs + active tab into the open repo's own session
   * record (`<repo>/.arlo/session.json`). Called fire-and-forget after every
   * mutation that changes the tab list. Write failures are swallowed in the
   * main process (REQ-007.1). No repo open → nothing to persist.
   */
  const persistState = useCallback((s: AppState) => {
    if (!s.repoDir) return;
    const session: RepoSession = {
      version: 1,
      repoPath: s.repoDir,
      activeTabId: s.activeTabId,
      updatedAt: new Date().toISOString(),
      worktrees: s.tabs.map((t) => ({
        id: t.id,
        title: t.title,
        worktreePath: t.worktreePath,
        branch: t.branch,
        ...(t.isMainTab ? { isMainTab: true as const } : {}),
      })),
    };
    void window.arlodoc.saveRepoSession(s.repoDir, session);
  }, []);

  // ── Open a repository ──────────────────────────────────────────────────
  // The one path into a knowledge base, shared by the start screen (recent
  // list and folder picker) and the launch-time restore. Reads the folder
  // tree, the branch, and the repo's own session record, then rebuilds the
  // main tab plus — when `restoreDrafts` is set — every draft worktree the
  // repo had open. Returns false when the folder could not be read.
  const openRepo = useCallback(
    async (folderPath: string, restoreDrafts: boolean): Promise<boolean> => {
      const [treeResult, statusResult, sessionResult] = await Promise.all([
        window.arlodoc.readFolder(folderPath, showHiddenFiles),
        window.arlodoc.gitStatus(),
        window.arlodoc.readRepoSession(folderPath),
      ]);
      if (!treeResult.ok) {
        setChooseError(treeResult.error.message);
        return false;
      }

      // Record the open so it surfaces at the top of the recent list next time.
      void window.arlodoc.noteRepoOpened(folderPath);
      setLastFolderPath(folderPath);

      const branch = statusResult.ok ? statusResult.data.branch : 'main';
      const folderName = folderPath.split('/').pop() ?? 'Untitled';
      const mainId = crypto.randomUUID();

      const tabs: WorktreeTab[] = [
        { id: mainId, title: folderName, worktreePath: folderPath, branch, isMainTab: true },
      ];
      const tabStates: Record<string, WorktreeTabState> = {
        [mainId]: { ...EMPTY_TAB_STATE, fileTree: treeResult.data },
      };

      const session = sessionResult.ok ? sessionResult.data : null;
      const drafts =
        restoreDrafts && session ? session.worktrees.filter((w) => !w.isMainTab) : [];

      if (drafts.length > 0) {
        const draftTrees = await Promise.all(
          drafts.map((w) => window.arlodoc.readFolder(w.worktreePath, showHiddenFiles)),
        );
        drafts.forEach((w, i) => {
          tabs.push({
            id: w.id,
            title: w.title,
            worktreePath: w.worktreePath,
            branch: w.branch,
          });
          const tree = draftTrees[i];
          tabStates[w.id] = {
            ...EMPTY_TAB_STATE,
            fileTree: tree?.ok ? tree.data : null,
          };
        });
      }

      const validIds = new Set(tabs.map((t) => t.id));
      const activeTabId =
        session && session.activeTabId !== null && validIds.has(session.activeTabId)
          ? session.activeTabId
          : mainId;

      setState((s) => ({ ...s, repoDir: folderPath, tabs, tabStates, activeTabId }));
      return true;
    },
    [showHiddenFiles],
  );

  // ── Launch-time restore ────────────────────────────────────────────────
  // Settings > General > Startup decides what happens. The default,
  // 'start-screen', opens nothing — the recent list is loaded and the chooser
  // is shown. 'restore-all' / 'restore-kb' reopen the most recent repo, with
  // or without its draft worktrees.
  useEffect(() => {
    let cancelled = false;

    async function restore(): Promise<void> {
      const settingsResult = await window.arlodoc.readAppSettings();
      if (cancelled) return;
      const startup = settingsResult.ok
        ? settingsResult.data.general.startup
        : 'start-screen';

      const recentResult = await window.arlodoc.getRecentRepos();
      if (cancelled) return;
      const recent = recentResult.ok ? recentResult.data : [];
      setRecentRepos(recent);
      setLastFolderPath(recent[0]?.path ?? null);

      if (startup === 'start-screen') return;

      const target = recent[0]?.path;
      if (!target) return;
      await openRepo(target, startup === 'restore-all');
    }

    void restore();
    return () => { cancelled = true; };
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
  }, [state.tabs, state.activeTabId, state.repoDir]);

  // ── Mode switching ──────────────────────────────────────────────────────
  const handleModeChange = useCallback(
    (mode: ViewMode) => {
      update({ viewMode: mode, modal: null });
    },
    [update],
  );

  // ── Search ──────────────────────────────────────────────────────────────

  // REQ-001: Cmd+Shift+F (macOS) / Ctrl+Shift+F (Windows/Linux) opens the search modal.
  // Guards: skip when another modal is open, or when no tab is active.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const isMac = navigator.platform.startsWith('Mac');
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      if (modKey && e.shiftKey && e.key === 'F') {
        if (state.modal !== null && state.modal !== 'search') return;
        if (state.activeTabId === null) return;
        e.preventDefault();
        update({ modal: 'search' });
      }
      // Cmd+, / Ctrl+, — the platform convention for preferences. Unlike
      // search this needs no open tab: appearance and credentials are
      // configurable before any knowledge base is opened.
      if (modKey && !e.shiftKey && e.key === ',') {
        if (state.modal !== null && state.modal !== 'settings') return;
        e.preventDefault();
        update({ modal: state.modal === 'settings' ? null : 'settings' });
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.modal, state.activeTabId, update]);

  const handleOpenSearch = useCallback(() => {
    update({ modal: 'search' });
  }, [update]);

  const handleOpenSettings = useCallback(() => {
    update({ modal: 'settings' });
  }, [update]);

  // Application settings live here, not in the dialog: the theme must apply
  // on launch and stay applied after the dialog closes.
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    void window.arlodoc.readAppSettings().then((res) => {
      if (res.ok) setAppSettings(res.data);
    });
  }, []);

  useTheme(appSettings?.appearance.theme);
  useInterfaceLanguage(appSettings?.appearance.interfaceLanguage);

  // Callbacks read settings through a ref so they stay referentially stable —
  // the same reason stateRef exists below.
  const appSettingsRef = useRef<AppSettings | null>(null);
  useEffect(() => {
    appSettingsRef.current = appSettings;
  }, [appSettings]);

  const handleCloseSettings = useCallback(() => {
    update({ modal: null });
  }, [update]);

  const handleCloseSearch = useCallback(() => {
    update({ modal: null });
  }, [update]);

  // REQ-009.2: Reset scrollToLine to null after DocumentView has scrolled,
  // preventing re-scroll on subsequent re-renders.
  const handleScrollComplete = useCallback(() => {
    if (!state.activeTabId) return;
    updateTabState(state.activeTabId, { scrollToLine: null });
  }, [state.activeTabId, updateTabState]);

  // REQ-009: Open a search result file in the active tab at the matching line.
  const handleSearchResultClick = useCallback(
    async (filePath: string, lineNumber?: number) => {
      if (!state.activeTabId) return;
      const tabId = state.activeTabId;

      // Dismiss modal immediately (REQ-009.3)
      update({ modal: null });

      // Expand ancestors in FileBrowser (REQ-009.4)
      const ancestorPaths = getAncestorPaths(filePath);
      updateTabState(tabId, {
        expandedPaths: Array.from(
          new Set([...(state.tabStates[tabId]?.expandedPaths ?? []), ...ancestorPaths])
        ),
      });

      // Open file — mirrors the handleFileClick pattern, reuses latestFileRef race guard
      latestFileRef.current = filePath;
      updateTabState(tabId, { fileLoading: true, activeFilePath: filePath, scrollToLine: null });

      const [contentResult, statusResult, diffResult] = await Promise.all([
        window.arlodoc.readFile(filePath),
        window.arlodoc.gitStatus(),
        window.arlodoc.gitDiff(filePath),
      ]);

      if (latestFileRef.current !== filePath) return; // race guard

      if (!contentResult.ok) {
        updateTabState(tabId, { fileLoading: false, activeFilePath: null, fileContent: null, scrollToLine: null });
        return;
      }

      const totalLines = contentResult.data.split('\n').length;
      const clampedLine =
        lineNumber != null && lineNumber >= 1
          ? Math.min(lineNumber, totalLines)
          : null;

      updateTabState(tabId, {
        fileLoading: false,
        fileContent: contentResult.data,
        savedContent: contentResult.data,
        scrollToLine: clampedLine,
        ...(statusResult.ok ? { gitStatus: statusResult.data } : {}),
        ...(diffResult.ok ? { fileDiff: diffResult.data } : {}),
      });
    },
    [state.activeTabId, state.tabStates, update, updateTabState],
  );

  // ── Chat ────────────────────────────────────────────────────────────────
  // Opening the panel only shows it. A draft (and its title-bar pill) begins
  // when the agent actually starts working — see handleNeedsApproval — not
  // from the act of opening chat.
  const handleChatToggle = useCallback(() => {
    setState((s) => ({ ...s, showChat: !s.showChat }));
  }, []);

  const handleCloseChat = useCallback(() => {
    update({ showChat: false });
  }, [update]);

  // ── Approval ────────────────────────────────────────────────────────────
  // Settings > AI agent > Autonomy decides whether the agent's work stops for
  // approval. The two hard carve-outs from the design — deleting a file and
  // pushing to a remote — are NOT routed through here; they confirm at their
  // own call sites regardless of this setting.
  const handleNeedsApproval = useCallback(() => {
    // The draft belongs to the worktree being edited, so name the title-bar
    // pill after the active tab rather than a placeholder.
    const draftName =
      activeTab && activeTab.title !== 'Untitled' ? activeTab.title : '';
    if (appSettingsRef.current?.agent.autonomy !== 'review-each') {
      // At 'draft-freely' and 'full' the edit lands in the worktree and the
      // pull request becomes the gate, so there is nothing to stop for.
      update({ draftStatus: 'draft', draftName });
      return;
    }
    update({ draftStatus: 'needs-approval', draftName });
  }, [update, activeTab]);

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
      await openRepo(chosen.data, true);
    } finally {
      setIsPending(false);
    }
  }, [openRepo]);

  const handleResumeFolder = useCallback(async () => {
    if (!lastFolderPath) return;
    setChooseError(null);
    await openRepo(lastFolderPath, true);
  }, [lastFolderPath, openRepo]);

  const handleOpenRecentRepo = useCallback(
    async (repoPath: string) => {
      setChooseError(null);
      await openRepo(repoPath, true);
    },
    [openRepo],
  );

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
    // 'last-used' deliberately does nothing — leaving viewMode alone IS the
    // behaviour. The other two force the mode the user asked for.
    const openIn = appSettingsRef.current?.editor.openFilesIn;
    if (openIn === 'preview' || openIn === 'edit') {
      update({ viewMode: openIn === 'edit' ? 'edit' : 'preview' });
    }
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

  // ── Autosave ────────────────────────────────────────────────────────────
  // Settings > Editor. The worktree already isolates every edit and git keeps
  // every version, so saving on a debounce carries none of the risk it would
  // in a plain text editor. Cmd+S still saves immediately either way.
  //
  // The timer is keyed on the active file and its content: switching files or
  // typing again cancels the pending save and starts a new one, so a save
  // never lands on a file the user has already navigated away from.
  const activeTabIdForSave = state.activeTabId;
  const activeTabStateForSave = activeTabIdForSave ? state.tabStates[activeTabIdForSave] : undefined;
  const autosaveFilePath = activeTabStateForSave?.activeFilePath ?? null;
  const autosaveContent = activeTabStateForSave?.fileContent ?? null;
  const autosaveSaved = activeTabStateForSave?.savedContent ?? null;

  useEffect(() => {
    const editor = appSettings?.editor;
    if (editor === undefined || !editor.autosave) return;
    if (autosaveFilePath === null || autosaveContent === null) return;
    // Nothing to write, and never autosave a file that has never been saved
    // into (savedContent null means the content is still the on-disk copy).
    if (autosaveSaved === null || autosaveContent === autosaveSaved) return;

    const timer = setTimeout(() => {
      void handleSave();
    }, editor.autosaveDelayMs);
    return () => clearTimeout(timer);
  }, [
    appSettings?.editor,
    autosaveFilePath,
    autosaveContent,
    autosaveSaved,
    handleSave,
  ]);

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
        recentRepos={recentRepos}
        onOpenRepo={handleOpenRecentRepo}
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
      onOpenSettings={handleOpenSettings}
      onCloseSettings={handleCloseSettings}
      onAppSettingsChange={setAppSettings}
      appSettings={appSettings}
      onCloseSearch={handleCloseSearch}
      onSearchResultClick={handleSearchResultClick}
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
      scrollToLine={activeTabState?.scrollToLine}
      onScrollComplete={handleScrollComplete}
    />
  );
}
