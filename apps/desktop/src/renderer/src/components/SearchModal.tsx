import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ContentMatch, FileNameMatch, FileNode, SearchOptions } from '@arlo-doc/shared';
import { matchFileNames } from '../fileNameMatcher';
import { FileTypeIcon } from './FileTypeIcon';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SearchModalProps {
  repoDir: string | null;
  fileTree: FileNode | null;
  onClose: () => void;
  onResultClick: (filePath: string, lineNumber?: number) => void;
}

type ActiveTab = 'search-files' | 'find-in-files';

// Navigable row used for keyboard navigation in Find in Files.
// Each element corresponds to a ContentMatchLine with isMatch=true.
interface NavRow {
  filePath: string;
  lineNumber: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 150;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns `filePath` relative to `repoDir`, stripping the leading dir + '/'. */
function relativePath(filePath: string, repoDir: string): string {
  const prefix = repoDir.endsWith('/') ? repoDir : repoDir + '/';
  return filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath;
}

// ── Spinner ────────────────────────────────────────────────────────────────

function Spinner(): React.ReactElement {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 14,
        height: 14,
        border: '2px solid var(--color-accent-a25)',
        borderTopColor: 'var(--color-accent)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  );
}

// ── Option Toggle Button ───────────────────────────────────────────────────

interface ToggleProps {
  label: string;
  title: string;
  active: boolean;
  onToggle: () => void;
  testId?: string;
}

function OptionToggle({ label, title, active, onToggle, testId }: ToggleProps): React.ReactElement {
  return (
    <button
      title={title}
      data-testid={testId}
      onClick={onToggle}
      style={{
        height: 24,
        minWidth: 28,
        padding: '0 6px',
        borderRadius: 4,
        border: active ? '1px solid var(--color-accent)' : '1px solid var(--border-strong)',
        background: active ? 'var(--color-accent)' : 'transparent',
        color: active ? 'var(--text-on-accent)' : 'var(--text-faint)',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

// ── SearchModal ────────────────────────────────────────────────────────────

export function SearchModal({
  repoDir,
  fileTree,
  onClose,
  onResultClick,
}: SearchModalProps): React.ReactElement {
  // ── State ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('search-files');
  const [fileQuery, setFileQuery] = useState('');
  const [contentQuery, setContentQuery] = useState('');
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    caseSensitive: false,
    useRegex: false,
  });
  const [fileResults, setFileResults] = useState<FileNameMatch[]>([]);
  const [contentResults, setContentResults] = useState<ContentMatch[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [regexError, setRegexError] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRowRef = useRef<HTMLDivElement | null>(null);

  // Snapshot of searchOptions for debounced file search closure
  const searchOptionsRef = useRef(searchOptions);
  useEffect(() => { searchOptionsRef.current = searchOptions; }, [searchOptions]);

  // ── Focus input on mount and tab change ──────────────────────────────
  useEffect(() => {
    // Focus the input for the active tab
    const input = activeTab === 'search-files' ? fileInputRef.current : contentInputRef.current;
    input?.focus();
  }, [activeTab]);

  // ── Escape key ───────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // ── Scroll selected row into view ────────────────────────────────────
  useEffect(() => {
    if (selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // ── Flatten navigable rows for Find in Files ─────────────────────────
  const contentNavRows: NavRow[] = contentResults.flatMap((cm) =>
    cm.lines
      .filter((l) => l.isMatch)
      .map((l) => ({ filePath: cm.filePath, lineNumber: l.lineNumber })),
  );

  // ── File name search (debounced) ─────────────────────────────────────
  const runFileSearch = useCallback(
    (query: string, options: SearchOptions) => {
      if (!query || !fileTree) {
        setFileResults([]);
        setRegexError(false);
        setSelectedIndex(-1);
        return;
      }
      const result = matchFileNames(query, fileTree, options);
      if (!Array.isArray(result)) {
        // result is { ok: false; error: 'INVALID_REGEX' }
        setRegexError(true);
        setFileResults([]);
        setSelectedIndex(-1);
      } else {
        setRegexError(false);
        setFileResults(result);
        setSelectedIndex(result.length > 0 ? 0 : -1);
      }
    },
    [fileTree],
  );

  const scheduleFileSearch = useCallback(
    (query: string, opts?: SearchOptions) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        runFileSearch(query, opts ?? searchOptionsRef.current);
      }, DEBOUNCE_MS);
    },
    [runFileSearch],
  );

  // ── Content search ────────────────────────────────────────────────────
  const runContentSearch = useCallback(async () => {
    if (!repoDir || !contentQuery) {
      setContentResults([]);
      setContentError(null);
      return;
    }
    setIsSearching(true);
    setContentError(null);
    setSelectedIndex(-1);
    setTruncated(false);
    try {
      const result = await window.arlodoc.findInFiles(repoDir, contentQuery, searchOptions);
      if (result.ok) {
        setContentResults(result.data);
        setTruncated(result.data.length === 20);
        setSelectedIndex(
          result.data.some((cm) => cm.lines.some((l) => l.isMatch)) ? 0 : -1,
        );
      } else {
        setContentError(result.error.message);
        setContentResults([]);
      }
    } catch (err) {
      setContentError(err instanceof Error ? err.message : 'Unknown error');
      setContentResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [repoDir, contentQuery, searchOptions]);

  // ── Option toggle handlers ────────────────────────────────────────────
  const toggleCaseSensitive = useCallback(() => {
    const next = { ...searchOptions, caseSensitive: !searchOptions.caseSensitive };
    setSearchOptions(next);
    if (activeTab === 'search-files' && fileQuery) {
      scheduleFileSearch(fileQuery, next);
    }
    // For find-in-files, user will need to re-press Enter; we just update state
  }, [searchOptions, activeTab, fileQuery, scheduleFileSearch]);

  const toggleRegex = useCallback(() => {
    const next = { ...searchOptions, useRegex: !searchOptions.useRegex };
    setSearchOptions(next);
    if (activeTab === 'search-files' && fileQuery) {
      scheduleFileSearch(fileQuery, next);
    }
  }, [searchOptions, activeTab, fileQuery, scheduleFileSearch]);

  // ── Tab switch ────────────────────────────────────────────────────────
  const switchTab = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    setSelectedIndex(-1);
  }, []);

  // ── Input handlers ────────────────────────────────────────────────────
  const handleFileQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      setFileQuery(q);
      scheduleFileSearch(q);
    },
    [scheduleFileSearch],
  );

  const handleContentQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setContentQuery(e.target.value);
    },
    [],
  );

  // ── Keyboard navigation (per-input) ──────────────────────────────────
  const handleFileInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const count = fileResults.length;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (count > 0) setSelectedIndex((i) => (i + 1) % count);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (count > 0) setSelectedIndex((i) => (i - 1 + count) % count);
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && fileResults[selectedIndex]) {
          onResultClick(fileResults[selectedIndex]!.filePath);
          onClose();
        }
      }
    },
    [fileResults, selectedIndex, onResultClick, onClose],
  );

  const handleContentInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const count = contentNavRows.length;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (count > 0) setSelectedIndex((i) => (i + 1) % count);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (count > 0) setSelectedIndex((i) => (i - 1 + count) % count);
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && contentNavRows[selectedIndex]) {
          const row = contentNavRows[selectedIndex]!;
          onResultClick(row.filePath, row.lineNumber);
          onClose();
        } else {
          // selectedIndex === -1: trigger search
          void runContentSearch();
        }
      }
    },
    [contentNavRows, selectedIndex, onResultClick, onClose, runContentSearch],
  );

  // ── Disabled state (no folder) ────────────────────────────────────────
  const noFolder = repoDir === null || fileTree === null;

  // ── Leaf count for "no files in folder" message ───────────────────────
  const hasLeaves = (() => {
    if (!fileTree) return false;
    function check(node: FileNode): boolean {
      if (node.kind === 'file') return true;
      return node.children.some(check);
    }
    return check(fileTree);
  })();

  // ── Footer text ───────────────────────────────────────────────────────
  const footerText = (() => {
    if (activeTab === 'search-files') {
      if (noFolder || !fileQuery) return '';
      if (regexError) return '';
      return `${fileResults.length} file${fileResults.length !== 1 ? 's' : ''}`;
    }
    // find-in-files
    if (isSearching) return 'Searching…';
    if (contentError) return 'Search failed';
    if (!contentQuery) return '';
    const totalMatches = contentResults.reduce(
      (sum, cm) => sum + cm.lines.filter((l) => l.isMatch).length,
      0,
    );
    const fileCount = contentResults.length;
    if (fileCount === 0 && !isSearching) return contentQuery ? '0 matches' : '';
    return `${totalMatches} match${totalMatches !== 1 ? 'es' : ''} across ${fileCount} file${fileCount !== 1 ? 's' : ''}`;
  })();

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Keyframe for spinner — injected once */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Outer wrapper */}
      <div
        data-testid="search-modal-overlay"
        style={{ position: 'absolute', inset: 0, zIndex: 1000 }}
      >
        {/* Backdrop */}
        <div
          data-testid="search-modal-backdrop"
          style={{ position: 'absolute', inset: 0, background: 'var(--color-scrim)' }}
          onClick={onClose}
        />

        {/* Modal card */}
        <div
          data-testid="search-modal-card"
          style={{
            position: 'absolute',
            top: 96,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 720,
            background: 'var(--surface-card)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-overlay)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tab row */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-mid)',
              flexShrink: 0,
            }}
          >
            {(['search-files', 'find-in-files'] as const).map((tab) => {
              const label = tab === 'search-files' ? 'Search Files' : 'Find in Files';
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  data-testid={`tab-${tab}`}
                  onClick={() => switchTab(tab)}
                  style={{
                    height: 40,
                    padding: '0 16px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
                    color: isActive ? 'var(--text-body)' : 'var(--text-faint)',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    fontFamily: 'var(--font-sans)',
                    cursor: 'pointer',
                    marginBottom: -1,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Input + options row */}
          <div
            style={{
              padding: '10px 14px 8px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {activeTab === 'search-files' ? (
                <input
                  ref={fileInputRef}
                  data-testid="search-files-input"
                  value={fileQuery}
                  onChange={handleFileQueryChange}
                  onKeyDown={handleFileInputKeyDown}
                  disabled={noFolder}
                  placeholder={noFolder ? 'No folder open' : 'Search file names…'}
                  style={inputStyle(noFolder)}
                />
              ) : (
                <input
                  ref={contentInputRef}
                  data-testid="find-in-files-input"
                  value={contentQuery}
                  onChange={handleContentQueryChange}
                  onKeyDown={handleContentInputKeyDown}
                  disabled={noFolder || isSearching}
                  placeholder={noFolder ? 'No folder open' : 'Find in files… (Enter to search)'}
                  style={inputStyle(noFolder || isSearching)}
                />
              )}
              {isSearching && <Spinner />}
            </div>

            {/* Option toggles */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <OptionToggle
                label="Aa"
                title="Case sensitive"
                active={searchOptions.caseSensitive}
                onToggle={toggleCaseSensitive}
                testId="toggle-case-sensitive"
              />
              <OptionToggle
                label=".*"
                title="Regular expression"
                active={searchOptions.useRegex}
                onToggle={toggleRegex}
                testId="toggle-regex"
              />
            </div>

            {/* Regex error */}
            {regexError && activeTab === 'search-files' && (
              <div
                data-testid="regex-error"
                style={{ fontSize: 11.5, color: 'var(--color-error-text)', fontFamily: 'var(--font-sans)' }}
              >
                Invalid regex
              </div>
            )}
          </div>

          {/* Result list */}
          <div
            data-testid="result-list"
            style={{ maxHeight: 420, overflowY: 'auto', flex: 1 }}
          >
            {activeTab === 'search-files'
              ? renderSearchFilesResults({
                  noFolder,
                  hasLeaves,
                  fileQuery,
                  fileResults,
                  regexError,
                  selectedIndex,
                  onResultClick,
                  onClose,
                  selectedRowRef,
                })
              : renderFindInFilesResults({
                  noFolder,
                  contentQuery,
                  contentResults,
                  contentError,
                  isSearching,
                  truncated,
                  contentNavRows,
                  selectedIndex,
                  repoDir: repoDir ?? '',
                  onResultClick,
                  onClose,
                  selectedRowRef,
                })}
          </div>

          {/* Footer */}
          <div
            data-testid="search-footer"
            style={{
              height: 36,
              background: 'var(--surface-section)',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 11.5,
                color: contentError ? 'var(--color-error-text)' : 'var(--text-faint)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {footerText}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Input style helper ──────────────────────────────────────────────────────

function inputStyle(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    height: 34,
    padding: '0 10px',
    border: '1px solid var(--border-stronger)',
    borderRadius: 6,
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    color: disabled ? 'var(--text-disabled)' : 'var(--text-body)',
    background: disabled ? 'var(--surface-section)' : 'var(--surface-card)',
    outline: 'none',
    cursor: disabled ? 'not-allowed' : 'text',
  };
}

// ── Search Files result renderer ────────────────────────────────────────────

interface SearchFilesResultsProps {
  noFolder: boolean;
  hasLeaves: boolean;
  fileQuery: string;
  fileResults: FileNameMatch[];
  regexError: boolean;
  selectedIndex: number;
  onResultClick: (filePath: string) => void;
  onClose: () => void;
  selectedRowRef: React.MutableRefObject<HTMLDivElement | null>;
}

function renderSearchFilesResults({
  noFolder,
  hasLeaves,
  fileQuery,
  fileResults,
  regexError,
  selectedIndex,
  onResultClick,
  onClose,
  selectedRowRef,
}: SearchFilesResultsProps): React.ReactElement {
  if (noFolder) {
    return <EmptyMessage text="No folder open" />;
  }
  if (!hasLeaves) {
    return <EmptyMessage text="No files in this folder" />;
  }
  if (regexError) {
    return <EmptyMessage text="" />;
  }
  if (!fileQuery) {
    return <div style={{ minHeight: 60 }} />;
  }
  if (fileResults.length === 0) {
    return <EmptyMessage text={`No files matching «${fileQuery}»`} />;
  }
  return (
    <>
      {fileResults.map((match, i) => {
        const isSelected = i === selectedIndex;
        return (
          <div
            key={match.filePath}
            ref={isSelected ? selectedRowRef : undefined}
            data-testid="search-result-row"
            data-result-row="true"
            onClick={() => {
              onResultClick(match.filePath);
              onClose();
            }}
            style={{
              padding: '8px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              cursor: 'pointer',
              background: isSelected ? 'var(--color-accent-tint)' : 'transparent',
              borderBottom: '1px solid var(--border-faint)',
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: 'var(--text-body)',
                fontFamily: 'var(--font-sans)',
                fontWeight: 400,
              }}
            >
              {match.fileName}
            </span>
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-placeholder-soft)',
                fontFamily: 'var(--font-mono)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {match.filePath}
            </span>
          </div>
        );
      })}
    </>
  );
}

// ── Find in Files result renderer ───────────────────────────────────────────

interface FindInFilesResultsProps {
  noFolder: boolean;
  contentQuery: string;
  contentResults: ContentMatch[];
  contentError: string | null;
  isSearching: boolean;
  truncated: boolean;
  contentNavRows: NavRow[];
  selectedIndex: number;
  repoDir: string;
  onResultClick: (filePath: string, lineNumber: number) => void;
  onClose: () => void;
  selectedRowRef: React.MutableRefObject<HTMLDivElement | null>;
}

function renderFindInFilesResults({
  noFolder,
  contentQuery,
  contentResults,
  contentError,
  isSearching,
  truncated,
  contentNavRows,
  selectedIndex,
  repoDir,
  onResultClick,
  onClose,
  selectedRowRef,
}: FindInFilesResultsProps): React.ReactElement {
  if (noFolder) {
    return <EmptyMessage text="No folder open" />;
  }
  if (isSearching) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
          gap: 10,
        }}
      >
        <Spinner />
        <span style={{ fontSize: 13, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)' }}>
          Searching…
        </span>
      </div>
    );
  }
  if (contentError) {
    return (
      <div style={{ padding: '20px 14px' }}>
        <span
          style={{
            fontSize: 13,
            color: 'var(--color-error-text)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {contentError}
        </span>
      </div>
    );
  }
  if (!contentQuery || contentResults.length === 0) {
    if (contentQuery && contentResults.length === 0) {
      return <EmptyMessage text={`No results found for «${contentQuery}»`} />;
    }
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 80,
          padding: 16,
        }}
      >
        <span
          style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-sans)' }}
        >
          {contentQuery ? '' : 'Press Enter to search file contents'}
        </span>
      </div>
    );
  }

  // Track which nav-row index we're on per isMatch line
  let navRowIdx = 0;

  return (
    <>
      {contentResults.map((cm) => {
        const relPath = relativePath(cm.filePath, repoDir);
        const matchCount = cm.lines.filter((l) => l.isMatch).length;
        const fileName = cm.filePath.split('/').pop() ?? cm.filePath;

        return (
          <div key={cm.filePath}>
            {/* File header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px 5px',
                background: 'var(--surface-section)',
                borderTop: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                position: 'sticky',
                top: 0,
              }}
            >
              <FileTypeIcon fileName={fileName} />
              <span
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-body)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {relPath}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-faint)',
                  fontFamily: 'var(--font-sans)',
                  flexShrink: 0,
                }}
              >
                {matchCount} match{matchCount !== 1 ? 'es' : ''}
              </span>
            </div>

            {/* Lines */}
            {cm.lines.map((line) => {
              const isNavRow = line.isMatch;
              const thisNavIdx = isNavRow ? navRowIdx++ : -1;
              const isSelected = isNavRow && thisNavIdx === selectedIndex;

              return (
                <div
                  key={`${cm.filePath}:${line.lineNumber}`}
                  ref={isSelected ? selectedRowRef : undefined}
                  data-testid={line.isMatch ? 'match-line-row' : 'context-line-row'}
                  data-result-row={line.isMatch ? 'true' : undefined}
                  onClick={
                    line.isMatch
                      ? () => {
                          onResultClick(cm.filePath, line.lineNumber);
                          onClose();
                        }
                      : undefined
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 0,
                    padding: '2px 0',
                    background: isSelected
                      ? 'var(--color-accent-tint-strong)'
                      : line.isMatch
                        ? 'var(--color-accent-a06)'
                        : 'transparent',
                    cursor: line.isMatch ? 'pointer' : 'default',
                    borderBottom: '1px solid transparent',
                  }}
                >
                  {/* Line number */}
                  <span
                    style={{
                      minWidth: 48,
                      textAlign: 'right',
                      paddingRight: 10,
                      paddingLeft: 14,
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-dim)',
                      userSelect: 'none',
                      flexShrink: 0,
                      lineHeight: '20px',
                    }}
                  >
                    {line.lineNumber}
                  </span>
                  {/* Line text */}
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      color: line.isMatch ? 'var(--text-body)' : 'var(--text-muted)',
                      whiteSpace: 'pre',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: '20px',
                      paddingRight: 14,
                    }}
                  >
                    {line.text.trimEnd()}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Truncation notice */}
      {truncated && (
        <div
          data-testid="truncation-notice"
          style={{
            padding: '10px 14px',
            fontSize: 12,
            color: 'var(--text-faint)',
            fontFamily: 'var(--font-sans)',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-section)',
          }}
        >
          Showing first 20 files — refine your query to see more
        </div>
      )}
    </>
  );
}

// ── Empty message helper ────────────────────────────────────────────────────

function EmptyMessage({ text }: { text: string }): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 80,
        padding: 16,
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)' }}>
        {text}
      </span>
    </div>
  );
}
